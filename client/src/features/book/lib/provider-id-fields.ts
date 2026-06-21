import { MetadataProviderKey, type MetadataProviderInfo } from '@bookorbit/types'

export const PROVIDER_ID_FIELDS = [
  { provider: MetadataProviderKey.GOOGLE, field: 'googleBooksId', label: 'Google Books' },
  { provider: MetadataProviderKey.GOODREADS, field: 'goodreadsId', label: 'Goodreads' },
  { provider: MetadataProviderKey.AMAZON, field: 'amazonId', label: 'Amazon' },
  { provider: MetadataProviderKey.HARDCOVER, field: 'hardcoverId', label: 'Hardcover' },
  { provider: MetadataProviderKey.OPEN_LIBRARY, field: 'openLibraryId', label: 'OpenLibrary' },
  { provider: MetadataProviderKey.ITUNES, field: 'itunesId', label: 'iTunes' },
  { provider: MetadataProviderKey.AUDIBLE, field: 'audibleId', label: 'Audible' },
  { provider: MetadataProviderKey.KOBO, field: 'koboId', label: 'Kobo' },
  { provider: MetadataProviderKey.COMICVINE, field: 'comicvineId', label: 'ComicVine' },
  { provider: MetadataProviderKey.RANOBEDB, field: 'ranobedbId', label: 'RanobeDB' },
  { provider: MetadataProviderKey.LUBIMYCZYTAC, field: 'lubimyczytacId', label: 'LubimyCzytac' },
  { provider: MetadataProviderKey.ALADIN, field: 'aladinId', label: 'Aladin' },
] as const

export type ProviderIdField = (typeof PROVIDER_ID_FIELDS)[number]
export type ProviderIdFormField = ProviderIdField['field']

const PROVIDER_ID_FORM_FIELDS = new Set<string>(PROVIDER_ID_FIELDS.map((field) => field.field))
const PROVIDER_BY_FORM_FIELD = new Map<ProviderIdFormField, MetadataProviderKey>(PROVIDER_ID_FIELDS.map((field) => [field.field, field.provider]))

export function isProviderIdFormField(field: string): field is ProviderIdFormField {
  return PROVIDER_ID_FORM_FIELDS.has(field)
}

export function isProviderIdFieldAvailable(field: ProviderIdFormField, providers: readonly Pick<MetadataProviderInfo, 'key'>[] | null): boolean {
  if (providers === null) return true
  const provider = PROVIDER_BY_FORM_FIELD.get(field)
  return provider ? providers.some((item) => item.key === provider) : true
}

export function filterProviderIdFields(providers: readonly Pick<MetadataProviderInfo, 'key'>[] | null): ProviderIdField[] {
  return PROVIDER_ID_FIELDS.filter((field) => isProviderIdFieldAvailable(field.field, providers))
}
