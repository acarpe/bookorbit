import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import type { AuthUser } from '@bookorbit/types'

vi.mock('@/features/auth/composables/useAuth', () => ({
  useAuth: vi.fn<() => unknown>(),
}))

vi.mock('@/lib/api', () => ({
  api: vi.fn<() => unknown>(),
}))

vi.mock('vue-sonner', () => ({
  toast: { error: vi.fn<() => void>(), success: vi.fn<() => void>() },
}))

import { useAuth } from '@/features/auth/composables/useAuth'
import { api } from '@/lib/api'
import { toast } from 'vue-sonner'

const mockUseAuth = vi.mocked(useAuth)
const mockApi = vi.mocked(api)
const mockToast = vi.mocked(toast)

function makeUser(settings: Record<string, unknown> = {}): AuthUser {
  return {
    id: 1,
    username: 'tester',
    name: 'Tester',
    email: undefined,
    active: true,
    isSuperuser: false,
    isDefaultPassword: false,
    settings,
    avatarUrl: null,
    provisioningMethod: 'local',
    permissions: [],
  }
}

function setupAuth(settings: Record<string, unknown> = {}) {
  const userRef = ref<AuthUser | null>(makeUser(settings))
  mockUseAuth.mockReturnValue({ user: userRef } as unknown as ReturnType<typeof useAuth>)
  return { userRef }
}

describe('useStatisticsConfig - persist', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
    mockApi.mockResolvedValue(new Response(null, { status: 200 }))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sends settings to PATCH /api/v1/users/me/settings', async () => {
    setupAuth()

    const { useStatisticsConfig } = await import('./useStatisticsConfig')
    const { init, toggleVisibility } = useStatisticsConfig()
    init()

    toggleVisibility('format-distribution')
    await vi.advanceTimersByTimeAsync(700)
    await flushPromises()

    expect(mockApi).toHaveBeenCalledWith(
      '/api/v1/users/me/settings',
      expect.objectContaining({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const body = JSON.parse((mockApi.mock.calls[0]![1] as { body: string }).body)
    expect(body).toHaveProperty('settings.statisticsConfig')
    expect(body.settings.statisticsConfig).toHaveProperty('charts')
    expect(body.settings.statisticsConfig).toHaveProperty('filters')
  })

  it('shows error toast when API call throws', async () => {
    setupAuth()
    mockApi.mockRejectedValueOnce(new Error('network error'))

    const { useStatisticsConfig } = await import('./useStatisticsConfig')
    const { init, toggleVisibility } = useStatisticsConfig()
    init()

    toggleVisibility('format-distribution')
    await vi.advanceTimersByTimeAsync(700)
    await flushPromises()

    expect(mockToast.error).toHaveBeenCalledWith('Failed to save chart configuration')
  })
})
