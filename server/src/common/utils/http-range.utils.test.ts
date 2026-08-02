import { describe, expect, it, vi } from 'vitest';

vi.mock('fs', () => ({ createReadStream: vi.fn((path: string, options?: unknown) => ({ path, options })) }));

import { createReadStream } from 'fs';

import { buildFileEtag, isIfRangeSatisfied, isMtimeSettled, parseRangeHeader, sendFileWithRanges } from './http-range.utils';

const mockCreateReadStream = vi.mocked(createReadStream);

const SETTLED_MTIME_NS = 1_700_000_000_000_000_000n;
const SETTLED_MTIME_MS = 1_700_000_000_000;

function freshMtimeNs() {
  return BigInt(Date.now()) * 1_000_000n;
}

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

describe('buildFileEtag', () => {
  it('renders size, nanosecond mtime and inode as three hex fields in one pair of quotes', () => {
    expect(buildFileEtag({ size: 500, mtimeNs: SETTLED_MTIME_NS, ino: 42n })).toBe('"1f4-17979cfe362a0000-2a"');
  });

  it('renders a negative inode unsigned so mounts that overflow still produce a canonical tag', () => {
    expect(buildFileEtag({ size: 500, mtimeNs: SETTLED_MTIME_NS, ino: -2n })).toBe('"1f4-17979cfe362a0000-fffffffffffffffe"');
  });

  it('separates two files that differ only in inode', () => {
    const a = buildFileEtag({ size: 500, mtimeNs: SETTLED_MTIME_NS, ino: 42n });
    const b = buildFileEtag({ size: 500, mtimeNs: SETTLED_MTIME_NS, ino: 43n });
    expect(a).not.toBe(b);
  });
});

describe('isMtimeSettled', () => {
  it('refuses a file written inside the filesystem tick window', () => {
    expect(isMtimeSettled(10_000, 10_000)).toBe(false);
    expect(isMtimeSettled(10_000, 11_999)).toBe(false);
  });

  it('accepts a file whose tick has closed', () => {
    expect(isMtimeSettled(10_000, 12_000)).toBe(true);
    expect(isMtimeSettled(10_000, 60_000)).toBe(true);
  });

  it('fails safe on a clock that reads behind the recorded mtime', () => {
    expect(isMtimeSettled(10_000, 9_000)).toBe(false);
  });
});

describe('isIfRangeSatisfied', () => {
  const etag = buildFileEtag({ size: 500, mtimeNs: SETTLED_MTIME_NS, ino: 42n });
  const lastModified = new Date(SETTLED_MTIME_MS).toUTCString();

  it('accepts a missing header and a matching strong entity tag', () => {
    expect(isIfRangeSatisfied(undefined, etag)).toBe(true);
    expect(isIfRangeSatisfied(etag, etag)).toBe(true);
  });

  it('rejects the HTTP-date form, which a filesystem second cannot make strong', () => {
    expect(isIfRangeSatisfied(lastModified, etag)).toBe(false);
    expect(isIfRangeSatisfied(new Date(1_600_000_000_000).toUTCString(), etag)).toBe(false);
  });

  it('rejects a stale validator and any weak entity tag', () => {
    expect(isIfRangeSatisfied('"deadbeef-1"', etag)).toBe(false);
    expect(isIfRangeSatisfied(`W/${etag}`, etag)).toBe(false);
    expect(isIfRangeSatisfied('not-a-date', etag)).toBe(false);
  });

  it('rejects every validator while no strong tag exists', () => {
    expect(isIfRangeSatisfied(etag, null)).toBe(false);
    expect(isIfRangeSatisfied(lastModified, null)).toBe(false);
    expect(isIfRangeSatisfied(undefined, null)).toBe(true);
  });

  it('rejects a repeated header rather than treating it as absent', () => {
    expect(isIfRangeSatisfied([etag, etag], etag)).toBe(false);
    expect(isIfRangeSatisfied([etag], etag)).toBe(false);
    expect(isIfRangeSatisfied([], etag)).toBe(false);
  });
});

describe('sendFileWithRanges', () => {
  const base = {
    path: '/books/book.epub',
    size: 500,
    mtimeNs: SETTLED_MTIME_NS,
    ino: 42n,
    contentType: 'application/epub+zip',
  };
  const settledEtag = buildFileEtag(base);

  it('sends the full file with validators when no range is requested', () => {
    const { reply, headers } = makeReply();

    const result = sendFileWithRanges(reply as never, { ...base, contentDisposition: 'attachment; filename="book.epub"' });

    expect(result).toEqual({ status: 200, start: 0, end: 499, partial: false });
    expect(headers['Accept-Ranges']).toBe('bytes');
    expect(headers['ETag']).toBe(settledEtag);
    expect(headers['Last-Modified']).toBe(new Date(SETTLED_MTIME_MS).toUTCString());
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

  it('ignores the range when If-Range arrives repeated', () => {
    const { reply, headers } = makeReply();

    const result = sendFileWithRanges(reply as never, { ...base, rangeHeader: 'bytes=200-', ifRangeHeader: [settledEtag, settledEtag] });

    expect(result).toEqual({ status: 200, start: 0, end: 499, partial: false });
    expect(headers['Content-Range']).toBeUndefined();
  });

  it('ignores the range when If-Range carries the Last-Modified date', () => {
    const { reply, headers } = makeReply();

    const result = sendFileWithRanges(reply as never, {
      ...base,
      rangeHeader: 'bytes=200-',
      ifRangeHeader: new Date(SETTLED_MTIME_MS).toUTCString(),
    });

    expect(result).toEqual({ status: 200, start: 0, end: 499, partial: false });
    expect(headers['Content-Range']).toBeUndefined();
  });

  it('serves the range when If-Range still matches the file', () => {
    const { reply, headers } = makeReply();

    const result = sendFileWithRanges(reply as never, { ...base, rangeHeader: 'bytes=200-', ifRangeHeader: settledEtag });

    expect(result.partial).toBe(true);
    expect(headers['Content-Range']).toBe('bytes 200-499/500');
  });

  it('weakens the tag for a file still inside the filesystem tick window', () => {
    const { reply, headers } = makeReply();
    const mtimeNs = freshMtimeNs();

    const result = sendFileWithRanges(reply as never, { ...base, mtimeNs });

    expect(result.status).toBe(200);
    expect(headers['ETag']).toBe(`W/${buildFileEtag({ ...base, mtimeNs })}`);
  });

  it('declines If-Range while the tick window is open, even for the tag it just sent', () => {
    const { reply, headers } = makeReply();
    const mtimeNs = freshMtimeNs();

    const result = sendFileWithRanges(reply as never, {
      ...base,
      mtimeNs,
      rangeHeader: 'bytes=200-',
      ifRangeHeader: buildFileEtag({ ...base, mtimeNs }),
    });

    expect(result).toEqual({ status: 200, start: 0, end: 499, partial: false });
    expect(headers['Content-Range']).toBeUndefined();
  });

  it('still answers a bare range with 206 inside the tick window', () => {
    const { reply, headers } = makeReply();

    const result = sendFileWithRanges(reply as never, { ...base, mtimeNs: freshMtimeNs(), rangeHeader: 'bytes=200-' });

    expect(result).toEqual({ status: 206, start: 200, end: 499, partial: true });
    expect(headers['Content-Range']).toBe('bytes 200-499/500');
  });
});
