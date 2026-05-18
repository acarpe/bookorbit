import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFetch = vi.fn<(...args: any[]) => any>()
vi.mock('@/lib/api', () => ({
  api: (...args: unknown[]) => mockFetch(...args),
}))

import { useBookHighlights } from './useBookHighlights'

function makeListResponse(overrides?: Record<string, unknown>) {
  return {
    items: [
      {
        id: 1,
        bookId: 5,
        cfi: 'epubcfi(/6/4!/4/2/1:0)',
        text: 'highlighted text',
        color: '#FACC15',
        style: 'highlight',
        note: null,
        chapterTitle: 'Chapter 1',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    total: 1,
    page: 1,
    pageSize: 25,
    stats: {
      totalHighlights: 1,
      colorBreakdown: [{ color: '#FACC15', count: 1 }],
      chaptersWithHighlights: 1,
      highlightsWithNotes: 0,
      chapters: ['Chapter 1'],
    },
    ...overrides,
  }
}

function mockOkResponse(data: unknown) {
  return { ok: true, json: () => Promise.resolve(data) }
}

function mockErrorResponse(status = 500) {
  return { ok: false, status, json: () => Promise.resolve({}) }
}

describe('useBookHighlights', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches highlights on mount', async () => {
    const response = makeListResponse()
    mockFetch.mockResolvedValue(mockOkResponse(response))
    const bookId = ref(5)
    const { items, total, stats, loading } = useBookHighlights(bookId)

    await nextTick()
    await vi.waitFor(() => expect(loading.value).toBe(false))

    expect(items.value).toHaveLength(1)
    expect(total.value).toBe(1)
    expect(stats.value?.totalHighlights).toBe(1)
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/v1/books/5/annotations?'))
  })

  it('sets error on failed fetch', async () => {
    mockFetch.mockResolvedValue(mockErrorResponse())
    const bookId = ref(5)
    const { error, loading } = useBookHighlights(bookId)

    await nextTick()
    await vi.waitFor(() => expect(loading.value).toBe(false))

    expect(error.value).toBe('HTTP 500')
  })

  it('includes pagination params in URL', async () => {
    mockFetch.mockResolvedValue(mockOkResponse(makeListResponse()))
    const bookId = ref(5)
    useBookHighlights(bookId)

    await nextTick()
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled())

    const url = mockFetch.mock.calls[0]?.[0] as string
    expect(url).toContain('page=1')
    expect(url).toContain('pageSize=25')
    expect(url).toContain('sortBy=position')
    expect(url).toContain('sortDir=asc')
  })

  it('toggleColor adds and removes colors', async () => {
    mockFetch.mockResolvedValue(mockOkResponse(makeListResponse()))
    const bookId = ref(5)
    const { colors, toggleColor } = useBookHighlights(bookId)

    await nextTick()
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled())
    mockFetch.mockClear()

    toggleColor('#FACC15')
    expect(colors.value).toContain('#FACC15')

    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled())
    const url = mockFetch.mock.calls[0]?.[0] as string
    expect(url).toContain('colors=%23FACC15')

    mockFetch.mockClear()
    mockFetch.mockResolvedValue(mockOkResponse(makeListResponse()))
    toggleColor('#FACC15')
    expect(colors.value).not.toContain('#FACC15')
  })

  it('setSort changes sort params and resets page', async () => {
    mockFetch.mockResolvedValue(mockOkResponse(makeListResponse()))
    const bookId = ref(5)
    const { page, sortBy, sortDir, setSort } = useBookHighlights(bookId)

    await nextTick()
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled())
    mockFetch.mockClear()
    mockFetch.mockResolvedValue(mockOkResponse(makeListResponse()))

    setSort('createdAt', 'desc')

    expect(sortBy.value).toBe('createdAt')
    expect(sortDir.value).toBe('desc')
    expect(page.value).toBe(1)
  })

  it('setPage changes the page', async () => {
    mockFetch.mockResolvedValue(mockOkResponse(makeListResponse()))
    const bookId = ref(5)
    const { page, setPage } = useBookHighlights(bookId)

    await nextTick()
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled())
    mockFetch.mockClear()
    mockFetch.mockResolvedValue(mockOkResponse(makeListResponse()))

    setPage(3)

    expect(page.value).toBe(3)
  })

  it('setSearch updates search and resets page', async () => {
    mockFetch.mockResolvedValue(mockOkResponse(makeListResponse()))
    const bookId = ref(5)
    const { search, setSearch } = useBookHighlights(bookId)

    await nextTick()
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled())
    mockFetch.mockClear()
    mockFetch.mockResolvedValue(mockOkResponse(makeListResponse()))

    setSearch('freedom')

    expect(search.value).toBe('freedom')
  })

  it('updateNote patches annotation and updates items', async () => {
    const initial = makeListResponse()
    mockFetch.mockResolvedValue(mockOkResponse(initial))
    const bookId = ref(5)
    const { items, updateNote } = useBookHighlights(bookId)

    await nextTick()
    await vi.waitFor(() => expect(items.value).toHaveLength(1))
    mockFetch.mockClear()

    const updatedItem = { ...initial.items[0], note: 'my note' }
    mockFetch.mockResolvedValue(mockOkResponse(updatedItem))

    await updateNote(1, 'my note')

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/books/5/annotations/1', expect.objectContaining({ method: 'PATCH' }))
    expect(items.value[0]?.note).toBe('my note')
  })

  it('updateColor patches annotation color', async () => {
    const initial = makeListResponse()
    mockFetch.mockResolvedValue(mockOkResponse(initial))
    const bookId = ref(5)
    const { items, updateColor } = useBookHighlights(bookId)

    await nextTick()
    await vi.waitFor(() => expect(items.value).toHaveLength(1))
    mockFetch.mockClear()

    const updatedItem = { ...initial.items[0], color: '#4ADE80' }
    mockFetch.mockResolvedValue(mockOkResponse(updatedItem))

    await updateColor(1, '#4ADE80')

    expect(items.value[0]?.color).toBe('#4ADE80')
  })

  it('deleteHighlight removes item optimistically and refetches', async () => {
    const initial = makeListResponse()
    mockFetch.mockResolvedValue(mockOkResponse(initial))
    const bookId = ref(5)
    const { items, deleteHighlight } = useBookHighlights(bookId)

    await nextTick()
    await vi.waitFor(() => expect(items.value).toHaveLength(1))
    mockFetch.mockClear()

    mockFetch.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce(mockOkResponse(makeListResponse({ items: [], total: 0 })))

    await deleteHighlight(1)

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/books/5/annotations/1', expect.objectContaining({ method: 'DELETE' }))
  })

  it('deleteHighlight reverts on failure', async () => {
    const initial = makeListResponse()
    mockFetch.mockResolvedValue(mockOkResponse(initial))
    const bookId = ref(5)
    const { items, total, error, deleteHighlight } = useBookHighlights(bookId)

    await nextTick()
    await vi.waitFor(() => expect(items.value).toHaveLength(1))
    mockFetch.mockClear()

    mockFetch.mockResolvedValue(mockErrorResponse())

    await deleteHighlight(1)

    expect(items.value).toHaveLength(1)
    expect(total.value).toBe(1)
    expect(error.value).toBeTruthy()
  })

  it('resets state when bookId changes', async () => {
    const initial = makeListResponse()
    mockFetch.mockResolvedValue(mockOkResponse(initial))
    const bookId = ref(5)
    const { colors, search, chapter, page, toggleColor, setSearch, setChapter, setPage } = useBookHighlights(bookId)

    await nextTick()
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled())

    toggleColor('#FACC15')
    setSearch('test')
    setChapter('Chapter 1')
    setPage(3)

    mockFetch.mockClear()
    mockFetch.mockResolvedValue(mockOkResponse(makeListResponse()))

    bookId.value = 10

    await nextTick()

    expect(colors.value).toEqual([])
    expect(search.value).toBe('')
    expect(chapter.value).toBeUndefined()
    expect(page.value).toBe(1)
  })

  it('setDateRange updates date filters', async () => {
    mockFetch.mockResolvedValue(mockOkResponse(makeListResponse()))
    const bookId = ref(5)
    const { dateFrom, dateTo, setDateRange } = useBookHighlights(bookId)

    await nextTick()
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled())
    mockFetch.mockClear()
    mockFetch.mockResolvedValue(mockOkResponse(makeListResponse()))

    setDateRange('2026-01-01', '2026-06-01')

    expect(dateFrom.value).toBe('2026-01-01')
    expect(dateTo.value).toBe('2026-06-01')
  })
})
