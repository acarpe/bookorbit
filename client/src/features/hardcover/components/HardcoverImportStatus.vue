<script setup lang="ts">
import { computed, ref } from 'vue'
import { AlertCircle, CheckCircle2, Download, FileSearch, Loader2, Table2, XCircle } from '@lucide/vue'
import { toast } from 'vue-sonner'
import HardcoverImportReviewModal from './HardcoverImportReviewModal.vue'
import { useHardcoverImport } from '../composables/useHardcoverImport'
import { useHardcoverSettings } from '../composables/useHardcoverSettings'

const { settings } = useHardcoverSettings()
const { preview, result, previewing, applying, error, loadPreview, applyPreview, clearImport } = useHardcoverImport()

const reviewOpen = ref(false)
const importProgress = ref(true)

const importUnavailableReason = computed(() => {
  switch (settings.value?.disabledReason) {
    case 'permission_denied':
      return 'You do not have permission to use Hardcover sync.'
    case 'missing_token':
      return 'Connect Hardcover before importing.'
    case 'user_disabled':
      return 'Sync is paused in your Hardcover settings.'
    default:
      return null
  }
})

const previewButtonDisabled = computed(() => previewing.value || applying.value || importUnavailableReason.value !== null)
const readyRows = computed(() => preview.value?.rows.filter((row) => row.outcome === 'will_update') ?? [])
const canImportReady = computed(() => readyRows.value.length > 0 && !previewing.value && !applying.value)
const summaryItems = computed(() => {
  const summary = preview.value?.summary
  if (!summary) return []
  return [
    { label: 'Ready', value: summary.willUpdate },
    { label: 'Review', value: summary.needsReview },
    { label: 'Conflicts', value: summary.conflicts },
    { label: 'Unmatched', value: summary.unmatched },
    { label: 'Skipped', value: summary.skipped },
  ]
})
const progressPreviewLabel = computed(() => {
  const summary = preview.value?.summary
  if (!summary) return null
  const ready = `${summary.progressWillUpdate} progress update${summary.progressWillUpdate === 1 ? '' : 's'} available`
  if (summary.progressConflicts === 0) return ready
  return `${ready}, ${summary.progressConflicts} conflict${summary.progressConflicts === 1 ? '' : 's'}`
})

const resultLabel = computed(() => {
  if (!result.value) return null
  const progress = result.value.progressApplied > 0 ? `, ${result.value.progressApplied} progress updated` : ''
  return `${result.value.applied} imported${progress}, ${result.value.failed} failed`
})

async function handlePreview(): Promise<void> {
  await loadPreview()
  if (preview.value) reviewOpen.value = true
}

function handleOpenReview(): void {
  reviewOpen.value = true
}

function handleCloseReview(): void {
  reviewOpen.value = false
}

function handleClear(): void {
  reviewOpen.value = false
  clearImport()
}

async function handleImportReady(): Promise<void> {
  await applyRows()
}

async function handleApplySelected(hardcoverUserBookIds: number[]): Promise<void> {
  await applyRows(hardcoverUserBookIds)
}

async function applyRows(hardcoverUserBookIds?: number[]): Promise<void> {
  const applied = await applyPreview(hardcoverUserBookIds, importProgress.value)
  if (!applied) {
    toast.error(error.value ?? 'Failed to import Hardcover read status')
    return
  }
  reviewOpen.value = false
  const progress = importProgress.value ? `, ${applied.progressApplied} progress update${applied.progressApplied === 1 ? '' : 's'}` : ''
  toast.success(`${applied.applied} read status${applied.applied === 1 ? '' : 'es'} imported${progress}`)
}
</script>

<template>
  <div class="space-y-4 rounded-lg border border-border bg-card px-4 py-4 shadow-xs md:px-5 md:py-5">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <p class="text-sm font-medium">Pull read status</p>
        <p class="mt-0.5 text-xs text-muted-foreground">Preview Hardcover matches before filling blank BookOrbit statuses.</p>
        <p v-if="importUnavailableReason" class="mt-1 text-xs text-muted-foreground">{{ importUnavailableReason }}</p>
        <p v-else-if="resultLabel && !preview" class="mt-1 flex items-center gap-1 text-xs text-primary">
          <CheckCircle2 class="size-3.5" />
          {{ resultLabel }}
        </p>
        <p v-if="error" class="mt-1 flex items-center gap-1 text-xs text-destructive">
          <AlertCircle class="size-3.5" />
          {{ error }}
        </p>
      </div>

      <div class="flex shrink-0 flex-wrap justify-end gap-2">
        <button
          v-if="preview"
          type="button"
          class="flex items-center gap-1.5 rounded-md border border-border bg-muted px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/80"
          :disabled="previewing || applying"
          @click="handleClear"
        >
          <XCircle class="size-3.5" />
          Clear
        </button>
        <button
          type="button"
          :disabled="previewButtonDisabled"
          class="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
          @click="handlePreview"
        >
          <Loader2 v-if="previewing" class="size-3.5 animate-spin" />
          <FileSearch v-else class="size-3.5" />
          Preview
        </button>
      </div>
    </div>

    <div v-if="preview" class="space-y-4 border-t border-border pt-4">
      <div class="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-5">
        <div v-for="item in summaryItems" :key="item.label" class="min-w-0">
          <p class="text-[10px] uppercase tracking-wider text-muted-foreground">{{ item.label }}</p>
          <p class="text-lg font-semibold tabular-nums">{{ item.value }}</p>
        </div>
      </div>

      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div class="space-y-2">
          <p class="text-xs text-muted-foreground">{{ readyRows.length }} exact matches can be imported without review.</p>
          <label class="flex w-fit items-center gap-2 text-xs text-muted-foreground">
            <input
              v-model="importProgress"
              type="checkbox"
              class="size-4 rounded border-border text-primary focus:ring-primary/40"
              :disabled="applying"
            />
            <span>Import progress</span>
            <span v-if="progressPreviewLabel">({{ progressPreviewLabel }})</span>
          </label>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
            @click="handleOpenReview"
          >
            <Table2 class="size-3.5" />
            Review matches
          </button>
          <button
            type="button"
            :disabled="!canImportReady"
            class="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
            @click="handleImportReady"
          >
            <Loader2 v-if="applying" class="size-3.5 animate-spin" />
            <Download v-else class="size-3.5" />
            Import ready
          </button>
        </div>
      </div>
    </div>

    <HardcoverImportReviewModal
      v-if="preview && reviewOpen"
      :preview="preview"
      :applying="applying"
      v-model:import-progress="importProgress"
      @close="handleCloseReview"
      @apply="handleApplySelected"
    />
  </div>
</template>
