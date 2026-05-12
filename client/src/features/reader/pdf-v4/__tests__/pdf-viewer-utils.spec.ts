import { describe, expect, it } from 'vitest'
import { lookupAccentHex } from '../pdf-viewer-utils'

describe('lookupAccentHex', () => {
  const options = [
    { id: 'rose', label: 'Rose', color: '#e11d48' },
    { id: 'blue', label: 'Blue', color: '#2563eb' },
    { id: 'green', label: 'Green', color: '#16a34a' },
  ]

  it('returns color for matching accent id', () => {
    expect(lookupAccentHex('rose', options)).toBe('#e11d48')
  })

  it('returns color for another accent id', () => {
    expect(lookupAccentHex('green', options)).toBe('#16a34a')
  })

  it('returns fallback blue for unknown accent id', () => {
    expect(lookupAccentHex('unknown', options)).toBe('#3b82f6')
  })

  it('returns fallback blue for empty options', () => {
    expect(lookupAccentHex('rose', [])).toBe('#3b82f6')
  })
})
