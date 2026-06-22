import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HardcoverActiveSyncStatus } from '@bookorbit/types'

type ApiFn = (input: RequestInfo | URL, init?: RequestInit & { _isRetry?: boolean }) => Promise<Response>
type SyncStatusCallback = (status: HardcoverActiveSyncStatus | null) => void

vi.mock('@/lib/api', () => ({
  api: vi.fn<ApiFn>(),
}))

import { api } from '@/lib/api'
import {
  applyHardcoverImport,
  cancelHardcoverSync,
  disconnectHardcover,
  fetchHardcoverSettings,
  fetchHardcoverSyncPendingSummary,
  fetchHardcoverSyncStatus,
  previewHardcoverImport,
  startHardcoverSync,
  streamHardcoverSyncStatus,
  upsertHardcoverSettings,
  validateHardcoverToken,
} from '../hardcover.api'

const mockApi = vi.mocked(api)

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: vi.fn<() => Promise<unknown>>().mockResolvedValue(body),
  } as unknown as Response
}

describe('hardcover.api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches and saves settings', async () => {
    mockApi.mockResolvedValueOnce(jsonResponse({ tokenConfigured: true })).mockResolvedValueOnce(jsonResponse({ enabled: true }))

    await expect(fetchHardcoverSettings()).resolves.toEqual({ tokenConfigured: true })
    await expect(upsertHardcoverSettings({ enabled: true })).resolves.toEqual({ enabled: true })

    expect(mockApi).toHaveBeenNthCalledWith(1, '/api/v1/hardcover/settings')
    expect(mockApi).toHaveBeenNthCalledWith(
      2,
      '/api/v1/hardcover/settings',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ enabled: true }),
      }),
    )
  })

  it('disconnects and validates tokens', async () => {
    mockApi.mockResolvedValueOnce(jsonResponse(null)).mockResolvedValueOnce(jsonResponse({ valid: true, hardcoverUsername: 'neon' }))

    await expect(disconnectHardcover()).resolves.toBeUndefined()
    await expect(validateHardcoverToken('tok')).resolves.toEqual({ valid: true, hardcoverUsername: 'neon' })

    expect(mockApi).toHaveBeenNthCalledWith(1, '/api/v1/hardcover/settings', { method: 'DELETE' })
    expect(mockApi).toHaveBeenNthCalledWith(
      2,
      '/api/v1/hardcover/validate-token',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'tok' }),
      }),
    )
  })

  it('starts, cancels, and reads sync status', async () => {
    mockApi
      .mockResolvedValueOnce(jsonResponse({ runId: 42 }))
      .mockResolvedValueOnce(jsonResponse(null))
      .mockResolvedValueOnce(jsonResponse({ runId: 42, syncedBooks: 1, totalBooks: 2, status: 'running' }))
      .mockResolvedValueOnce(jsonResponse({ totalBooks: 10, pendingBooks: 3 }))

    await expect(startHardcoverSync()).resolves.toEqual({ runId: 42 })
    await expect(cancelHardcoverSync()).resolves.toBeUndefined()
    await expect(fetchHardcoverSyncStatus()).resolves.toEqual({ runId: 42, syncedBooks: 1, totalBooks: 2, status: 'running' })
    await expect(fetchHardcoverSyncPendingSummary()).resolves.toEqual({ totalBooks: 10, pendingBooks: 3 })
  })

  it('returns null or empty summaries for non-ok status endpoints', async () => {
    mockApi.mockResolvedValueOnce(jsonResponse({}, false)).mockResolvedValueOnce(jsonResponse({}, false))

    await expect(fetchHardcoverSyncStatus()).resolves.toBeNull()
    await expect(fetchHardcoverSyncPendingSummary()).resolves.toEqual({ totalBooks: 0, pendingBooks: 0 })
  })

  it('previews and applies Hardcover import payloads', async () => {
    mockApi
      .mockResolvedValueOnce(jsonResponse({ summary: { willUpdate: 1 }, rows: [] }))
      .mockResolvedValueOnce(jsonResponse({ applied: 1, failed: 0 }))

    await expect(previewHardcoverImport()).resolves.toEqual({ summary: { willUpdate: 1 }, rows: [] })
    await expect(applyHardcoverImport({ hardcoverUserBookIds: [1000], importProgress: true })).resolves.toEqual({ applied: 1, failed: 0 })

    expect(mockApi).toHaveBeenNthCalledWith(1, '/api/v1/hardcover/import/preview', { method: 'POST' })
    expect(mockApi).toHaveBeenNthCalledWith(
      2,
      '/api/v1/hardcover/import/apply',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ hardcoverUserBookIds: [1000], importProgress: true }),
      }),
    )
  })

  it('surfaces server messages for import failures', async () => {
    mockApi
      .mockResolvedValueOnce(jsonResponse({ message: 'No token' }, false))
      .mockResolvedValueOnce(jsonResponse({ message: 'Apply failed' }, false))

    await expect(previewHardcoverImport()).rejects.toThrow('No token')
    await expect(applyHardcoverImport()).rejects.toThrow('Apply failed')
  })

  it('uses default messages when import failure bodies do not include a message', async () => {
    mockApi
      .mockResolvedValueOnce(jsonResponse({}, false))
      .mockResolvedValueOnce(jsonResponse({}, false))
      .mockResolvedValueOnce(jsonResponse({}, false))

    await expect(startHardcoverSync()).rejects.toThrow('Failed to start sync')
    await expect(previewHardcoverImport()).rejects.toThrow('Failed to preview Hardcover import')
    await expect(applyHardcoverImport()).rejects.toThrow('Failed to import Hardcover read status')
  })

  it('streams sync status events', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"activeSyncStatus":{"runId":1,"syncedBooks":0,"totalBooks":2,"status":"running"}}\n\n'))
        controller.enqueue(new TextEncoder().encode('data: malformed\n\n'))
        controller.close()
      },
    })
    mockApi.mockResolvedValueOnce({ ok: true, body: stream } as Response)
    const onStatus = vi.fn<SyncStatusCallback>()

    await streamHardcoverSyncStatus(onStatus)

    expect(onStatus).toHaveBeenCalledWith({ runId: 1, syncedBooks: 0, totalBooks: 2, status: 'running' })
    expect(onStatus).toHaveBeenCalledTimes(1)
  })

  it('streams fragmented events and ignores event blocks without data lines', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: ping\n\n'))
        controller.enqueue(new TextEncoder().encode('data: {"activeSyncStatus":'))
        controller.enqueue(new TextEncoder().encode('null}\n\n'))
        controller.close()
      },
    })
    mockApi.mockResolvedValueOnce({ ok: true, body: stream } as Response)
    const onStatus = vi.fn<SyncStatusCallback>()

    await streamHardcoverSyncStatus(onStatus)

    expect(onStatus).toHaveBeenCalledWith(null)
    expect(onStatus).toHaveBeenCalledTimes(1)
  })

  it('throws when required API calls fail without a server message', async () => {
    mockApi
      .mockResolvedValueOnce(jsonResponse({}, false))
      .mockResolvedValueOnce(jsonResponse({}, false))
      .mockResolvedValueOnce(jsonResponse({}, false))
      .mockResolvedValueOnce(jsonResponse({}, false))
      .mockResolvedValueOnce({ ok: false, body: null } as Response)

    await expect(fetchHardcoverSettings()).rejects.toThrow('Failed to fetch Hardcover settings')
    await expect(upsertHardcoverSettings({ enabled: true })).rejects.toThrow('Failed to save settings')
    await expect(disconnectHardcover()).rejects.toThrow('Failed to disconnect Hardcover')
    await expect(validateHardcoverToken()).rejects.toThrow('Failed to validate token')
    await expect(streamHardcoverSyncStatus(vi.fn<SyncStatusCallback>())).rejects.toThrow('Failed to stream Hardcover sync status')
  })

  it('surfaces start sync failures with server messages', async () => {
    mockApi.mockResolvedValueOnce(jsonResponse({ message: 'Already running' }, false))

    await expect(startHardcoverSync()).rejects.toThrow('Already running')
  })
})
