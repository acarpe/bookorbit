import { ACCENT_IDS, BACKGROUND_IDS, RADIUS_IDS, THEME_IDS, type ThemePreferences } from '@bookorbit/types';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

import { sanitizeLogValue } from '../../common/utils/log-sanitize.utils';
import { UserPreferencesRepository } from './user-preferences.repository';

const THEME_PREFERENCES_SCHEMA = z
  .object({
    theme: z.enum(THEME_IDS),
    accent: z.enum(ACCENT_IDS),
    radius: z.enum(RADIUS_IDS),
    background: z.enum(BACKGROUND_IDS),
    brightness: z.number().int().min(0).max(100),
  })
  .strict();

@Injectable()
export class UserPreferencesService {
  private readonly logger = new Logger(UserPreferencesService.name);

  constructor(private readonly repo: UserPreferencesRepository) {}

  async getThemePreferences(userId: number): Promise<ThemePreferences | null> {
    const row = await this.repo.findByCategory(userId, 'theme');
    return row ? (row.data as ThemePreferences) : null;
  }

  async upsertThemePreferences(userId: number, data: Record<string, unknown>): Promise<void> {
    const start = Date.now();
    this.logger.log(`[user_preferences.upsert_theme] [start] userId=${userId} - upsert theme preferences started`);

    const result = THEME_PREFERENCES_SCHEMA.safeParse(data);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const issuePath = firstIssue?.path.length ? firstIssue.path.join('.') : 'settings';
      const issueMessage = firstIssue?.message ?? 'Invalid settings payload';
      throw new BadRequestException(`Invalid theme preferences at "${issuePath}": ${issueMessage}`);
    }

    try {
      await this.repo.upsert(userId, 'theme', result.data);
      const durationMs = Date.now() - start;
      this.logger.log(`[user_preferences.upsert_theme] [end] userId=${userId} durationMs=${durationMs} - upsert theme preferences completed`);
    } catch (err) {
      const durationMs = Date.now() - start;
      const errorClass = err instanceof Error ? err.constructor.name : 'UnknownError';
      const error = sanitizeLogValue(err instanceof Error ? err.message : String(err));
      this.logger.error(
        `[user_preferences.upsert_theme] [fail] userId=${userId} durationMs=${durationMs} errorClass=${errorClass} error="${error}" - upsert theme preferences failed`,
      );
      throw err;
    }
  }
}
