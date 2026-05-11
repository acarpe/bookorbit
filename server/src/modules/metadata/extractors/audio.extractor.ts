import { execFile as execFileCallback, spawn } from 'child_process';
import { promisify } from 'util';
import type { AudiobookChapter } from '@bookorbit/types';

const execFile = promisify(execFileCallback);

const FFPROBE_PATH = process.env.FFPROBE_PATH || 'ffprobe';
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';

export interface AudioExtractResult {
  title: string | null;
  authors: { name: string; sortName: string | null }[];
  narrators: string[];
  publisher: string | null;
  publishedYear: number | null;
  description: string | null;
  language: string | null;
  durationSeconds: number | null;
  chapters: AudiobookChapter[];
  coverBytes: Buffer | null;
}

interface FfprobeStream {
  codec_type: string;
  codec_name: string;
  tags?: Record<string, string>;
}

interface FfprobeChapter {
  start_time: string;
  tags?: Record<string, string>;
}

interface FfprobeOutput {
  format: {
    duration?: string;
    tags?: Record<string, string>;
  };
  streams?: FfprobeStream[];
  chapters?: FfprobeChapter[];
}

export async function extractAudioMetadata(absolutePath: string): Promise<AudioExtractResult> {
  try {
    const { stdout } = await execFile(FFPROBE_PATH, [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_format',
      '-show_chapters',
      '-show_streams',
      absolutePath,
    ]);

    const data: FfprobeOutput = JSON.parse(stdout);
    const tags = normalizeTags(data.format.tags ?? {});
    const streams = data.streams ?? [];
    const chapters = data.chapters ?? [];

    // albumartist = book author, artist = narrator.
    // If only artist is set, it is the author.
    const rawAlbumArtist = tags.albumartist ?? tags.album_artist ?? null;
    const rawArtist = tags.artist ?? null;

    const authorNames = rawAlbumArtist ? splitArtists(rawAlbumArtist) : rawArtist ? splitArtists(rawArtist) : [];
    const narratorNames = rawAlbumArtist && rawArtist ? splitArtists(rawArtist) : [];

    // Album tag is the audiobook title; fall back to track title.
    const title = tags.album ?? tags.title ?? null;

    const publisher = tags.publisher ?? null;
    const publishedYear = parseYear(tags.date ?? tags.year ?? null);
    const description = tags.comment ?? tags.description ?? null;
    const language = resolveLanguage(tags, streams);
    const durationSeconds = data.format.duration ? Math.round(parseFloat(data.format.duration)) : null;

    const mappedChapters: AudiobookChapter[] = chapters.map((ch) => ({
      title: ch.tags?.title ?? '',
      startMs: Math.round(parseFloat(ch.start_time) * 1000),
    }));

    const coverBytes = await extractCoverBytes(absolutePath, streams);

    return {
      title,
      authors: authorNames.map((name) => ({ name, sortName: null })),
      narrators: narratorNames,
      publisher,
      publishedYear,
      description,
      language,
      durationSeconds,
      chapters: mappedChapters,
      coverBytes,
    };
  } catch {
    return emptyResult();
  }
}

export async function parseAudioDuration(absolutePath: string): Promise<number | null> {
  try {
    const { stdout } = await execFile(FFPROBE_PATH, ['-v', 'quiet', '-print_format', 'json', '-show_format', absolutePath]);
    const data: FfprobeOutput = JSON.parse(stdout);
    if (!data.format.duration) return null;
    return Math.round(parseFloat(data.format.duration));
  } catch {
    return null;
  }
}

async function extractCoverBytes(absolutePath: string, streams: FfprobeStream[]): Promise<Buffer | null> {
  const hasEmbeddedImage = streams.some((s) => s.codec_type === 'video');
  if (!hasEmbeddedImage) return null;

  return new Promise<Buffer | null>((resolve) => {
    const chunks: Buffer[] = [];
    const proc = spawn(FFMPEG_PATH, ['-y', '-i', absolutePath, '-map', '0:v', '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'mjpeg', 'pipe:1'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    proc.on('close', (code) => {
      if (code === 0 && chunks.length > 0) {
        resolve(Buffer.concat(chunks));
      } else {
        resolve(null);
      }
    });
    proc.on('error', () => resolve(null));
  });
}

function normalizeTags(tags: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(tags).map(([k, v]) => [k.toLowerCase(), v]));
}

function splitArtists(raw: string): string[] {
  return raw
    .split(/[;/]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseYear(raw: string | null): number | null {
  if (!raw) return null;
  const match = raw.match(/\d{4}/);
  return match ? parseInt(match[0], 10) : null;
}

function resolveLanguage(tags: Record<string, string>, streams: FfprobeStream[]): string | null {
  if (tags.language) return tags.language;
  for (const stream of streams) {
    if (stream.codec_type === 'audio' && stream.tags?.language) {
      return stream.tags.language;
    }
  }
  return null;
}

function emptyResult(): AudioExtractResult {
  return {
    title: null,
    authors: [],
    narrators: [],
    publisher: null,
    publishedYear: null,
    description: null,
    language: null,
    durationSeconds: null,
    chapters: [],
    coverBytes: null,
  };
}
