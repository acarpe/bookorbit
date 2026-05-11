vi.mock('fs/promises', () => ({
  chmod: vi.fn(),
  mkdir: vi.fn(),
  stat: vi.fn(),
  writeFile: vi.fn(),
}));

import { chmod, mkdir, stat, writeFile } from 'fs/promises';
import { join } from 'path';

import { KepubifyBinaryService } from './kepubify-binary.service';

const chmodMock = vi.mocked(chmod);
const mkdirMock = vi.mocked(mkdir);
const statMock = vi.mocked(stat);
const writeFileMock = vi.mocked(writeFile);

const config = { get: vi.fn().mockReturnValue('/app-data') };

function makeService() {
  return new KepubifyBinaryService(config as never);
}

describe('KepubifyBinaryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('detectBinaryName', () => {
    it.each([
      ['darwin', 'arm64', 'kepubify-darwin-arm64'],
      ['darwin', 'x64', 'kepubify-darwin-64bit'],
      ['linux', 'x64', 'kepubify-linux-64bit'],
      ['linux', 'arm64', 'kepubify-linux-arm64'],
      ['linux', 'arm', 'kepubify-linux-arm'],
      ['linux', 'ia32', 'kepubify-linux-32bit'],
    ])('platform=%s arch=%s → %s', (platform, arch, expected) => {
      const service = makeService();
      vi.spyOn(process, 'platform', 'get').mockReturnValue(platform as NodeJS.Platform);
      vi.spyOn(process, 'arch', 'get').mockReturnValue(arch);
      expect((service as any).detectBinaryName()).toBe(expected);
    });

    it('throws for unsupported platforms', () => {
      const service = makeService();
      vi.spyOn(process, 'platform', 'get').mockReturnValue('win32' as NodeJS.Platform);
      vi.spyOn(process, 'arch', 'get').mockReturnValue('x64');
      expect(() => (service as any).detectBinaryName()).toThrow('Unsupported platform');
    });
  });

  describe('getBinaryPath', () => {
    it('caches result and only resolves once across multiple calls', async () => {
      const service = makeService();
      vi.spyOn(service as any, 'detectBinaryName').mockReturnValue('kepubify-linux-64bit');
      const resolveSpy = vi.spyOn(service as any, 'resolveBinaryPath').mockResolvedValue('/resolved/kepubify');

      const first = await service.getBinaryPath();
      const second = await service.getBinaryPath();

      expect(first).toBe('/resolved/kepubify');
      expect(second).toBe('/resolved/kepubify');
      expect(resolveSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('resolveBinaryPath', () => {
    it('returns bundled path when binary is present in bin/ dir', async () => {
      const service = makeService();
      const expectedBundled = join(process.cwd(), 'bin', 'kepubify', 'kepubify-linux-64bit');
      statMock.mockResolvedValueOnce({} as never);

      const result = await (service as any).resolveBinaryPath('kepubify-linux-64bit');

      expect(result).toBe(expectedBundled);
      expect(chmodMock).toHaveBeenCalledWith(expectedBundled, 0o755);
      expect(mkdirMock).not.toHaveBeenCalled();
    });

    it('falls back to download path when bundled binary is missing', async () => {
      const service = makeService();
      statMock
        .mockRejectedValueOnce(new Error('ENOENT')) // bundled path missing
        .mockResolvedValueOnce({} as never); // download cache hit

      const result = await (service as any).resolveBinaryPath('kepubify-linux-64bit');

      expect(result).toBe('/app-data/.tools/kepubify/kepubify-linux-64bit');
    });

    it('downloads and returns download path when neither bundled nor cached', async () => {
      const service = makeService();
      statMock
        .mockRejectedValueOnce(new Error('ENOENT')) // bundled missing
        .mockRejectedValueOnce(new Error('ENOENT')); // download cache missing
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) }));

      const result = await (service as any).resolveBinaryPath('kepubify-linux-64bit');

      expect(result).toBe('/app-data/.tools/kepubify/kepubify-linux-64bit');
      expect(mkdirMock).toHaveBeenCalledWith('/app-data/.tools/kepubify', { recursive: true });
    });
  });

  describe('ensureDownloaded', () => {
    it('chmods and returns without downloading when binary is already cached', async () => {
      const service = makeService();
      statMock.mockResolvedValueOnce({} as never);

      await (service as any).ensureDownloaded('/cache/kepubify', 'kepubify-linux-64bit', '/cache');

      expect(chmodMock).toHaveBeenCalledWith('/cache/kepubify', 0o755);
      expect(mkdirMock).not.toHaveBeenCalled();
      expect(writeFileMock).not.toHaveBeenCalled();
    });

    it('downloads, writes, and chmods when binary is not cached', async () => {
      const service = makeService();
      statMock.mockRejectedValueOnce(new Error('ENOENT'));
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          arrayBuffer: () => Promise.resolve(Uint8Array.from([0xde, 0xad, 0xbe, 0xef]).buffer),
        }),
      );

      await (service as any).ensureDownloaded('/cache/kepubify', 'kepubify-linux-64bit', '/cache/dir');

      expect(mkdirMock).toHaveBeenCalledWith('/cache/dir', { recursive: true });
      expect(writeFileMock).toHaveBeenCalledWith('/cache/kepubify', Buffer.from([0xde, 0xad, 0xbe, 0xef]));
      expect(chmodMock).toHaveBeenCalledWith('/cache/kepubify', 0o755);
    });

    it('fetches from the bookorbit/bookorbit-tools URL (not neonsolstice)', async () => {
      const service = makeService();
      statMock.mockRejectedValueOnce(new Error('ENOENT'));
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) });
      vi.stubGlobal('fetch', fetchMock);

      await (service as any).ensureDownloaded('/cache/kepubify', 'kepubify-darwin-arm64', '/cache/dir');

      const calledUrl: string = fetchMock.mock.calls[0][0];
      expect(calledUrl).toContain('bookorbit/bookorbit-tools');
      expect(calledUrl).not.toContain('neonsolstice');
      expect(calledUrl).toContain('kepubify-darwin-arm64');
    });

    it('throws when download responds with a non-ok status', async () => {
      const service = makeService();
      statMock.mockRejectedValueOnce(new Error('ENOENT'));
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

      await expect((service as any).ensureDownloaded('/cache/kepubify', 'kepubify-linux-64bit', '/cache/dir')).rejects.toThrow(
        'Failed to download kepubify: HTTP 404',
      );
      expect(writeFileMock).not.toHaveBeenCalled();
    });

    it('throws when download responds with a 503', async () => {
      const service = makeService();
      statMock.mockRejectedValueOnce(new Error('ENOENT'));
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

      await expect((service as any).ensureDownloaded('/cache/kepubify', 'kepubify-linux-64bit', '/cache/dir')).rejects.toThrow(
        'Failed to download kepubify: HTTP 503',
      );
    });

    it('re-throws network-level fetch errors', async () => {
      const service = makeService();
      statMock.mockRejectedValueOnce(new Error('ENOENT'));
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')));

      await expect((service as any).ensureDownloaded('/cache/kepubify', 'kepubify-linux-64bit', '/cache/dir')).rejects.toThrow(
        'connect ECONNREFUSED',
      );
      expect(writeFileMock).not.toHaveBeenCalled();
    });
  });
});
