import { describe, expect, it, vi } from 'vitest';

vi.mock('fs', () => ({ createReadStream: vi.fn((path: string, options?: unknown) => ({ path, options })) }));

import { createReadStream } from 'fs';

import { buildFileEtag, isIfRangeSatisfied, parseRangeHeader, sendFileWithRanges } from './http-range.utils';

const mockCreateReadStream = vi.mocked(createReadStream);

function makeReply() {
  const headers: Record<string, string | number> = {};
  const reply = {
    header: vi.fn((key: string, value: string | number) => {
      headers[key] = value;
      return reply;
    }),
    type: vi.fn(() => reply),
    status: vi.fn(() => reply),
    send: vi.fn(() => reply),
  };
  return { reply, headers };
}

describe('parseRangeHeader', () => {
  it('parses closed, open and suffix ranges', () => {
    expect(parseRangeHeader('bytes=10-19', 500)).toEqual({ start: 10, end: 19 });
    expect(parseRangeHeader('bytes=10-', 500)).toEqual({ start: 10, end: 499 });
    expect(parseRangeHeader('bytes=-100', 500)).toEqual({ start: 400, end: 499 });
  });

  it('tolerates whitespace and header casing', () => {
    expect(parseRangeHeader('  Bytes = 10 - 19 ', 500)).toEqual({ start: 10, end: 19 });
  });

  it('clamps an end past the last byte instead of rejecting the request', () => {
    expect(parseRangeHeader('bytes=490-99999', 500)).toEqual({ start: 490, end: 499 });
    expect(parseRangeHeader('bytes=-99999', 500)).toEqual({ start: 0, end: 499 });
  });

  it('reports ranges that start past the end as unsatisfiable', () => {
    expect(parseRangeHeader('bytes=500-', 500)).toBe('unsatisfiable');
    expect(parseRangeHeader('bytes=600-700', 500)).toBe('unsatisfiable');
    expect(parseRangeHeader('bytes=-0', 500)).toBe('unsatisfiable');
    expect(parseRangeHeader('bytes=0-', 0)).toBe('unsatisfiable');
  });

  it('falls back to the full representation for absent, malformed and multi-range specs', () => {
    expect(parseRangeHeader(undefined, 500)).toBeNull();
    expect(parseRangeHeader('', 500)).toBeNull();
    expect(parseRangeHeader('items=0-10', 500)).toBeNull();
    expect(parseRangeHeader('bytes=-', 500)).toBeNull();
    expect(parseRangeHeader('bytes=abc-def', 500)).toBeNull();
    expect(parseRangeHeader('bytes=20-10', 500)).toBeNull();
    expect(parseRangeHeader('bytes=0-10,20-30', 500)).toBeNull();
  });

  it('rejects offsets that cannot be represented exactly', () => {
    expect(parseRangeHeader('bytes=99999999999999999999-', 500)).toBeNull();
  });
});

describe('isIfRangeSatisfied', () => {
  const etag = buildFileEtag(500, 1_700_000_000_000);
  const lastModified = new Date(1_700_000_000_000).toUTCString();

  it('accepts a missing header, a matching entity tag and a matching date', () => {
    expect(isIfRangeSatisfied(undefined, etag, lastModified)).toBe(true);
    expect(isIfRangeSatisfied(etag, etag, lastModified)).toBe(true);
    expect(isIfRangeSatisfied(lastModified, etag, lastModified)).toBe(true);
  });

  it('rejects a stale validator and any weak entity tag', () => {
    expect(isIfRangeSatisfied('"deadbeef-1"', etag, lastModified)).toBe(false);
    expect(isIfRangeSatisfied(new Date(1_600_000_000_000).toUTCString(), etag, lastModified)).toBe(false);
    expect(isIfRangeSatisfied(`W/${etag}`, etag, lastModified)).toBe(false);
    expect(isIfRangeSatisfied('not-a-date', etag, lastModified)).toBe(false);
  });
});

describe('sendFileWithRanges', () => {
  const base = {
    path: '/books/book.epub',
    size: 500,
    mtimeMs: 1_700_000_000_000,
    contentType: 'application/epub+zip',
  };

  it('sends the full file with validators when no range is requested', () => {
    const { reply, headers } = makeReply();

    const result = sendFileWithRanges(reply as never, { ...base, contentDisposition: 'attachment; filename="book.epub"' });

    expect(result).toEqual({ status: 200, start: 0, end: 499, partial: false });
    expect(headers['Accept-Ranges']).toBe('bytes');
    expect(headers['ETag']).toBe(buildFileEtag(500, 1_700_000_000_000));
    expect(headers['Last-Modified']).toBe(new Date(1_700_000_000_000).toUTCString());
    expect(headers['Content-Disposition']).toBe('attachment; filename="book.epub"');
    expect(headers['Content-Length']).toBe(500);
    expect(reply.type).toHaveBeenCalledWith('application/epub+zip');
    expect(mockCreateReadStream).toHaveBeenCalledWith('/books/book.epub');
  });

  it('sends partial content for a resume range', () => {
    const { reply, headers } = makeReply();

    const result = sendFileWithRanges(reply as never, { ...base, rangeHeader: 'bytes=200-' });

    expect(result).toEqual({ status: 206, start: 200, end: 499, partial: true });
    expect(reply.status).toHaveBeenCalledWith(206);
    expect(headers['Content-Range']).toBe('bytes 200-499/500');
    expect(headers['Content-Length']).toBe(300);
    expect(mockCreateReadStream).toHaveBeenCalledWith('/books/book.epub', { start: 200, end: 499 });
  });

  it('answers an unsatisfiable range with 416 and no stream', () => {
    const { reply, headers } = makeReply();
    mockCreateReadStream.mockClear();

    const result = sendFileWithRanges(reply as never, { ...base, rangeHeader: 'bytes=600-700' });

    expect(result.status).toBe(416);
    expect(reply.status).toHaveBeenCalledWith(416);
    expect(headers['Content-Range']).toBe('bytes */500');
    expect(mockCreateReadStream).not.toHaveBeenCalled();
  });

  it('ignores the range when If-Range no longer matches the file', () => {
    const { reply, headers } = makeReply();

    const result = sendFileWithRanges(reply as never, { ...base, rangeHeader: 'bytes=200-', ifRangeHeader: '"stale-1"' });

    expect(result).toEqual({ status: 200, start: 0, end: 499, partial: false });
    expect(headers['Content-Range']).toBeUndefined();
    expect(headers['Content-Length']).toBe(500);
    expect(mockCreateReadStream).toHaveBeenCalledWith('/books/book.epub');
  });

  it('serves the range when If-Range still matches the file', () => {
    const { reply, headers } = makeReply();

    const result = sendFileWithRanges(reply as never, {
      ...base,
      rangeHeader: 'bytes=200-',
      ifRangeHeader: buildFileEtag(500, 1_700_000_000_000),
    });

    expect(result.partial).toBe(true);
    expect(headers['Content-Range']).toBe('bytes 200-499/500');
  });
});
