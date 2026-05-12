import { chmod, stat } from 'fs/promises';
import { join } from 'path';

import { Injectable } from '@nestjs/common';

@Injectable()
export class KepubifyBinaryService {
  private readonly bundledBinDir = join(process.cwd(), 'bin', 'kepubify');
  private cachedBinaryPath: string | null = null;

  async getBinaryPath(): Promise<string> {
    if (this.cachedBinaryPath) return this.cachedBinaryPath;
    const binaryName = this.detectBinaryName();
    const binaryPath = await this.resolveBinaryPath(binaryName);
    this.cachedBinaryPath = binaryPath;
    return binaryPath;
  }

  private async resolveBinaryPath(binaryName: string): Promise<string> {
    const bundledPath = join(this.bundledBinDir, binaryName);
    await stat(bundledPath);
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
}
