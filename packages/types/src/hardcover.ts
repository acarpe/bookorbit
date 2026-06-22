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

export type HardcoverImportMatchMethod = "hardcover_id" | "isbn" | "title_author";

export type HardcoverImportPreviewOutcome = "will_update" | "needs_review" | "conflict" | "unmatched" | "skipped";

export type HardcoverImportProgressOutcome = "will_update" | "conflict" | "skipped";

export type HardcoverImportedReadStatus = Exclude<import("./book").ReadStatus, "rereading" | "skimmed" | "unread"> | "want_to_read";

export interface HardcoverImportPreviewRow {
  hardcoverUserBookId: number;
  hardcoverBookId: number;
  hardcoverEditionId: number | null;
  hardcoverReadId: number | null;
  hardcoverTitle: string | null;
  hardcoverAuthors: string[];
  hardcoverStatusId: number;
  hardcoverStatusLabel: string;
  importedStatus: HardcoverImportedReadStatus | null;
  importedStartedAt: string | null;
  importedFinishedAt: string | null;
  importedProgressPercent: number | null;
  localBookId: number | null;
  localPrimaryFileId: number | null;
  localTitle: string | null;
  localAuthors: string[];
  localReadStatus: import("./book").ReadStatus | null;
  localProgressPercent: number | null;
  matchMethod: HardcoverImportMatchMethod | null;
  confidence: number | null;
  outcome: HardcoverImportPreviewOutcome;
  reason: string;
  progressOutcome: HardcoverImportProgressOutcome;
  progressReason: string;
}

export interface HardcoverImportSummary {
  totalHardcoverBooks: number;
  matchedBooks: number;
  willUpdate: number;
  needsReview: number;
  conflicts: number;
  unmatched: number;
  skipped: number;
  progressWillUpdate: number;
  progressConflicts: number;
  progressSkipped: number;
}

export interface HardcoverImportPreview {
  summary: HardcoverImportSummary;
  rows: HardcoverImportPreviewRow[];
}

export interface ApplyHardcoverImportPayload {
  hardcoverUserBookIds?: number[];
  importProgress?: boolean;
}

export interface HardcoverImportApplyResult extends HardcoverImportSummary {
  applied: number;
  progressApplied: number;
  failed: number;
}
