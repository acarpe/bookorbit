import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref, nextTick } from 'vue'

const mocks = vi.hoisted(() => ({
  api: vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(),
}))

vi.mock('@/lib/api', () => ({
  api: mocks.api,
}))

import { useBookReadingLog } from '../useBookReadingLog'

function makeResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as Response
}

function makeListResponse(items = [], total?: number) {
  return makeResponse({
    items,
    total: total ?? items.length,
    page: 1,
    pageSize: 25,
    stats: { totalSessions: 0, totalSeconds: 0, avgDurationSeconds: 0, firstSessionAt: null, lastSessionAt: null, dailySummary: [] },
  })
}

describe('useBookReadingLog', () => {
  beforeEach(() => {
    mocks.api.mockReset()
    mocks.api.mockResolvedValue(makeListResponse())
  })

  it('fetches sessions immediately on mount', async () => {
    const bookId = ref(10)
    useBookReadingLog(bookId)
    await nextTick()
    await nextTick()
    expect(mocks.api).toHaveBeenCalledWith(expect.stringContaining('/api/v1/books/10/sessions'))
  })

  it('updates sessions and stats after fetch', async () => {
    const session = {
      id: 1,
      startedAt: '2026-04-15T10:00:00.000Z',
      endedAt: '2026-04-15T10:30:00.000Z',
      durationSeconds: 1800,
      progressDelta: null,
      endProgress: null,
      format: 'epub',
    }
    mocks.api.mockResolvedValue(
      makeResponse({
        items: [session],
        total: 1,
        page: 1,
        pageSize: 25,
        stats: {
          totalSessions: 1,
          totalSeconds: 1800,
          avgDurationSeconds: 1800,
          firstSessionAt: session.startedAt,
          lastSessionAt: session.startedAt,
          dailySummary: [],
        },
      }),
    )

    const bookId = ref(10)
    const { sessions, total, stats } = useBookReadingLog(bookId)
    await nextTick()
    await nextTick()

    expect(sessions.value).toHaveLength(1)
    expect(total.value).toBe(1)
    expect(stats.value?.totalSessions).toBe(1)
  })

  it('re-fetches when bookId changes', async () => {
    const bookId = ref(10)
    useBookReadingLog(bookId)
    await nextTick()
    await nextTick()

    mocks.api.mockClear()
    mocks.api.mockResolvedValue(makeListResponse())

    bookId.value = 20
    await nextTick()
    await nextTick()

    expect(mocks.api).toHaveBeenCalledWith(expect.stringContaining('/api/v1/books/20/sessions'))
  })

  it('sets error when fetch fails', async () => {
    mocks.api.mockRejectedValue(new Error('network error'))

    const bookId = ref(10)
    const { error } = useBookReadingLog(bookId)
    await nextTick()
    await nextTick()

    expect(error.value).toContain('network error')
  })

  it('deleteSession removes item optimistically then refetches', async () => {
    const session = {
      id: 1,
      startedAt: '2026-04-15T10:00:00.000Z',
      endedAt: '2026-04-15T10:30:00.000Z',
      durationSeconds: 1800,
      progressDelta: null,
      endProgress: null,
      format: null,
    }
    mocks.api
      .mockResolvedValueOnce(
        makeResponse({
          items: [session],
          total: 1,
          page: 1,
          pageSize: 25,
          stats: { totalSessions: 1, totalSeconds: 1800, avgDurationSeconds: 1800, firstSessionAt: null, lastSessionAt: null, dailySummary: [] },
        }),
      )
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => null } as Response)
      .mockResolvedValueOnce(makeListResponse())

    const bookId = ref(10)
    const { sessions, deleteSession } = useBookReadingLog(bookId)
    await nextTick()
    await nextTick()

    await deleteSession(1)
    await nextTick()

    expect(sessions.value).toHaveLength(0)
  })

  it('deleteSession rolls back sessions and total on error', async () => {
    const session = {
      id: 1,
      startedAt: '2026-04-15T10:00:00.000Z',
      endedAt: '2026-04-15T10:30:00.000Z',
      durationSeconds: 1800,
      progressDelta: null,
      endProgress: null,
      format: null,
    }
    mocks.api
      .mockResolvedValueOnce(
        makeResponse({
          items: [session],
          total: 5,
          page: 1,
          pageSize: 25,
          stats: { totalSessions: 5, totalSeconds: 0, avgDurationSeconds: 0, firstSessionAt: null, lastSessionAt: null, dailySummary: [] },
        }),
      )
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => null } as Response)

    const bookId = ref(10)
    const { sessions, total, error, deleteSession } = useBookReadingLog(bookId)
    await nextTick()
    await nextTick()

    expect(total.value).toBe(5)
    await deleteSession(1)

    expect(sessions.value).toHaveLength(1)
    expect(total.value).toBe(5)
    expect(error.value).toBeTruthy()
  })

  it('setFilters resets page to 1 and includes dateFrom in request', async () => {
    mocks.api.mockResolvedValue(makeListResponse())

    const bookId = ref(10)
    const { setFilters } = useBookReadingLog(bookId)
    await nextTick()
    await nextTick()

    mocks.api.mockClear()
    mocks.api.mockResolvedValue(makeListResponse())

    setFilters({ dateFrom: '2026-01-01T00:00:00.000Z' })
    await nextTick()
    await nextTick()

    const url = mocks.api.mock.calls[0]?.[0] as string
    expect(url).toContain('dateFrom=')
    expect(url).toContain('page=1')
  })

  it('setSort resets page to 1 and sorts by new column', async () => {
    mocks.api.mockResolvedValue(makeListResponse())

    const bookId = ref(10)
    const { setSort, page } = useBookReadingLog(bookId)
    await nextTick()
    await nextTick()

    mocks.api.mockClear()
    mocks.api.mockResolvedValue(makeListResponse())

    setSort('durationSeconds', 'asc')
    await nextTick()
    await nextTick()

    expect(page.value).toBe(1)
    const url = mocks.api.mock.calls[0]?.[0] as string
    expect(url).toContain('sortBy=durationSeconds')
    expect(url).toContain('sortDir=asc')
  })

  it('setPage changes page and fetches', async () => {
    mocks.api.mockResolvedValue(makeListResponse())

    const bookId = ref(10)
    const { setPage, page } = useBookReadingLog(bookId)
    await nextTick()
    await nextTick()

    mocks.api.mockClear()
    mocks.api.mockResolvedValue(makeListResponse())

    setPage(3)
    await nextTick()
    await nextTick()

    expect(page.value).toBe(3)
    const url = mocks.api.mock.calls[0]?.[0] as string
    expect(url).toContain('page=3')
  })

  it('loading is true while fetching and false after', async () => {
    let resolve: (v: Response) => void
    const pending = new Promise<Response>((r) => {
      resolve = r
    })
    mocks.api.mockReturnValueOnce(pending)

    const bookId = ref(10)
    const { loading } = useBookReadingLog(bookId)
    await nextTick()

    expect(loading.value).toBe(true)

    resolve!(makeListResponse())
    await nextTick()
    await nextTick()

    expect(loading.value).toBe(false)
  })
})
