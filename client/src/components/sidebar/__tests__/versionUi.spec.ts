import { describe, expect, it } from 'vitest'

import { buildSidebarVersionUi } from '../versionUi'

describe('buildSidebarVersionUi', () => {
  it('builds a single current-tag link when no update is available', () => {
    const ui = buildSidebarVersionUi('v1.2.3', false, 'v1.3.0')

    expect(ui).toEqual({
      currentLabel: 'v1.2.3',
      currentHref: 'https://github.com/bookorbit/bookorbit/releases/tag/v1.2.3',
      showLatest: false,
      latestLabel: 'v1.3.0',
      latestHref: 'https://github.com/bookorbit/bookorbit/releases/tag/v1.3.0',
    })
  })

  it('shows both current and latest links when an update is available', () => {
    const ui = buildSidebarVersionUi('v1.2.3', true, 'v1.4.0')

    expect(ui.currentLabel).toBe('Current v1.2.3')
    expect(ui.currentHref).toBe('https://github.com/bookorbit/bookorbit/releases/tag/v1.2.3')
    expect(ui.showLatest).toBe(true)
    expect(ui.latestLabel).toBe('v1.4.0')
    expect(ui.latestHref).toBe('https://github.com/bookorbit/bookorbit/releases/tag/v1.4.0')
  })

  it('does not show latest when latestVersion is null', () => {
    const ui = buildSidebarVersionUi('v1.2.3', true, null)

    expect(ui.showLatest).toBe(false)
    expect(ui.currentLabel).toBe('v1.2.3')
  })

  it('does not show latest when latestVersion is blank after trimming', () => {
    const ui = buildSidebarVersionUi('v1.2.3', true, '   ')

    expect(ui.showLatest).toBe(false)
    expect(ui.currentLabel).toBe('v1.2.3')
    expect(ui.latestLabel).toBe('')
  })

  it('shows local build labels as-is', () => {
    const ui = buildSidebarVersionUi('Local build', null, null)

    expect(ui.currentLabel).toBe('Local build')
    expect(ui.currentHref).toBeNull()
  })

  it('trims version strings before building labels and URLs', () => {
    const ui = buildSidebarVersionUi('  v2.0.1  ', true, '  v2.1.0  ')

    expect(ui.currentLabel).toBe('Current v2.0.1')
    expect(ui.currentHref).toBe('https://github.com/bookorbit/bookorbit/releases/tag/v2.0.1')
    expect(ui.latestLabel).toBe('v2.1.0')
    expect(ui.latestHref).toBe('https://github.com/bookorbit/bookorbit/releases/tag/v2.1.0')
  })

  it('falls back latest link to /releases/latest for non-tag latest versions', () => {
    const ui = buildSidebarVersionUi('v1.2.3', true, 'main-abc123')

    expect(ui.showLatest).toBe(true)
    expect(ui.latestLabel).toBe('main-abc123')
    expect(ui.latestHref).toBe('https://github.com/bookorbit/bookorbit/releases/latest')
  })

  it('links sha versions to commits and does not enable latest mode', () => {
    const ui = buildSidebarVersionUi('sha-abc1234', true, 'v1.2.4')

    expect(ui.currentLabel).toBe('sha-abc1234')
    expect(ui.currentHref).toBe('https://github.com/bookorbit/bookorbit/commit/abc1234')
    expect(ui.showLatest).toBe(false)
  })

  it('does not enable latest mode for local builds', () => {
    const ui = buildSidebarVersionUi('Local build', true, 'v1.2.4')

    expect(ui.currentLabel).toBe('Local build')
    expect(ui.showLatest).toBe(false)
  })

  it('shortens long sha labels to 12 chars for readability', () => {
    const ui = buildSidebarVersionUi('sha-1234567890abcdef1234567890abcdef12345678', null, null)

    expect(ui.currentLabel).toBe('sha-1234567890ab')
    expect(ui.currentHref).toBe('https://github.com/bookorbit/bookorbit/commit/1234567890abcdef1234567890abcdef12345678')
  })

  it('links short sha versions to the matching commit page', () => {
    const ui = buildSidebarVersionUi('sha-1234567890ab', null, null)

    expect(ui.currentLabel).toBe('sha-1234567890ab')
    expect(ui.currentHref).toBe('https://github.com/bookorbit/bookorbit/commit/1234567890ab')
  })

  it('does not prefix current label when updateAvailable is null', () => {
    const ui = buildSidebarVersionUi('v1.2.3', null, 'v1.3.0')

    expect(ui.currentLabel).toBe('v1.2.3')
    expect(ui.showLatest).toBe(false)
  })

  it('suppresses latest presentation when current version is blank', () => {
    const ui = buildSidebarVersionUi('   ', true, 'v1.3.0')

    expect(ui.currentLabel).toBe('')
    expect(ui.showLatest).toBe(false)
  })
})
