import { createReadStream } from 'fs';

import type { FastifyReply } from 'fastify';

const MAX_RANGE_DIGITS = 15;

export interface ByteRange {
  start: number;
  end: number;
}

/**
 * A parsed range spec, `unsatisfiable` when it addresses bytes past the end of
 * the file, or null when the request carries no usable range and the full
 * representation must be sent.
 */
export type ParsedRange = ByteRange | 'unsatisfiable' | null;

/**
 * Range headers as they arrive from a client, threaded down to the stream
 * helper. A repeated header reaches Fastify as an array, which is malformed for
 * both of these: a repeated Range means no usable range, while a repeated
 * If-Range means an unmet precondition rather than an absent one.
 */
export interface FileRangeRequest {
  rangeHeader?: string | string[];
  ifRangeHeader?: string | string[];
}

export interface FileStreamOptions extends FileRangeRequest {
  path: string;
  size: number;
  mtimeMs: number;
  contentType: string;
  contentDisposition?: string;
  cacheControl?: string;
}

export interface FileStreamResult {
  status: 200 | 206 | 416;
  start: number;
  end: number;
  partial: boolean;
}

function parseByteCount(value: string): number | null {
  if (value.length === 0 || value.length > MAX_RANGE_DIGITS) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function buildFileEtag(size: number, mtimeMs: number): string {
  return `"${size.toString(16)}-${Math.floor(mtimeMs).toString(16)}"`;
}

/**
 * Parses a single byte range. Multi-range requests and syntactically invalid
 * specs resolve to null: RFC 9110 lets a server answer either with the full
 * representation, which keeps one read stream per response.
 */
export function parseRangeHeader(header: string | string[] | undefined, size: number): ParsedRange {
  if (typeof header !== 'string' || header === '') return null;
  const spec = /^bytes\s*=(.*)$/i.exec(header.trim());
  if (!spec) return null;
  if (spec[1].includes(',')) return null;

  const match = /^\s*(\d*)\s*-\s*(\d*)\s*$/.exec(spec[1]);
  if (!match) return null;
  const [, rawStart, rawEnd] = match;

  if (rawStart === '') {
    const suffix = parseByteCount(rawEnd);
    if (suffix === null) return null;
    if (suffix === 0 || size === 0) return 'unsatisfiable';
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }

  const start = parseByteCount(rawStart);
  if (start === null) return null;
  if (start >= size) return 'unsatisfiable';
  if (rawEnd === '') return { start, end: size - 1 };

  const end = parseByteCount(rawEnd);
  if (end === null || end < start) return null;
  return { start, end: Math.min(end, size - 1) };
}

/**
 * If-Range demands strong comparison, so a weak entity tag never authorizes a
 * partial response: the client gets the full file back instead of silently
 * splicing bytes from a representation that may have changed. Only a genuinely
 * absent header skips the check; a repeated one arrives as an array and is
 * unsatisfied, since guessing which value the client meant could splice.
 */
export function isIfRangeSatisfied(ifRangeHeader: string | string[] | undefined, etag: string, lastModified: string): boolean {
  if (ifRangeHeader === undefined) return true;
  if (typeof ifRangeHeader !== 'string') return false;
  const value = ifRangeHeader.trim();
  if (value === '') return true;
  if (value.startsWith('W/')) return false;
  if (value.startsWith('"')) return value === etag;

  const requested = Date.parse(value);
  return Number.isFinite(requested) && requested === Date.parse(lastModified);
}

/**
 * Sends a file with range support and returns what was actually served, so the
 * caller can log the outcome. Partial responses carry Content-Range, which also
 * keeps @fastify/compress off the payload: its byte offsets describe the
 * unencoded representation.
 */
export function sendFileWithRanges(reply: FastifyReply, options: FileStreamOptions): FileStreamResult {
  const { path, size, mtimeMs, contentType } = options;
  const etag = buildFileEtag(size, mtimeMs);
  const lastModified = new Date(Math.floor(mtimeMs)).toUTCString();

  reply.header('Accept-Ranges', 'bytes');
  reply.header('ETag', etag);
  reply.header('Last-Modified', lastModified);
  if (options.cacheControl) reply.header('Cache-Control', options.cacheControl);
  if (options.contentDisposition) reply.header('Content-Disposition', options.contentDisposition);
  reply.type(contentType);

  const range = isIfRangeSatisfied(options.ifRangeHeader, etag, lastModified) ? parseRangeHeader(options.rangeHeader, size) : null;

  if (range === 'unsatisfiable') {
    reply.status(416);
    reply.header('Content-Range', `bytes */${size}`);
    reply.send();
    return { status: 416, start: 0, end: 0, partial: false };
  }

  if (range) {
    reply.status(206);
    reply.header('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
    reply.header('Content-Length', range.end - range.start + 1);
    reply.send(createReadStream(path, { start: range.start, end: range.end }));
    return { status: 206, start: range.start, end: range.end, partial: true };
  }

  reply.header('Content-Length', size);
  reply.send(createReadStream(path));
  return { status: 200, start: 0, end: Math.max(0, size - 1), partial: false };
}
