export type HardcoverSyncDisabledReason = "permission_denied" | "missing_token" | "user_disabled";

export interface HardcoverSettings {
  tokenConfigured: boolean;
  enabled: boolean;
  effectiveEnabled: boolean;
  disabledReason: HardcoverSyncDisabledReason | null;
  autoSyncOnStatusChange: boolean;
  autoSyncOnProgressUpdate: boolean;
  autoSyncOnRatingChange: boolean;
  privacySettingId: number;
  lastSyncedAt: string | null;
}

export interface UpsertHardcoverSettingsPayload {
  apiToken?: string;
  enabled?: boolean;
  autoSyncOnStatusChange?: boolean;
  autoSyncOnProgressUpdate?: boolean;
  autoSyncOnRatingChange?: boolean;
  privacySettingId?: number;
}

export interface HardcoverTokenValidationResult {
  valid: boolean;
  hardcoverUsername?: string;
}

export type HardcoverSyncRunStatus = "running" | "completed" | "failed" | "cancelled";

export interface HardcoverSyncPendingSummary {
  totalBooks: number;
  pendingBooks: number;
}

export interface HardcoverActiveSyncStatus {
  runId: number;
  syncedBooks: number;
  totalBooks: number;
  status: HardcoverSyncRunStatus;
}

export type HardcoverPrivacySetting = 1 | 2 | 3;
