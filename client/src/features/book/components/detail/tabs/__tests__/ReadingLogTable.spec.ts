import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ReadingLogTable from '../ReadingLogTable.vue'

function makeSession(overrides = {}) {
  return {
    id: 1,
    startedAt: '2026-04-15T10:00:00.000Z',
    endedAt: '2026-04-15T10:30:00.000Z',
    durationSeconds: 1800,
    progressDelta: 5.5,
    endProgress: 42.0,
    format: 'epub',
    ...overrides,
  }
}

function mountTable(props = {}) {
  return mount(ReadingLogTable, {
    props: {
      sessions: [makeSession()],
      total: 1,
      page: 1,
      pageSize: 25,
      sortBy: 'startedAt',
      sortDir: 'desc' as const,
      loading: false,
      hasMultipleFormats: false,
      ...props,
    },
  })
}

describe('ReadingLogTable', () => {
  it('renders rows from sessions prop', () => {
    const wrapper = mountTable()
    expect(wrapper.find('tbody').findAll('tr').length).toBeGreaterThan(0)
  })

  it('shows empty state when sessions is empty and not loading', () => {
    const wrapper = mountTable({ sessions: [], total: 0 })
    expect(wrapper.text()).toContain('No reading sessions recorded yet')
  })

  it('does not show edit inputs (edit mode removed)', () => {
    const wrapper = mountTable()
    expect(wrapper.find('input[type="datetime-local"]').exists()).toBe(false)
  })

  it('does not show edit pencil button (edit mode removed)', () => {
    const wrapper = mountTable()
    expect(wrapper.find('button[title="Edit"]').exists()).toBe(false)
  })

  it('first delete click enters confirm state', async () => {
    const wrapper = mountTable()
    const deleteBtn = wrapper.find('button[title="Delete"]')
    await deleteBtn.trigger('click')

    const confirmBtn = wrapper.find('button[title="Click again to confirm delete"]')
    expect(confirmBtn.exists()).toBe(true)
    expect(confirmBtn.text()).toContain('Confirm')
    expect(wrapper.find('button[title="Cancel delete"]').exists()).toBe(true)
  })

  it('second delete click emits deleteSession event', async () => {
    const wrapper = mountTable()
    const deleteBtn = wrapper.find('button[title="Delete"]')
    await deleteBtn.trigger('click')

    const confirmBtn = wrapper.find('button[title="Click again to confirm delete"]')
    await confirmBtn.trigger('click')

    expect(wrapper.emitted('deleteSession')).toBeTruthy()
    expect(wrapper.emitted('deleteSession')?.[0]).toEqual([1])
  })

  it('formats duration in h/m/s', () => {
    const wrapper = mountTable({ sessions: [makeSession({ durationSeconds: 3661 })] })
    expect(wrapper.text()).toContain('1h 1m 1s')
  })

  it('formats minutes-only duration correctly', () => {
    const wrapper = mountTable({ sessions: [makeSession({ durationSeconds: 125 })] })
    expect(wrapper.text()).toContain('2m 5s')
  })

  it('formats seconds-only duration correctly', () => {
    const wrapper = mountTable({ sessions: [makeSession({ durationSeconds: 45 })] })
    expect(wrapper.text()).toContain('45s')
  })

  it('shows progress delta with + prefix', () => {
    const wrapper = mountTable({ sessions: [makeSession({ progressDelta: 5.5 })] })
    expect(wrapper.text()).toContain('+5.5%')
  })

  it('shows "-" for null progressDelta', () => {
    const wrapper = mountTable({ sessions: [makeSession({ progressDelta: null })] })
    expect(wrapper.find('tbody').text()).toContain('-')
  })

  it('shows endProgress with % suffix', () => {
    const wrapper = mountTable({ sessions: [makeSession({ endProgress: 42.0 })] })
    expect(wrapper.text()).toContain('42.0%')
  })

  it('shows "-" for null endProgress', () => {
    const wrapper = mountTable({ sessions: [makeSession({ endProgress: null })] })
    expect(wrapper.find('tbody').text()).toContain('-')
  })

  it('does not show format column when hasMultipleFormats is false', () => {
    const wrapper = mountTable({ hasMultipleFormats: false })
    const headers = wrapper.findAll('th')
    const formatHeader = headers.find((h) => h.text() === 'Format')
    expect(formatHeader).toBeUndefined()
  })

  it('shows format column when hasMultipleFormats is true', () => {
    const wrapper = mountTable({ hasMultipleFormats: true })
    const headers = wrapper.findAll('th')
    const formatHeader = headers.find((h) => h.text().includes('Format'))
    expect(formatHeader).toBeDefined()
  })

  it('applies opacity class during loading instead of replacing rows', () => {
    const wrapper = mountTable({ loading: true })
    const tableContainer = wrapper.find('.overflow-x-auto')
    expect(tableContainer.classes()).toContain('opacity-50')
    expect(wrapper.find('tbody').findAll('tr').length).toBeGreaterThan(0)
  })

  it('does not apply opacity when not loading', () => {
    const wrapper = mountTable({ loading: false })
    const tableContainer = wrapper.find('.overflow-x-auto')
    expect(tableContainer.classes()).not.toContain('opacity-50')
  })

  it('sort header button emits sortChange with toggled direction', async () => {
    const wrapper = mountTable({ sortBy: 'startedAt', sortDir: 'asc' })
    const dateHeader = wrapper.find('thead button')
    await dateHeader.trigger('click')
    expect(wrapper.emitted('sortChange')?.[0]).toEqual(['startedAt', 'desc'])
  })

  it('sort header button emits asc when currently desc', async () => {
    const wrapper = mountTable({ sortBy: 'startedAt', sortDir: 'desc' })
    const dateHeader = wrapper.find('thead button')
    await dateHeader.trigger('click')
    expect(wrapper.emitted('sortChange')?.[0]).toEqual(['startedAt', 'asc'])
  })

  it('prev button emits pageChange with page-1', async () => {
    const wrapper = mountTable({ total: 30, page: 2, pageSize: 25 })
    const prevBtn = wrapper.findAll('button').find((b) => b.text() === 'Prev')
    expect(prevBtn).toBeDefined()
    await prevBtn!.trigger('click')
    expect(wrapper.emitted('pageChange')?.[0]).toEqual([1])
  })

  it('next button emits pageChange with page+1', async () => {
    const wrapper = mountTable({ total: 30, page: 1, pageSize: 25 })
    const nextBtn = wrapper.findAll('button').find((b) => b.text() === 'Next')
    await nextBtn!.trigger('click')
    expect(wrapper.emitted('pageChange')?.[0]).toEqual([2])
  })

  it('prev button is disabled on first page', () => {
    const wrapper = mountTable({ page: 1 })
    const prevBtn = wrapper.findAll('button').find((b) => b.text() === 'Prev')
    expect(prevBtn?.attributes('disabled')).toBeDefined()
  })

  it('next button is disabled on last page', () => {
    const wrapper = mountTable({ total: 1, page: 1, pageSize: 25 })
    const nextBtn = wrapper.findAll('button').find((b) => b.text() === 'Next')
    expect(nextBtn?.attributes('disabled')).toBeDefined()
  })

  it('shows pagination range correctly', () => {
    const wrapper = mountTable({ total: 50, page: 2, pageSize: 25 })
    expect(wrapper.text()).toContain('26-50 of 50')
  })

  it('clears confirm state when sessions prop changes', async () => {
    const session = makeSession({ id: 1 })
    const wrapper = mountTable({ sessions: [session] })
    const deleteBtn = wrapper.find('button[title="Delete"]')
    await deleteBtn.trigger('click')
    expect(wrapper.find('button[title="Click again to confirm delete"]').exists()).toBe(true)
    await wrapper.setProps({ sessions: [makeSession({ id: 2 })] })
    expect(wrapper.find('button[title="Click again to confirm delete"]').exists()).toBe(false)
  })

  it('clears confirm state when sort changes', async () => {
    const wrapper = mountTable()
    const deleteBtn = wrapper.find('button[title="Delete"]')
    await deleteBtn.trigger('click')
    expect(wrapper.find('button[title="Click again to confirm delete"]').exists()).toBe(true)
    const sortBtn = wrapper.find('thead button')
    await sortBtn.trigger('click')
    expect(wrapper.find('button[title="Click again to confirm delete"]').exists()).toBe(false)
  })

  it('clears confirm state when navigating to next page', async () => {
    const wrapper = mountTable({ total: 30, page: 1, pageSize: 25 })
    const deleteBtn = wrapper.find('button[title="Delete"]')
    await deleteBtn.trigger('click')
    expect(wrapper.find('button[title="Click again to confirm delete"]').exists()).toBe(true)
    const nextBtn = wrapper.findAll('button').find((b) => b.text() === 'Next')
    await nextBtn!.trigger('click')
    expect(wrapper.find('button[title="Click again to confirm delete"]').exists()).toBe(false)
  })

  it('clears confirm state when cancel delete is clicked', async () => {
    const wrapper = mountTable()
    const deleteBtn = wrapper.find('button[title="Delete"]')
    await deleteBtn.trigger('click')
    expect(wrapper.find('button[title="Click again to confirm delete"]').exists()).toBe(true)
    const cancelBtn = wrapper.find('button[title="Cancel delete"]')
    await cancelBtn.trigger('click')
    expect(wrapper.find('button[title="Click again to confirm delete"]').exists()).toBe(false)
    expect(wrapper.find('button[title="Delete"]').exists()).toBe(true)
  })
})
