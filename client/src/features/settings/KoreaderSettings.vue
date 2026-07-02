<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Download,
  Eye,
  EyeOff,
  Library,
  Link2,
  RefreshCw,
  Search,
  Smartphone,
  Trash2,
  User,
  X,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import type { BookCard, KoreaderManualHashLink, KoreaderUnmatchedBook } from '@bookorbit/types'
import SettingsPageHeader from './SettingsPageHeader.vue'
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import { copyToClipboard } from '@/lib/clipboard'
import { useKoreaderSync } from '@/features/koreader/composables/useKoreaderSync'
import { useGlobalSearch } from '@/features/book/composables/useGlobalSearch'

const props = withDefaults(defineProps<{ embedded?: boolean }>(), { embedded: false })

const {
  credentials,
  syncStatus,
  unmatchedBooks,
  manualHashLinks,
  loading,
  unmatchedLoading,
  manualLinksLoading,
  fetchSyncStatus,
  fetchUnmatchedBooks,
  fetchManualHashLinks,
  createCredentials,
  updateCredentials,
  deleteCredentials,
  getSyncUrl,
  downloadPluginPackage,
  linkUnmatchedBook,
  relinkManualHashLink,
  unlinkManualHashLink,
} = useKoreaderSync()

const error = ref<string | null>(null)
const showSetupForm = ref(false)
const newUsername = ref('')
const newPassword = ref('')
const creating = ref(false)
const showPassword = ref(false)
const deleteConfirmOpen = ref(false)
const helpOpen = ref(false)
const urlCopied = ref(false)
const selectedUnmatched = ref<KoreaderUnmatchedBook | null>(null)
const selectedManualLink = ref<KoreaderManualHashLink | null>(null)
const linkSearchQuery = ref('')
const linkingBookId = ref<number | null>(null)
const pendingLinkTarget = ref<BookCard | null>(null)
const unlinkConfirmLink = ref<KoreaderManualHashLink | null>(null)
const unlinkingHash = ref<string | null>(null)
const unmatchedPage = ref(1)
const unmatchedPageSize = 6
const {
  results: linkSearchResults,
  loading: linkSearchLoading,
  loadingMore: linkSearchLoadingMore,
  settled: linkSearchSettled,
  hasMore: linkSearchHasMore,
  loadMore: loadMoreLinkSearch,
  clear: clearLinkSearch,
} = useGlobalSearch(linkSearchQuery)

let urlCopiedTimer: ReturnType<typeof setTimeout> | null = null

onUnmounted(() => {
  if (urlCopiedTimer) clearTimeout(urlCopiedTimer)
})

const syncUrl = computed(() => getSyncUrl())
const hasCredentials = computed(() => !!credentials.value)
const deviceCount = computed(() => syncStatus.value?.devices.length ?? 0)
const totalSyncedBooks = computed(() => syncStatus.value?.totalSyncedBooks ?? 0)
const sweeps = computed(() => syncStatus.value?.sweeps ?? [])
const pluginTotals = computed(
  () =>
    syncStatus.value?.pluginTotals ?? {
      matchedBooks: 0,
      pageStatEvents: 0,
      annotations: 0,
      trashedAnnotations: 0,
      pendingDeletes: 0,
      failedPositions: 0,
      unmatchedBooks: 0,
    },
)
const latestPluginVersion = computed(() => syncStatus.value?.latestPluginVersion ?? null)
const pluginUpdateAvailable = computed(() => syncStatus.value?.pluginUpdateAvailable ?? false)
const latestPluginLabel = computed(() => (latestPluginVersion.value ? `Latest plugin: v${latestPluginVersion.value}` : 'Latest plugin unavailable'))
const pendingDeletes = computed(() => pluginTotals.value.pendingDeletes)
const failedPositions = computed(() => pluginTotals.value.failedPositions)
const unmatchedCount = computed(() => Math.max(pluginTotals.value.unmatchedBooks, unmatchedBooks.value.length))
const unmatchedTotalPages = computed(() => Math.max(1, Math.ceil(unmatchedBooks.value.length / unmatchedPageSize)))
const clampedUnmatchedPage = computed(() => Math.min(unmatchedPage.value, unmatchedTotalPages.value))
const pagedUnmatchedBooks = computed(() => {
  const start = (clampedUnmatchedPage.value - 1) * unmatchedPageSize
  return unmatchedBooks.value.slice(start, start + unmatchedPageSize)
})
const unmatchedPageStart = computed(() => (unmatchedBooks.value.length === 0 ? 0 : (clampedUnmatchedPage.value - 1) * unmatchedPageSize + 1))
const unmatchedPageEnd = computed(() => Math.min(clampedUnmatchedPage.value * unmatchedPageSize, unmatchedBooks.value.length))
const showUnmatchedPager = computed(() => unmatchedBooks.value.length > unmatchedPageSize)
const hasPluginActivity = computed(
  () =>
    sweeps.value.length > 0 ||
    pluginTotals.value.matchedBooks > 0 ||
    pluginTotals.value.pageStatEvents > 0 ||
    pluginTotals.value.annotations > 0 ||
    pluginTotals.value.trashedAnnotations > 0 ||
    pendingDeletes.value > 0 ||
    failedPositions.value > 0 ||
    unmatchedCount.value > 0,
)
const createDisabled = computed(() => creating.value || !newUsername.value || newPassword.value.length < 6)
const linkDialogOpen = computed(() => !!selectedUnmatched.value || !!selectedManualLink.value)
const selectedLinkHash = computed(() => selectedUnmatched.value?.hash ?? selectedManualLink.value?.hash ?? '')
const selectedLinkLabel = computed(() => {
  if (selectedUnmatched.value) return unmatchedBookTitle(selectedUnmatched.value)
  if (selectedManualLink.value) return manualLinkTitle(selectedManualLink.value)
  return ''
})
const selectedLinkSubtitle = computed(() => {
  if (selectedUnmatched.value) return unmatchedBookSubtitle(selectedUnmatched.value)
  if (selectedManualLink.value) return manualLinkSubtitle(selectedManualLink.value)
  return ''
})
const selectedLinkLastOpen = computed(() => selectedUnmatched.value?.lastOpen ?? selectedManualLink.value?.koreaderLastOpen ?? null)
const linkDialogTitle = computed(() => (selectedManualLink.value ? 'Change KOReader link' : 'Link KOReader book'))

watch(unmatchedTotalPages, (totalPages) => {
  if (unmatchedPage.value > totalPages) unmatchedPage.value = totalPages
})

function formatLastSync(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Unknown'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(dateStr))
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Unknown'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(dateStr))
}

function formatEpochSeconds(seconds: number | null | undefined): string {
  if (!seconds) return 'Unknown'
  return formatDateTime(new Date(seconds * 1000).toISOString())
}

function shortHash(hash: string): string {
  return hash.slice(0, 8)
}

function unmatchedBookTitle(book: KoreaderUnmatchedBook): string {
  return book.title?.trim() || `Unknown KOReader file ${shortHash(book.hash)}`
}

function unmatchedBookSubtitle(book: KoreaderUnmatchedBook): string {
  if (book.authors?.trim()) return book.authors
  return book.title?.trim() ? 'Unknown author' : 'No title or author reported'
}

function manualLinkTitle(link: KoreaderManualHashLink): string {
  return link.koreaderTitle?.trim() || `Unknown KOReader file ${shortHash(link.hash)}`
}

function manualLinkSubtitle(link: KoreaderManualHashLink): string {
  if (link.koreaderAuthors?.trim()) return link.koreaderAuthors
  return link.koreaderTitle?.trim() ? 'Unknown author' : 'No title or author reported'
}

function linkedBookTitle(link: KoreaderManualHashLink): string {
  return link.bookTitle?.trim() || `BookOrbit book #${link.bookId}`
}

function linkedBookAuthors(link: KoreaderManualHashLink): string {
  return link.bookAuthors.length > 0 ? link.bookAuthors.join(', ') : 'Unknown author'
}

function formatCount(value: number, singular: string, plural = `${singular}s`): string {
  return `${value} ${value === 1 ? singular : plural}`
}

function pluginUpdateText(updateAvailable: boolean | null): string {
  if (updateAvailable === true) return 'Update available'
  if (updateAvailable === false) return 'Up to date'
  return 'Version unknown'
}

function pluginUpdateClass(updateAvailable: boolean | null): string {
  if (updateAvailable === true) return 'border-primary/40 bg-primary/10 text-primary'
  if (updateAvailable === false) return 'border-border bg-muted text-muted-foreground'
  return 'border-border bg-background text-muted-foreground'
}

onMounted(async () => {
  try {
    await fetchSyncStatus()
    if (credentials.value) await Promise.all([fetchUnmatchedBooks(), fetchManualHashLinks()])
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load KOReader settings'
  }
})

async function handleCreate() {
  creating.value = true
  try {
    await createCredentials({ username: newUsername.value, password: newPassword.value })
    showSetupForm.value = false
    helpOpen.value = false
    newUsername.value = ''
    newPassword.value = ''
    toast.success('KOReader sync credentials created')
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Failed to create credentials')
  } finally {
    creating.value = false
  }
}

function handleShowSetupForm() {
  showSetupForm.value = true
}

function handleCancelSetup() {
  showSetupForm.value = false
}

function handleTogglePassword() {
  showPassword.value = !showPassword.value
}

function handleOpenDeleteConfirm() {
  deleteConfirmOpen.value = true
}

function handleCloseDeleteConfirm() {
  deleteConfirmOpen.value = false
}

function handleToggleHelp() {
  helpOpen.value = !helpOpen.value
}

async function handleToggleSync(newValue: boolean) {
  try {
    await updateCredentials({ syncEnabled: newValue })
    toast.success(`KOReader sync ${newValue ? 'enabled' : 'disabled'}`)
  } catch {
    toast.error('Failed to toggle sync')
  }
}

async function handleDelete() {
  try {
    await deleteCredentials()
    deleteConfirmOpen.value = false
    toast.success('KOReader credentials deleted')
  } catch {
    toast.error('Failed to delete credentials')
  }
}

async function handleCopyUrl() {
  const copied = await copyToClipboard(syncUrl.value)
  if (!copied) {
    toast.error('Failed to copy sync URL')
    return
  }

  urlCopied.value = true
  toast.success('Sync URL copied to clipboard')
  if (urlCopiedTimer) clearTimeout(urlCopiedTimer)
  urlCopiedTimer = setTimeout(() => {
    urlCopied.value = false
    urlCopiedTimer = null
  }, 2000)
}

async function handleRefresh() {
  try {
    await fetchSyncStatus()
    if (credentials.value) await Promise.all([fetchUnmatchedBooks(), fetchManualHashLinks()])
    toast.success('Sync status refreshed')
  } catch {
    toast.error('Failed to refresh')
  }
}

async function handleRefreshUnmatched() {
  try {
    await fetchUnmatchedBooks()
    unmatchedPage.value = 1
    toast.success('Unmatched KOReader books refreshed')
  } catch {
    toast.error('Failed to refresh unmatched books')
  }
}

function handlePreviousUnmatchedPage() {
  unmatchedPage.value = Math.max(1, clampedUnmatchedPage.value - 1)
}

function handleNextUnmatchedPage() {
  unmatchedPage.value = Math.min(unmatchedTotalPages.value, clampedUnmatchedPage.value + 1)
}

async function handleRefreshManualLinks() {
  try {
    await fetchManualHashLinks()
    toast.success('Manual KOReader links refreshed')
  } catch {
    toast.error('Failed to refresh manual links')
  }
}

function handleOpenLink(book: KoreaderUnmatchedBook) {
  selectedUnmatched.value = book
  selectedManualLink.value = null
  pendingLinkTarget.value = null
  clearLinkSearch()
  linkSearchQuery.value = book.title ?? ''
}

function handleOpenRelink(link: KoreaderManualHashLink) {
  selectedManualLink.value = link
  selectedUnmatched.value = null
  pendingLinkTarget.value = null
  clearLinkSearch()
  linkSearchQuery.value = link.koreaderTitle ?? link.bookTitle ?? ''
}

function handleCloseLink() {
  selectedUnmatched.value = null
  selectedManualLink.value = null
  pendingLinkTarget.value = null
  linkingBookId.value = null
  linkSearchQuery.value = ''
  clearLinkSearch()
}

function handleChooseLinkTarget(book: BookCard) {
  pendingLinkTarget.value = book
}

function handleClearLinkTarget() {
  pendingLinkTarget.value = null
}

async function handleLoadMoreLinkSearch() {
  await loadMoreLinkSearch()
}

async function handleConfirmLinkTarget() {
  if (!pendingLinkTarget.value || !selectedLinkHash.value) return
  const target = pendingLinkTarget.value
  linkingBookId.value = target.id
  try {
    if (selectedManualLink.value) {
      await relinkManualHashLink(selectedLinkHash.value, { bookId: target.id })
      toast.success('KOReader link updated')
    } else {
      await linkUnmatchedBook(selectedLinkHash.value, { bookId: target.id })
      toast.success('KOReader book linked')
    }
    handleCloseLink()
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Failed to link KOReader book')
  } finally {
    linkingBookId.value = null
  }
}

function handleOpenUnlink(link: KoreaderManualHashLink) {
  unlinkConfirmLink.value = link
}

function handleCloseUnlink() {
  unlinkConfirmLink.value = null
  unlinkingHash.value = null
}

async function handleUnlinkManualLink() {
  if (!unlinkConfirmLink.value) return
  unlinkingHash.value = unlinkConfirmLink.value.hash
  try {
    await unlinkManualHashLink(unlinkConfirmLink.value.hash)
    toast.success('KOReader link removed')
    handleCloseUnlink()
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Failed to unlink KOReader book')
  } finally {
    unlinkingHash.value = null
  }
}

function bookSearchSubtitle(book: BookCard): string {
  const authors = book.authors.length > 0 ? book.authors.join(', ') : 'Unknown author'
  const formats = book.files
    .map((file) => file.format)
    .filter(Boolean)
    .join(', ')
  return formats ? `${authors} - ${formats}` : authors
}

const downloadingPlugin = ref(false)

async function handleDownloadPlugin() {
  downloadingPlugin.value = true
  try {
    await downloadPluginPackage()
    toast.success('Plugin downloaded. Copy bookorbit.koplugin from the zip to koreader/plugins/ on your device.')
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Failed to download the plugin')
  } finally {
    downloadingPlugin.value = false
  }
}
</script>

<template>
  <SettingsPageHeader
    v-if="!props.embedded"
    class="hidden md:flex"
    title="KOReader Sync"
    subtitle="Browse your BookOrbit catalog in KOReader and sync progress, reading activity, highlights, and annotation changes."
  />
  <div v-if="!props.embedded" class="md:hidden px-1">
    <h1 class="text-xl font-semibold tracking-tight text-foreground">KOReader Sync</h1>
    <p
      class="mt-1 text-sm text-muted-foreground leading-5 overflow-hidden text-ellipsis [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]"
    >
      Browse your BookOrbit catalog in KOReader and sync progress, reading activity, highlights, and annotation changes.
    </p>
  </div>

  <div v-if="loading" class="mt-5 md:mt-0 border border-border rounded-lg px-5 py-8 bg-card text-sm text-muted-foreground shadow-xs">
    Loading KOReader settings...
  </div>
  <div v-else-if="error" class="border border-destructive/30 rounded-lg px-5 py-4 bg-card text-sm text-destructive shadow-xs">{{ error }}</div>
  <template v-else>
    <template v-if="!hasCredentials">
      <div v-if="!showSetupForm" class="border border-border rounded-lg px-5 py-8 bg-card text-center shadow-xs">
        <div class="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mx-auto mb-3">
          <BookOpen :size="18" class="text-muted-foreground/80" />
        </div>
        <p class="text-sm font-medium text-foreground">KOReader sync is not configured</p>
        <p class="text-xs text-muted-foreground mt-1 mb-4 max-w-sm mx-auto">
          Create one set of sync credentials, then use them with the BookOrbit KOReader plugin for browsing, downloads, progress, reading events,
          highlights, and deletes.
        </p>
        <button class="settings-btn-primary mx-auto min-h-10 justify-center" @click="handleShowSetupForm">
          <User :size="13" />
          Create credentials
        </button>
      </div>

      <div v-else class="border border-border rounded-lg p-4 md:p-5 bg-card space-y-4 shadow-xs">
        <p class="text-sm font-medium text-foreground">Create KOReader Sync Credentials</p>
        <p class="text-xs text-muted-foreground">These credentials authenticate your KOReader devices with BookOrbit.</p>
        <div>
          <label class="block text-xs font-medium text-muted-foreground mb-1.5">Username</label>
          <input v-model="newUsername" type="text" placeholder="e.g. myreader" class="input-field w-full" autocomplete="off" />
        </div>
        <div>
          <label class="block text-xs font-medium text-muted-foreground mb-1.5">Password</label>
          <div class="relative">
            <input
              v-model="newPassword"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Min 6 characters"
              class="input-field w-full pr-10"
              autocomplete="new-password"
            />
            <button class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" @click="handleTogglePassword">
              <EyeOff v-if="showPassword" :size="14" />
              <Eye v-else :size="14" />
            </button>
          </div>
        </div>
        <div class="hidden md:flex items-center gap-2 pt-1">
          <button class="settings-btn-primary" :disabled="createDisabled" @click="handleCreate">
            {{ creating ? 'Creating...' : 'Create' }}
          </button>
          <button class="settings-btn-outline" @click="handleCancelSetup">Cancel</button>
        </div>
        <div class="md:hidden sticky bottom-2 z-20 border border-border/60 bg-card/95 backdrop-blur rounded-lg px-3 py-2">
          <div class="flex items-center gap-2">
            <button class="settings-btn-primary flex-1 min-h-10 justify-center" :disabled="createDisabled" @click="handleCreate">
              {{ creating ? 'Creating...' : 'Create' }}
            </button>
            <button
              class="rounded-md border border-border px-3 min-h-10 text-sm text-foreground hover:bg-muted transition-colors"
              @click="handleCancelSetup"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="mb-8">
        <div class="flex items-center justify-between mb-3">
          <p class="settings-group-label mb-0">KOReader Status</p>
          <button class="settings-btn-outline" @click="handleRefresh">
            <RefreshCw :size="12" />
            Refresh
          </button>
        </div>
        <div class="border border-border rounded-lg overflow-hidden shadow-xs divide-y divide-border">
          <div class="flex flex-col gap-3 px-4 py-3.5 bg-card md:flex-row md:items-center md:justify-between md:px-5 md:py-4">
            <div class="min-w-0">
              <p class="settings-label">Progress sync</p>
              <p class="settings-hint">
                Allow KOReader devices to sync progress, reading activity, highlights, and annotation deletes with BookOrbit.
              </p>
            </div>
            <ToggleSwitch :model-value="credentials?.syncEnabled ?? false" class="self-start md:self-auto" @update:model-value="handleToggleSync" />
          </div>
          <div class="grid gap-3 px-4 py-4 bg-card md:grid-cols-2 lg:grid-cols-5 md:px-5">
            <div class="min-w-0">
              <p class="settings-label">Username</p>
              <p class="settings-hint font-mono truncate">{{ credentials?.username }}</p>
            </div>
            <div>
              <p class="settings-label">Last sync</p>
              <p class="settings-hint">{{ formatLastSync(syncStatus?.lastSyncAt ?? null) }}</p>
            </div>
            <div>
              <p class="settings-label">Synced books</p>
              <p class="settings-hint">{{ formatCount(totalSyncedBooks, 'book') }}</p>
            </div>
            <div>
              <p class="settings-label">Devices</p>
              <p class="settings-hint">{{ formatCount(deviceCount, 'device') }}</p>
            </div>
            <div>
              <p class="settings-label">Credentials created</p>
              <p class="settings-hint">{{ formatDate(credentials?.createdAt) }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="mb-8">
        <p class="settings-group-label">Setup</p>
        <div class="border border-border rounded-lg overflow-hidden shadow-xs divide-y divide-border">
          <div class="px-4 py-4 bg-card md:px-5">
            <div class="mb-2 flex items-center gap-2">
              <BookOpen :size="14" class="text-muted-foreground shrink-0" />
              <p class="settings-label">Plugin server URL</p>
            </div>
            <div class="flex flex-col gap-2 md:flex-row md:items-center">
              <input :value="syncUrl" readonly class="input-field flex-1 min-w-0 font-mono text-xs md:text-sm" />
              <button class="settings-btn-outline w-full min-h-10 justify-center md:w-auto md:min-h-0" @click="handleCopyUrl">
                <Check v-if="urlCopied" :size="12" />
                <Copy v-else :size="12" />
                {{ urlCopied ? 'Copied' : 'Copy URL' }}
              </button>
            </div>
          </div>
          <div class="flex flex-col gap-3 px-4 py-4 bg-card md:flex-row md:items-center md:justify-between md:px-5">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <p class="settings-label">Preconfigured BookOrbit plugin</p>
                <span
                  v-if="pluginUpdateAvailable"
                  class="rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                >
                  Update available
                </span>
              </div>
              <p class="settings-hint">
                Download a zip with the server URL and your sync login already configured. The plugin includes catalog browsing and sync. Copy the
                folder to
                <span class="font-mono text-foreground/70">koreader/plugins/</span> and restart KOReader.
              </p>
              <p class="settings-hint mt-1">{{ latestPluginLabel }}. Device updates run from the BookOrbit menu in KOReader.</p>
            </div>
            <button class="settings-btn-primary self-start md:self-auto" :disabled="downloadingPlugin" @click="handleDownloadPlugin">
              <Download :size="12" />
              {{ downloadingPlugin ? 'Preparing...' : 'Download Plugin' }}
            </button>
          </div>
        </div>
      </div>

      <div class="mb-8">
        <p class="settings-group-label">Devices</p>
        <div v-if="deviceCount === 0" class="border border-border rounded-lg px-5 py-8 bg-card text-center shadow-xs">
          <div class="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mx-auto mb-3">
            <Smartphone :size="18" class="text-muted-foreground/80" />
          </div>
          <p class="text-sm font-medium text-foreground">No devices have synced yet</p>
          <p class="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Install the BookOrbit plugin for full sync, or configure KOReader's stock progress sync for progress-only updates.
          </p>
        </div>
        <div v-else class="border border-border rounded-lg overflow-hidden shadow-xs divide-y divide-border">
          <div v-for="device in syncStatus?.devices ?? []" :key="device.deviceId" class="px-4 py-4 bg-card md:px-5">
            <div class="flex items-start gap-3">
              <div class="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0 border border-border">
                <Smartphone :size="16" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="settings-label truncate">{{ device.device }}</p>
                <div class="mt-1 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <p class="min-w-0">
                    Last sync: <span class="text-foreground/80">{{ formatLastSync(device.lastSyncAt) }}</span>
                  </p>
                  <p class="min-w-0 truncate">
                    Last book: <span class="text-foreground/80">{{ device.lastBookTitle ?? 'None yet' }}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="mb-8">
        <p class="settings-group-label">Plugin Activity</p>
        <div class="border border-border rounded-lg overflow-hidden shadow-xs divide-y divide-border">
          <div v-if="!hasPluginActivity" class="px-4 py-5 bg-card text-sm text-muted-foreground md:px-5">
            No plugin activity has been reported yet.
          </div>
          <div v-for="sweep in sweeps" :key="sweep.deviceId" class="px-4 py-4 bg-card md:px-5">
            <div class="flex items-start gap-3">
              <div class="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0 border border-border">
                <Smartphone :size="16" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="settings-label truncate">
                    {{ sweep.deviceModel }}
                    <span v-if="sweep.pluginVersion" class="font-normal text-muted-foreground"> v{{ sweep.pluginVersion }}</span>
                  </p>
                  <span class="rounded-md border px-2 py-0.5 text-[11px] font-medium" :class="pluginUpdateClass(sweep.updateAvailable)">
                    {{ pluginUpdateText(sweep.updateAvailable) }}
                  </span>
                </div>
                <p class="settings-hint mt-1">
                  Last full sync: {{ formatLastSync(sweep.lastSweepAt) }}
                  <span v-if="sweep.updateAvailable === true && sweep.latestPluginVersion"> - latest plugin v{{ sweep.latestPluginVersion }}</span>
                </p>
              </div>
            </div>
            <div class="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
              <div class="rounded-md border border-border bg-background px-3 py-2">
                <p class="font-medium text-foreground">{{ sweep.lastSweepBooksMatched }}</p>
                <p>Matched books</p>
              </div>
              <div class="rounded-md border border-border bg-background px-3 py-2">
                <p class="font-medium text-foreground">{{ sweep.lastSweepPageStats }}</p>
                <p>Reading events</p>
              </div>
              <div class="rounded-md border border-border bg-background px-3 py-2">
                <p class="font-medium text-foreground">{{ sweep.lastSweepAnnotations }}</p>
                <p>Highlights</p>
              </div>
            </div>
          </div>
          <div v-if="hasPluginActivity" class="px-4 py-4 bg-card md:px-5">
            <div class="flex items-center gap-2 mb-3">
              <Library :size="14" class="text-muted-foreground shrink-0" />
              <p class="settings-label">Synced totals</p>
            </div>
            <div class="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-5">
              <div class="rounded-md border border-border bg-background px-3 py-2">
                <p class="font-medium text-foreground">{{ pluginTotals.matchedBooks }}</p>
                <p>Matched books</p>
              </div>
              <div class="rounded-md border border-border bg-background px-3 py-2">
                <p class="font-medium text-foreground">{{ pluginTotals.pageStatEvents }}</p>
                <p>Reading events</p>
              </div>
              <div class="rounded-md border border-border bg-background px-3 py-2">
                <p class="font-medium text-foreground">{{ pluginTotals.annotations }}</p>
                <p>Highlights</p>
              </div>
              <div class="rounded-md border border-border bg-background px-3 py-2">
                <p class="font-medium text-foreground">{{ pluginTotals.trashedAnnotations }}</p>
                <p>Trashed highlights</p>
              </div>
              <div class="rounded-md border border-border bg-background px-3 py-2">
                <p class="font-medium text-foreground">{{ unmatchedCount }}</p>
                <p>Unmatched books</p>
              </div>
            </div>
            <div v-if="pendingDeletes > 0" class="mt-3 flex gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-foreground">
              <AlertTriangle :size="14" class="mt-0.5 shrink-0 text-muted-foreground" />
              <p>{{ formatCount(pendingDeletes, 'deleted highlight') }} awaiting KOReader plugin acknowledgement.</p>
            </div>
            <div v-if="failedPositions > 0" class="mt-3 flex gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-foreground">
              <AlertTriangle :size="14" class="mt-0.5 shrink-0 text-muted-foreground" />
              <p>{{ formatCount(failedPositions, 'highlight position') }} need attention.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="mb-8">
        <div class="flex items-center justify-between gap-3 mb-3">
          <p class="settings-group-label mb-0">Unmatched KOReader Books</p>
          <button class="settings-btn-outline" :disabled="unmatchedLoading" @click="handleRefreshUnmatched">
            <RefreshCw :size="12" />
            Refresh
          </button>
        </div>
        <div class="border border-border rounded-lg overflow-hidden shadow-xs divide-y divide-border">
          <div v-if="unmatchedLoading" class="px-4 py-5 bg-card text-sm text-muted-foreground md:px-5">Loading unmatched books...</div>
          <div v-else-if="unmatchedBooks.length === 0" class="px-4 py-5 bg-card text-sm text-muted-foreground md:px-5">
            No unmatched KOReader books.
          </div>
          <template v-else>
            <div v-for="book in pagedUnmatchedBooks" :key="book.hash" class="px-4 py-4 bg-card md:px-5">
              <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div class="min-w-0">
                  <p class="settings-label truncate">{{ unmatchedBookTitle(book) }}</p>
                  <p class="settings-hint truncate">{{ unmatchedBookSubtitle(book) }}</p>
                  <div class="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                    <p class="min-w-0 truncate">
                      Hash: <span class="font-mono text-foreground/75">{{ book.hash }}</span>
                    </p>
                    <p>
                      Last opened: <span class="text-foreground/75">{{ formatEpochSeconds(book.lastOpen) }}</span>
                    </p>
                    <p>
                      First seen: <span class="text-foreground/75">{{ formatDateTime(book.firstSeenAt) }}</span>
                    </p>
                    <p>
                      Last seen: <span class="text-foreground/75">{{ formatDateTime(book.lastSeenAt) }}</span>
                    </p>
                  </div>
                </div>
                <button class="settings-btn-primary self-start md:self-auto" @click="handleOpenLink(book)">
                  <Link2 :size="12" />
                  Link
                </button>
              </div>
            </div>
            <div
              v-if="showUnmatchedPager"
              class="flex flex-col gap-3 px-4 py-3 bg-card text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-5"
            >
              <p>Showing {{ unmatchedPageStart }}-{{ unmatchedPageEnd }} of {{ unmatchedBooks.length }}</p>
              <div class="flex flex-wrap items-center gap-2">
                <button class="settings-btn-outline" :disabled="clampedUnmatchedPage <= 1" @click="handlePreviousUnmatchedPage">
                  <ChevronLeft :size="12" />
                  Previous
                </button>
                <span class="min-w-20 text-center">Page {{ clampedUnmatchedPage }} of {{ unmatchedTotalPages }}</span>
                <button class="settings-btn-outline" :disabled="clampedUnmatchedPage >= unmatchedTotalPages" @click="handleNextUnmatchedPage">
                  Next
                  <ChevronRight :size="12" />
                </button>
              </div>
            </div>
          </template>
        </div>
      </div>

      <div class="mb-8">
        <div class="flex items-center justify-between gap-3 mb-3">
          <p class="settings-group-label mb-0">Manual KOReader Links</p>
          <button class="settings-btn-outline" :disabled="manualLinksLoading" @click="handleRefreshManualLinks">
            <RefreshCw :size="12" />
            Refresh
          </button>
        </div>
        <div class="border border-border rounded-lg overflow-hidden shadow-xs divide-y divide-border">
          <div v-if="manualLinksLoading" class="px-4 py-5 bg-card text-sm text-muted-foreground md:px-5">Loading manual links...</div>
          <div v-else-if="manualHashLinks.length === 0" class="px-4 py-5 bg-card text-sm text-muted-foreground md:px-5">
            No manual KOReader links.
          </div>
          <template v-else>
            <div v-for="link in manualHashLinks" :key="link.hash" class="px-4 py-4 bg-card md:px-5">
              <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div class="grid min-w-0 flex-1 gap-4 md:grid-cols-2">
                  <div class="min-w-0">
                    <p class="settings-label truncate">{{ manualLinkTitle(link) }}</p>
                    <p class="settings-hint truncate">{{ manualLinkSubtitle(link) }}</p>
                    <div class="mt-2 grid gap-1 text-xs text-muted-foreground">
                      <p class="min-w-0 truncate">
                        Hash: <span class="font-mono text-foreground/75">{{ link.hash }}</span>
                      </p>
                      <p>
                        Last opened: <span class="text-foreground/75">{{ formatEpochSeconds(link.koreaderLastOpen) }}</span>
                      </p>
                    </div>
                  </div>
                  <div class="min-w-0">
                    <p class="settings-label truncate">Linked to {{ linkedBookTitle(link) }}</p>
                    <p class="settings-hint truncate">{{ linkedBookAuthors(link) }}</p>
                    <div class="mt-2 grid gap-1 text-xs text-muted-foreground">
                      <p>
                        Linked: <span class="text-foreground/75">{{ formatDateTime(link.createdAt) }}</span>
                      </p>
                      <p>
                        Updated: <span class="text-foreground/75">{{ formatDateTime(link.updatedAt) }}</span>
                      </p>
                    </div>
                  </div>
                </div>
                <div class="flex gap-2 self-start">
                  <button class="settings-btn-outline" @click="handleOpenRelink(link)">
                    <Link2 :size="12" />
                    Change
                  </button>
                  <button
                    class="flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                    @click="handleOpenUnlink(link)"
                  >
                    <Trash2 :size="12" />
                    Unlink
                  </button>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <div class="mb-8">
        <p class="settings-group-label">Setup Guide</p>
        <div class="border border-border rounded-lg bg-card shadow-xs">
          <button class="w-full flex items-center justify-between gap-2 px-4 py-4 text-left md:px-5" @click="handleToggleHelp">
            <div class="flex-1 min-w-0">
              <p class="settings-label">KOReader setup steps</p>
              <p class="settings-hint">
                Use the BookOrbit plugin for catalog browsing, downloads, progress, reading events, and highlights. Use the stock plugin for progress
                only.
              </p>
            </div>
            <ChevronUp v-if="helpOpen" :size="14" class="text-muted-foreground shrink-0" />
            <ChevronDown v-else :size="14" class="text-muted-foreground shrink-0" />
          </button>
          <div v-if="helpOpen" class="border-t border-border px-4 py-4 space-y-4 text-xs text-muted-foreground md:px-5">
            <div>
              <p class="font-medium text-foreground/80 mb-2">BookOrbit plugin</p>
              <ol class="list-decimal list-inside space-y-2 pl-1">
                <li>Download the preconfigured plugin above.</li>
                <li>
                  Unzip it and copy <span class="font-mono text-foreground/70">bookorbit.koplugin</span> to
                  <span class="font-mono text-foreground/70">koreader/plugins/</span> on your device.
                </li>
                <li>Restart KOReader. The server and login are configured automatically.</li>
                <li>Open <span class="font-mono text-foreground/70">Browse BookOrbit</span> to search, download, and link books to sync.</li>
              </ol>
            </div>
            <div>
              <p class="font-medium text-foreground/80 mb-2">Stock progress sync plugin</p>
              <ol class="list-decimal list-inside space-y-2 pl-1">
                <li>On your KOReader device, go to <span class="font-mono text-foreground/70">Tools &gt; Progress sync</span>.</li>
                <li>Set the custom sync server to the URL shown above.</li>
                <li>Enter the username and password you created, then tap Login.</li>
              </ol>
            </div>
            <div class="flex gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
              <Calendar :size="14" class="mt-0.5 shrink-0 text-muted-foreground" />
              <p>
                BookOrbit saves KOReader-compatible EPUB locations from the web reader. Restore should land close to the same position, though exact
                line placement can vary by reader and EPUB layout.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="mb-6">
        <p class="settings-group-label">Danger Zone</p>
        <div class="border border-destructive/30 rounded-lg overflow-hidden shadow-xs">
          <div class="flex flex-col gap-3 px-4 py-4 bg-card md:flex-row md:items-center md:justify-between md:px-5">
            <div class="min-w-0">
              <p class="settings-label">Delete KOReader credentials</p>
              <p class="settings-hint">Remove sync credentials and disconnect all devices. Progress data will be retained.</p>
            </div>
            <button
              class="self-start md:self-auto flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors shrink-0"
              @click="handleOpenDeleteConfirm"
            >
              <Trash2 :size="12" />
              Delete
            </button>
          </div>
        </div>
      </div>
    </template>

    <div
      v-if="deleteConfirmOpen"
      class="fixed inset-0 z-[70] flex items-end justify-center md:items-center md:px-4"
      @click.self="handleCloseDeleteConfirm"
    >
      <button class="absolute inset-0 bg-black/45" @click="handleCloseDeleteConfirm" />
      <div class="relative w-full rounded-t-lg border border-border bg-card p-4 shadow-xl md:max-w-md md:rounded-lg md:p-5">
        <p class="text-base font-semibold text-foreground">Delete KOReader credentials?</p>
        <p class="mt-1 text-sm text-muted-foreground">
          This will remove your sync credentials and disconnect all KOReader devices. Existing progress data will be kept.
        </p>
        <div class="mt-4 flex items-center justify-end gap-2">
          <button
            class="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
            @click="handleCloseDeleteConfirm"
          >
            Cancel
          </button>
          <button
            class="rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
            @click="handleDelete"
          >
            Delete
          </button>
        </div>
      </div>
    </div>

    <div v-if="unlinkConfirmLink" class="fixed inset-0 z-[70] flex items-end justify-center md:items-center md:px-4" @click.self="handleCloseUnlink">
      <button class="absolute inset-0 bg-black/45" @click="handleCloseUnlink" />
      <div class="relative w-full rounded-t-lg border border-border bg-card p-4 shadow-xl md:max-w-md md:rounded-lg md:p-5">
        <p class="text-base font-semibold text-foreground">Unlink KOReader book?</p>
        <p class="mt-1 text-sm text-muted-foreground">
          Future syncs for this hash will stop resolving to {{ linkedBookTitle(unlinkConfirmLink) }} until it is linked again. Already synced stats
          will stay on their current BookOrbit book.
        </p>
        <div class="mt-4 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <p class="font-mono text-foreground/75 truncate">{{ unlinkConfirmLink.hash }}</p>
          <p class="mt-1 truncate">{{ manualLinkTitle(unlinkConfirmLink) }}</p>
        </div>
        <div class="mt-4 flex items-center justify-end gap-2">
          <button
            class="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
            @click="handleCloseUnlink"
          >
            Cancel
          </button>
          <button
            class="rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
            :disabled="unlinkingHash !== null"
            @click="handleUnlinkManualLink"
          >
            {{ unlinkingHash === unlinkConfirmLink.hash ? 'Unlinking...' : 'Unlink' }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="linkDialogOpen"
      class="fixed inset-0 z-[70] flex items-end justify-center md:items-center md:px-4"
      @click.self="handleCloseLink"
      @keydown.esc="handleCloseLink"
    >
      <button class="absolute inset-0 bg-black/45" @click="handleCloseLink" />
      <div class="relative w-full rounded-t-lg border border-border bg-card p-4 shadow-xl md:max-w-2xl md:rounded-lg md:p-5">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-base font-semibold text-foreground">{{ linkDialogTitle }}</p>
            <p class="mt-1 text-sm text-muted-foreground truncate">{{ selectedLinkLabel }}</p>
          </div>
          <button class="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" @click="handleCloseLink">
            <X :size="16" />
          </button>
        </div>
        <div class="mt-4">
          <label class="block text-xs font-medium text-muted-foreground mb-1.5">BookOrbit book</label>
          <div class="relative">
            <Search :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              v-model="linkSearchQuery"
              type="search"
              class="input-field w-full pl-9"
              autocomplete="off"
              placeholder="Search your BookOrbit library"
            />
          </div>
        </div>
        <div class="mt-4 max-h-[55vh] overflow-y-auto rounded-md border border-border divide-y divide-border">
          <div v-if="linkSearchQuery.trim().length < 2" class="px-3 py-4 text-sm text-muted-foreground">Enter at least 2 characters.</div>
          <div v-else-if="linkSearchLoading" class="px-3 py-4 text-sm text-muted-foreground">Searching...</div>
          <div v-else-if="linkSearchSettled && linkSearchResults.length === 0" class="px-3 py-4 text-sm text-muted-foreground">No books found.</div>
          <template v-else>
            <button
              v-for="book in linkSearchResults"
              :key="book.id"
              class="flex w-full items-start justify-between gap-3 px-3 py-3 text-left hover:bg-muted/70 disabled:opacity-60"
              :disabled="linkingBookId !== null"
              @click="handleChooseLinkTarget(book)"
            >
              <span class="min-w-0">
                <span class="block text-sm font-medium text-foreground truncate">{{ book.title ?? 'Untitled book' }}</span>
                <span class="block text-xs text-muted-foreground truncate">{{ bookSearchSubtitle(book) }}</span>
              </span>
              <span class="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                {{ pendingLinkTarget?.id === book.id ? 'Selected' : 'Select' }}
              </span>
            </button>
            <button
              v-if="linkSearchHasMore"
              class="flex w-full items-center justify-center gap-2 px-3 py-3 text-sm font-medium text-foreground hover:bg-muted/70 disabled:opacity-60"
              :disabled="linkSearchLoadingMore"
              @click="handleLoadMoreLinkSearch"
            >
              <ChevronDown :size="14" />
              {{ linkSearchLoadingMore ? 'Loading...' : 'Load more' }}
            </button>
          </template>
        </div>
        <div v-if="pendingLinkTarget" class="mt-4 rounded-md border border-border bg-muted/30 p-3">
          <p class="text-sm font-medium text-foreground">Confirm KOReader link</p>
          <div class="mt-3 grid gap-3 md:grid-cols-2">
            <div class="min-w-0 rounded-md border border-border bg-background px-3 py-2">
              <p class="text-xs font-medium text-muted-foreground">KOReader</p>
              <p class="mt-1 text-sm font-medium text-foreground truncate">{{ selectedLinkLabel }}</p>
              <p class="text-xs text-muted-foreground truncate">{{ selectedLinkSubtitle }}</p>
              <p class="mt-1 text-xs text-muted-foreground">
                Last opened: <span class="text-foreground/75">{{ formatEpochSeconds(selectedLinkLastOpen) }}</span>
              </p>
              <p class="mt-1 font-mono text-xs text-muted-foreground truncate">{{ selectedLinkHash }}</p>
            </div>
            <div class="min-w-0 rounded-md border border-border bg-background px-3 py-2">
              <p class="text-xs font-medium text-muted-foreground">BookOrbit</p>
              <p class="mt-1 text-sm font-medium text-foreground truncate">{{ pendingLinkTarget.title ?? 'Untitled book' }}</p>
              <p class="text-xs text-muted-foreground truncate">{{ bookSearchSubtitle(pendingLinkTarget) }}</p>
              <p class="mt-1 text-xs text-muted-foreground">Book ID: {{ pendingLinkTarget.id }}</p>
            </div>
          </div>
          <div class="mt-3 flex gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
            <AlertTriangle :size="14" class="mt-0.5 shrink-0" />
            <p>Already synced stats will stay on their current BookOrbit book.</p>
          </div>
          <div class="mt-3 flex items-center justify-end gap-2">
            <button
              class="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
              :disabled="linkingBookId !== null"
              @click="handleClearLinkTarget"
            >
              Choose different
            </button>
            <button class="settings-btn-primary" :disabled="linkingBookId !== null" @click="handleConfirmLinkTarget">
              {{ linkingBookId === pendingLinkTarget.id ? 'Saving...' : 'Confirm link' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </template>
</template>
