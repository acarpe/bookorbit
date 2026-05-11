import { chmod, mkdir, stat, writeFile } from 'fs/promises';
import { join } from 'path';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const KEPUBIFY_BASE_URL = 'https://github.com/bookorbit/bookorbit-tools/raw/main/kepubify/';

@Injectable()
export class KepubifyBinaryService {
  private readonly logger = new Logger(KepubifyBinaryService.name);
  private readonly appDataPath: string;
  private readonly bundledBinDir: string;
  private cachedBinaryPath: string | null = null;

  constructor(private readonly config: ConfigService) {
    this.appDataPath = this.config.get<string>('storage.appDataPath')!;
    this.bundledBinDir = join(process.cwd(), 'bin', 'kepubify');
  }

  async getBinaryPath(): Promise<string> {
    if (this.cachedBinaryPath) return this.cachedBinaryPath;
    const binaryName = this.detectBinaryName();
    const binaryPath = await this.resolveBinaryPath(binaryName);
    this.cachedBinaryPath = binaryPath;
    return binaryPath;
  }

  private async resolveBinaryPath(binaryName: string): Promise<string> {
    const bundledPath = join(this.bundledBinDir, binaryName);
    try {
      await stat(bundledPath);
    } catch {
      // Not bundled (e.g. macOS dev) - fall back to download
      const toolsDir = join(this.appDataPath, '.tools', 'kepubify');
      const downloadPath = join(toolsDir, binaryName);
      await this.ensureDownloaded(downloadPath, binaryName, toolsDir);
      return downloadPath;
    }
    try {
      await chmod(bundledPath, 0o755);
    } catch {
      // Read-only filesystem (e.g. Docker with read_only: true) - permissions
      // are already set correctly by the Dockerfile, so this is safe to ignore.
    }
    return bundledPath;
  }

  private detectBinaryName(): string {
    const platform = process.platform;
    const arch = process.arch;
    if (platform === 'darwin') {
      return arch === 'arm64' ? 'kepubify-darwin-arm64' : 'kepubify-darwin-64bit';
    }
    if (platform === 'linux') {
      if (arch === 'arm64') return 'kepubify-linux-arm64';
      if (arch === 'arm') return 'kepubify-linux-arm';
      if (arch === 'x64') return 'kepubify-linux-64bit';
      return 'kepubify-linux-32bit';
    }
    throw new Error(`Unsupported platform for kepubify: ${platform} / ${arch}`);
  }

  private async ensureDownloaded(binaryPath: string, binaryName: string, toolsDir: string): Promise<void> {
    try {
      await stat(binaryPath);
      await chmod(binaryPath, 0o755);
      return;
    } catch {
      // Not cached - download
    }

    const url = `${KEPUBIFY_BASE_URL}${binaryName}`;
    const startedAt = Date.now();
    this.logger.log(`[kepubify.download] [start] binaryName=${binaryName} - downloading kepubify binary`);

    await mkdir(toolsDir, { recursive: true });

    let response: Response;
    try {
      response = await fetch(url);
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      this.logger.error(
        `[kepubify.download] [fail] binaryName=${binaryName} durationMs=${durationMs} errorClass=${(err as Error).constructor.name} error="${(err as Error).message}" - kepubify download failed`,
      );
      throw err;
    }

    if (!response.ok) {
      const durationMs = Date.now() - startedAt;
      this.logger.error(
        `[kepubify.download] [fail] binaryName=${binaryName} durationMs=${durationMs} errorClass=HttpError error="HTTP ${response.status}" - kepubify download failed`,
      );
      throw new Error(`Failed to download kepubify: HTTP ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    await writeFile(binaryPath, Buffer.from(buffer));
    await chmod(binaryPath, 0o755);

    this.logger.log(`[kepubify.download] [end] binaryName=${binaryName} durationMs=${Date.now() - startedAt} - downloaded kepubify binary`);
  }
}
