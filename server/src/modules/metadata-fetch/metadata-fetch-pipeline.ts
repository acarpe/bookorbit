import { Injectable, Logger } from '@nestjs/common';
import {
  AudiobookChapter,
  ComicMetadataFields,
  FieldPreference,
  MetadataCandidate,
  MetadataFetchDiagnostics,
  MetadataFetchPreferences,
  MetadataField,
  MetadataProviderKey,
  ProviderConfigurations,
} from '@bookorbit/types';
import { firstValueFrom, toArray } from 'rxjs';

import { MetadataPreferenceResolver } from '../metadata-preferences/metadata-preference-resolver';
import { ProviderConfigService } from '../metadata-preferences/provider-config.service';
import { MetadataPreferencesService } from '../metadata-preferences/metadata-preferences.service';
import { createGenreBlocklistTokenSet, filterGenresAgainstBlocklist } from '../../common/utils/genre-blocklist.utils';
import { MetadataFetchService } from './metadata-fetch.service';
import { ProviderRegistry } from './provider-registry';
import { ProviderThrottleTracker } from './provider-throttle.tracker';
import { MetadataSearchParams } from './providers/metadata-search-params';

export type ResolvedMetadataFields = Partial<Record<MetadataField, string | string[] | number | null>> & {
  coverUrl?: string;
  chapters?: AudiobookChapter[];
  comicMetadata?: ComicMetadataFields;
};
type ResolvedProviderIds = Partial<Record<MetadataProviderKey, string>>;

type ProviderSelectionDiagnostics = Pick<
  MetadataFetchDiagnostics,
  'activeProviders' | 'fieldRuleProviders' | 'disabledFieldRuleProviders' | 'enabledUnreferencedProviders' | 'throttledProviders'
>;

@Injectable()
export class MetadataFetchPipeline {
  private readonly logger = new Logger(MetadataFetchPipeline.name);

  constructor(
    private readonly fetchService: MetadataFetchService,
    private readonly preferencesService: MetadataPreferencesService,
    private readonly resolver: MetadataPreferenceResolver,
    private readonly registry: ProviderRegistry,
    private readonly throttleTracker: ProviderThrottleTracker,
    private readonly providerConfig: ProviderConfigService,
  ) {}

  async run(
    params: MetadataSearchParams,
    existingFields: Partial<Record<MetadataField, unknown>>,
    libraryId?: number,
  ): Promise<ResolvedMetadataFields> {
    const { resolved } = await this.runInternal(params, existingFields, libraryId);
    return resolved;
  }

  async runWithSources(
    params: MetadataSearchParams,
    existingFields: Partial<Record<MetadataField, unknown>>,
    libraryId?: number,
  ): Promise<{
    resolved: ResolvedMetadataFields;
    sources: Record<string, string>;
    providerIds: ResolvedProviderIds;
    diagnostics: MetadataFetchDiagnostics;
  }> {
    return this.runInternal(params, existingFields, libraryId);
  }

  private async runInternal(
    params: MetadataSearchParams,
    existingFields: Partial<Record<MetadataField, unknown>>,
    libraryId?: number,
  ): Promise<{
    resolved: ResolvedMetadataFields;
    sources: Record<string, string>;
    providerIds: ResolvedProviderIds;
    diagnostics: MetadataFetchDiagnostics;
  }> {
    const [global, providerConfig] = await Promise.all([this.preferencesService.getGlobal(), this.providerConfig.getConfig()]);
    const overrides = libraryId ? (await this.preferencesService.getForLibrary(libraryId, global)).overrides : null;
    const registeredKeys = this.registry.all().map((p) => p.key) as MetadataProviderKey[];
    const preferences: MetadataFetchPreferences = this.resolver.withForwardCompatibility(this.resolver.resolve(global, overrides), registeredKeys);

    const providerSelection = this.deriveProviderSet(preferences, registeredKeys, providerConfig);
    const candidates = providerSelection.activeProviders.length
      ? await firstValueFrom(this.fetchService.search(params, providerSelection.activeProviders).pipe(toArray()), {
          defaultValue: [] as MetadataCandidate[],
        })
      : [];

    const byProvider = new Map<string, MetadataCandidate>();
    for (const c of candidates) {
      if (!byProvider.has(c.provider)) byProvider.set(c.provider, c);
    }
    const { resolved, sources, providerIds } = this.applyPreferences(preferences, byProvider, existingFields);
    const diagnostics = this.buildDiagnostics(providerSelection, candidates, resolved);
    return { resolved, sources, providerIds, diagnostics };
  }

  private deriveProviderSet(
    preferences: MetadataFetchPreferences,
    registeredKeys: MetadataProviderKey[],
    providerConfig: ProviderConfigurations,
  ): ProviderSelectionDiagnostics {
    const registered = new Set(registeredKeys);
    const fieldRuleProviders = new Set<MetadataProviderKey>();
    const configuredFieldRuleProviders = new Set<MetadataProviderKey>();
    const disabledFieldRuleProviders = new Set<MetadataProviderKey>();

    for (const [, fieldPreference] of Object.entries(preferences.fields) as [MetadataField, FieldPreference][]) {
      if (!fieldPreference.enabled) continue;
      for (const providerKey of fieldPreference.providers) {
        if (!registered.has(providerKey)) continue;
        fieldRuleProviders.add(providerKey);
        if (providerConfig[providerKey]?.enabled === false) {
          disabledFieldRuleProviders.add(providerKey);
        } else {
          configuredFieldRuleProviders.add(providerKey);
        }
      }
    }

    const activeProviders: MetadataProviderKey[] = [];
    const throttledProviders: MetadataProviderKey[] = [];
    for (const key of configuredFieldRuleProviders) {
      if (this.throttleTracker.isThrottled(key)) {
        throttledProviders.push(key);
        this.logger.warn(
          `[metadata_fetch.pipeline_provider] [fail] provider=${key} durationMs=0 errorClass=ProviderThrottleError error="provider is in cooldown" - provider skipped`,
        );
      } else {
        activeProviders.push(key);
      }
    }

    const enabledUnreferencedProviders = registeredKeys.filter(
      (providerKey) => providerConfig[providerKey]?.enabled !== false && !fieldRuleProviders.has(providerKey),
    );

    return {
      activeProviders,
      fieldRuleProviders: [...fieldRuleProviders],
      disabledFieldRuleProviders: [...disabledFieldRuleProviders],
      enabledUnreferencedProviders,
      throttledProviders,
    };
  }

  private buildDiagnostics(
    providerSelection: ProviderSelectionDiagnostics,
    candidates: MetadataCandidate[],
    resolved: ResolvedMetadataFields,
  ): MetadataFetchDiagnostics {
    const candidateProviders = [...new Set(candidates.map((candidate) => candidate.provider))];
    const resolvedFieldCount = Object.keys(resolved).length;

    let reason: MetadataFetchDiagnostics['reason'] = null;
    if (resolvedFieldCount === 0) {
      if (providerSelection.activeProviders.length === 0) {
        reason = providerSelection.throttledProviders.length > 0 ? 'providers_throttled' : 'no_active_providers';
      } else if (candidates.length === 0) {
        reason = 'no_candidates';
      } else {
        reason = 'no_resolved_fields';
      }
    }

    return {
      ...providerSelection,
      candidateProviders,
      candidateCount: candidates.length,
      resolvedFieldCount,
      reason,
    };
  }

  private applyPreferences(
    preferences: MetadataFetchPreferences,
    byProvider: Map<string, MetadataCandidate>,
    existing: Partial<Record<MetadataField, unknown>>,
  ): { resolved: ResolvedMetadataFields; sources: Record<string, string>; providerIds: ResolvedProviderIds } {
    const result: ResolvedMetadataFields = {};
    const sources: Record<string, string> = {};
    const blockedGenreTokens = createGenreBlocklistTokenSet(preferences.options?.genres.blocklist);

    for (const field of Object.keys(preferences.fields) as MetadataField[]) {
      const fieldPreference = preferences.fields[field];
      if (!fieldPreference.enabled) continue;

      if (field === 'genres' && preferences.options?.genres.mode === 'merge') {
        const { genres, sourceProvider } = this.mergeGenres(fieldPreference.providers as MetadataProviderKey[], byProvider, blockedGenreTokens);
        if (!genres.length) continue;

        const existingValue = existing[field];
        switch (fieldPreference.mergeStrategy) {
          case 'fillMissing':
            if (this.isMissing(existingValue)) {
              result.genres = genres;
              if (sourceProvider) sources.genres = sourceProvider;
            }
            break;
          case 'overwrite':
          case 'overwriteIfProvided':
            result.genres = genres;
            if (sourceProvider) sources.genres = sourceProvider;
            break;
        }
        continue;
      }

      for (const providerKey of fieldPreference.providers) {
        const candidate = byProvider.get(providerKey);
        if (!candidate) continue;

        let value = this.extractField(candidate, field);
        if (value === undefined || value === null) continue;

        if (field === 'cover') {
          result.coverUrl = candidate.coverUrl;
          sources['coverUrl'] = providerKey;
          break;
        }

        if (field === 'genres' && blockedGenreTokens.size > 0) {
          if (!Array.isArray(value)) continue;
          const filteredGenres = filterGenresAgainstBlocklist(value, blockedGenreTokens);
          if (!filteredGenres.length) continue;
          value = filteredGenres;
        }

        const existingValue = existing[field];
        switch (fieldPreference.mergeStrategy) {
          case 'fillMissing':
            if (this.isMissing(existingValue)) {
              (result as Record<string, unknown>)[field] = value;
              sources[field] = providerKey;
            }
            break;
          case 'overwrite':
          case 'overwriteIfProvided':
            (result as Record<string, unknown>)[field] = value;
            sources[field] = providerKey;
            break;
        }
        break;
      }
    }

    const providerIds: ResolvedProviderIds = {};
    if (preferences.options?.saveProviderIds) {
      for (const candidate of byProvider.values()) {
        if (candidate.providerId) providerIds[candidate.provider] = candidate.providerId;
      }
    }

    // Pass through chapters from the first candidate that has them, using the
    // narrators field's provider preference order as the authority for audiobook data.
    const narratorProviders = preferences.fields['narrators']?.providers ?? [];
    const chapterProviders = [...narratorProviders, ...byProvider.keys()];
    for (const providerKey of chapterProviders) {
      const candidate = byProvider.get(providerKey);
      if (candidate?.chapters?.length) {
        result.chapters = candidate.chapters;
        break;
      }
    }

    const comicMetadata = this.resolveComicMetadata(preferences, byProvider);
    if (comicMetadata) result.comicMetadata = comicMetadata;

    return { resolved: result, sources, providerIds };
  }

  private extractField(candidate: MetadataCandidate, field: MetadataField): unknown {
    const map: Partial<Record<MetadataField, keyof MetadataCandidate>> = {
      title: 'title',
      subtitle: 'subtitle',
      description: 'description',
      authors: 'authors',
      publisher: 'publisher',
      publishedYear: 'publishedYear',
      language: 'language',
      pageCount: 'pageCount',
      seriesName: 'seriesName',
      seriesIndex: 'seriesIndex',
      genres: 'genres',
      cover: 'coverUrl',
      narrators: 'narrators',
      duration: 'durationSeconds',
      abridged: 'abridged',
    };
    const key = map[field];
    return key ? candidate[key] : undefined;
  }

  private mergeGenres(providerKeys: MetadataProviderKey[], byProvider: Map<string, MetadataCandidate>, blockedGenreTokens: ReadonlySet<string>) {
    const merged: string[] = [];
    const seen = new Set<string>();
    let sourceProvider: MetadataProviderKey | undefined;

    for (const providerKey of providerKeys) {
      const candidate = byProvider.get(providerKey);
      if (!candidate?.genres?.length) continue;

      for (const genre of filterGenresAgainstBlocklist(candidate.genres, blockedGenreTokens)) {
        const token = genre.toLowerCase();
        if (seen.has(token)) continue;
        if (!sourceProvider) sourceProvider = providerKey;
        seen.add(token);
        merged.push(genre);
      }
    }

    return { genres: merged, sourceProvider };
  }

  private isMissing(value: unknown): boolean {
    if (value === null || value === undefined || value === '') return true;
    if (Array.isArray(value)) return value.length === 0;
    return false;
  }

  private resolveComicMetadata(preferences: MetadataFetchPreferences, byProvider: Map<string, MetadataCandidate>): ComicMetadataFields | undefined {
    const preferredProviders = [
      ...(preferences.fields.seriesName?.providers ?? []),
      ...(preferences.fields.title?.providers ?? []),
      ...byProvider.keys(),
    ] as MetadataProviderKey[];

    const seen = new Set<MetadataProviderKey>();
    for (const providerKey of preferredProviders) {
      if (seen.has(providerKey)) continue;
      seen.add(providerKey);

      const comicMetadata = byProvider.get(providerKey)?.comicMetadata;
      if (comicMetadata && this.hasComicMetadata(comicMetadata)) return comicMetadata;
    }
    return undefined;
  }

  private hasComicMetadata(comicMetadata: ComicMetadataFields): boolean {
    const scalarFields: (keyof ComicMetadataFields)[] = ['issueNumber', 'volumeName'];
    for (const field of scalarFields) {
      const value = comicMetadata[field];
      if (typeof value === 'string' && value.trim().length > 0) return true;
    }

    const arrayFields: (keyof ComicMetadataFields)[] = [
      'storyArcs',
      'pencillers',
      'inkers',
      'colorists',
      'letterers',
      'coverArtists',
      'characters',
      'teams',
      'locations',
    ];
    for (const field of arrayFields) {
      const value = comicMetadata[field];
      if (Array.isArray(value) && value.length > 0) return true;
    }
    return false;
  }
}
