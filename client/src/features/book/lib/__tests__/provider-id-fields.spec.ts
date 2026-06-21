import { describe, expect, it } from 'vitest'
import { MetadataProviderKey, type MetadataProviderInfo } from '@bookorbit/types'
import { filterProviderIdFields, isProviderIdFieldAvailable, isProviderIdFormField, type ProviderIdFormField } from '../provider-id-fields'

function provider(key: MetadataProviderKey): MetadataProviderInfo {
  return { key, label: key, identifiable: true }
}

describe('provider ID fields', () => {
  it('shows all provider ID fields while provider availability is unknown', () => {
    expect(filterProviderIdFields(null).map((field) => field.field)).toEqual([
      'googleBooksId',
      'goodreadsId',
      'amazonId',
      'hardcoverId',
      'openLibraryId',
      'itunesId',
      'audibleId',
      'koboId',
      'comicvineId',
      'ranobedbId',
      'lubimyczytacId',
      'aladinId',
    ])
  })

  it('filters provider ID fields to the effective provider set', () => {
    const fields = filterProviderIdFields([provider(MetadataProviderKey.KOBO), provider(MetadataProviderKey.COMICVINE)])

    expect(fields.map((field) => field.field)).toEqual(['koboId', 'comicvineId'])
  })

  it('reports provider ID field availability by mapped provider key', () => {
    const providers = [provider(MetadataProviderKey.GOOGLE)]

    expect(isProviderIdFieldAvailable('googleBooksId', providers)).toBe(true)
    expect(isProviderIdFieldAvailable('koboId', providers)).toBe(false)
    expect(isProviderIdFieldAvailable('futureProviderId' as ProviderIdFormField, providers)).toBe(true)
    expect(isProviderIdFormField('googleBooksId')).toBe(true)
    expect(isProviderIdFormField('title')).toBe(false)
  })
})
