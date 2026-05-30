import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { computed, ref } from 'vue'
import AppearanceSettings from '../AppearanceSettings.vue'

const userState = {
  settings: { syncThemePreferences: false } as Record<string, unknown>,
}

const permissionState = { isDemo: false }

const apiMock = vi.fn<(...args: unknown[]) => Promise<{ ok: boolean; json?: () => Promise<unknown> }>>()
const loadFromServerMock = vi.fn<() => Promise<void>>()
const seedToServerMock = vi.fn<(...args: unknown[]) => Promise<void>>()

const themeStore = {
  theme: 'dark',
  accent: 'blue',
  radius: 'rounded',
  background: 'vinyl',
  brightness: 35,
  toggleTheme: vi.fn<() => void>(),
  setTheme: vi.fn<(theme: string) => void>(),
  setAccent: vi.fn<(accent: string) => void>(),
  setRadius: vi.fn<(radius: string) => void>(),
  setBackground: vi.fn<(background: string) => void>(),
  setBrightness: vi.fn<(brightness: number) => void>(),
}

vi.mock('@/features/auth/composables/useAuth', () => ({
  useAuth: () => {
    const user = ref({ ...userState, settings: { ...userState.settings } })
    return { user }
  },
}))

vi.mock('@/features/auth/composables/usePermissions', () => ({
  usePermissions: () => ({
    isDemoRestrictedAccount: computed(() => permissionState.isDemo),
  }),
}))

vi.mock('@/lib/api', () => ({
  api: (...args: unknown[]) => apiMock(...args),
}))

vi.mock('@/composables/useThemeSync', () => ({
  loadFromServer: () => loadFromServerMock(),
  seedToServer: (...args: unknown[]) => seedToServerMock(...args),
}))

vi.mock('@/stores/theme', () => ({
  ACCENT_VIVID: [{ id: 'blue', label: 'Blue', color: '#0000ff' }],
  ACCENT_PASTEL: [{ id: 'grey', label: 'Grey', color: '#999999' }],
  RADIUS_OPTIONS: [{ id: 'rounded', label: 'Rounded', className: 'rounded-lg' }],
  BACKGROUND_OPTIONS: [{ id: 'vinyl', label: 'Vinyl', previewClass: 'bg-muted' }],
  useThemeStore: () => themeStore,
}))

vi.mock('@/composables/useDisplaySettings', () => ({
  useDisplaySettings: () => ({
    portraitCoverSize: ref(180),
    squareCoverSize: ref(180),
    coverSizeScope: ref('separate'),
    portraitGridGap: ref(12),
    squareGridGap: ref(12),
    cardOverlays: ref([]),
    smartScopeFilterExpanded: ref(false),
    authorCoverSize: ref(120),
    authorCoverShape: ref('portrait'),
    tableZebraStriping: ref(true),
    bookSpineOverlay: ref('off'),
    bookShadowStrength: ref('default'),
  }),
}))

vi.mock('@/features/book/composables/useSeriesCollapsePreference', () => ({
  useSeriesCollapsePreference: () => ({
    prefs: ref({ global: false }),
    setPreference: vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: { template: '<div><slot /></div>' },
  TooltipContent: { template: '<div><slot /></div>' },
  TooltipTrigger: { template: '<div><slot /></div>', props: ['asChild'] },
}))

vi.mock('@/components/ui/ToggleSwitch.vue', () => ({
  default: { template: '<div />', props: ['modelValue', 'label', 'description'] },
}))

vi.mock('../SettingsPageHeader.vue', () => ({
  default: { template: '<div />' },
}))

vi.mock('vue-sonner', () => ({
  toast: { success: vi.fn<() => void>(), error: vi.fn<() => void>() },
}))

import { toast } from 'vue-sonner'

function mountComponent() {
  return mount(AppearanceSettings)
}

describe('AppearanceSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    permissionState.isDemo = false
    userState.settings = { syncThemePreferences: false }
    apiMock.mockResolvedValue({ ok: true, json: async () => ({ settings: null }) })
  })

  it('shows This device only as active when theme sync is disabled', () => {
    const wrapper = mountComponent()

    const cards = wrapper.findAll('.rounded-lg.border-2')
    const deviceCard = cards[0]!
    expect(deviceCard.classes()).toContain('border-primary')
    expect(deviceCard.text()).toContain('Active')
  })

  it('shows My account as active when theme sync is enabled', () => {
    userState.settings = { syncThemePreferences: true }
    const wrapper = mountComponent()

    const cards = wrapper.findAll('.rounded-lg.border-2')
    const accountCard = cards[1]!
    expect(accountCard.classes()).toContain('border-primary')
    expect(accountCard.text()).toContain('Active')
  })

  it('enabling account sync seeds current local preferences when no server row exists', async () => {
    apiMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) }).mockResolvedValueOnce({ ok: true, json: async () => ({ settings: null }) })

    const wrapper = mountComponent()
    const cards = wrapper.findAll('.rounded-lg.border-2')
    await cards[1]!.trigger('click')
    await flushPromises()

    expect(apiMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/users/me/theme-storage-mode',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ sync: true }) }),
    )
    expect(apiMock).toHaveBeenNthCalledWith(2, '/api/v1/user-preferences/theme')
    expect(seedToServerMock).toHaveBeenCalledWith({
      theme: 'dark',
      accent: 'blue',
      radius: 'rounded',
      background: 'vinyl',
      brightness: 35,
    })
    expect(loadFromServerMock).not.toHaveBeenCalled()
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Preferences will now be synced')
  })

  it('enabling account sync loads existing server preferences when a row already exists', async () => {
    apiMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ settings: { theme: 'light' } }) })

    const wrapper = mountComponent()
    const cards = wrapper.findAll('.rounded-lg.border-2')
    await cards[1]!.trigger('click')
    await flushPromises()

    expect(loadFromServerMock).toHaveBeenCalled()
    expect(seedToServerMock).not.toHaveBeenCalled()
  })

  it('switching back to This device only calls the storage mode endpoint with sync false', async () => {
    userState.settings = { syncThemePreferences: true }
    const wrapper = mountComponent()

    const cards = wrapper.findAll('.rounded-lg.border-2')
    await cards[0]!.trigger('click')
    await flushPromises()

    expect(apiMock).toHaveBeenCalledWith(
      '/api/v1/users/me/theme-storage-mode',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ sync: false }) }),
    )
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Preferences will stay on this device')
  })

  it('shows an error toast when the storage mode update fails', async () => {
    apiMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    const wrapper = mountComponent()

    const cards = wrapper.findAll('.rounded-lg.border-2')
    await cards[1]!.trigger('click')
    await flushPromises()

    expect(vi.mocked(toast.error)).toHaveBeenCalledWith('Failed to update storage mode')
  })

  it('demo-restricted users cannot enable account sync', async () => {
    permissionState.isDemo = true
    const wrapper = mountComponent()

    const cards = wrapper.findAll('.rounded-lg.border-2')
    await cards[1]!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Not available')
    expect(apiMock).not.toHaveBeenCalled()
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith('Demo-restricted account cannot change theme storage mode')
  })
})
