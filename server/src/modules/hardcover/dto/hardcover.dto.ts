import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

import type { ApplyHardcoverImportPayload } from '@bookorbit/types';

export class UpsertHardcoverSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  apiToken?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  autoSyncOnStatusChange?: boolean;

  @IsOptional()
  @IsBoolean()
  autoSyncOnProgressUpdate?: boolean;

  @IsOptional()
  @IsBoolean()
  autoSyncOnRatingChange?: boolean;

  @IsOptional()
  @IsInt()
  @IsIn([1, 2, 3])
  privacySettingId?: number;
}

export class ValidateHardcoverTokenDto {
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  token?: string;
}

export class ApplyHardcoverImportDto implements ApplyHardcoverImportPayload {
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(10000)
  @IsInt({ each: true })
  @Min(1, { each: true })
  hardcoverUserBookIds?: number[];

  @IsOptional()
  @IsBoolean()
  importProgress?: boolean;
}
