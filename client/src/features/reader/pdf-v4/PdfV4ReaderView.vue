<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { PDFViewer, ScrollPlugin, ScrollStrategy, SpreadMode, ZoomMode } from '@embedpdf/vue-pdf-viewer'
import type { PDFViewerConfig, PluginRegistry, ScrollCapability, EmbedPdfContainer } from '@embedpdf/vue-pdf-viewer'
import { getAccessToken } from '@/lib/api'
import { useReaderProgress } from '../shared/composables/useReaderProgress'
import { useReadingSession } from '../shared/composables/useReadingSession'
import { useReaderSettings } from '../shared/composables/useReaderSettings'
import { useThemeStore, ACCENT_OPTIONS } from '@/stores/theme'
import type { PdfReaderSettings } from '@bookorbit/types'
import { getIsDark, lookupAccentHex } from './pdf-viewer-utils'

const props = defineProps<{ bookId: number; fileId: number }>()

const themeStore = useThemeStore()

const progress = useReaderProgress(props.bookId, props.fileId)
const bookSettings = useReaderSettings(props.fileId, 'pdf')
const { onActivity } = useReadingSession(props.fileId, () => ({
  percentage: progress.percentage.value,
  pageNumber: progress.pageNumber.value,
}))

let saveTimer: ReturnType<typeof setTimeout> | null = null
let unsubPageChange: (() => void) | null = null
let unsubLayoutReady: (() => void) | null = null
let themeObserver: MutationObserver | null = null
let viewerContainer: EmbedPdfContainer | null = null

function buildThemeConfig() {
  const isDark = getIsDark()
  const accentHex = lookupAccentHex(themeStore.accent, ACCENT_OPTIONS)
  return {
    preference: isDark ? ('dark' as const) : ('light' as const),
    light: { accent: { primary: accentHex } },
    dark: { accent: { primary: accentHex } },
  }
}

function scheduleSave(pageNumber: number, totalPages: number) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    progress.pageNumber.value = pageNumber
    progress.percentage.value = (pageNumber / totalPages) * 100
    progress.save()
  }, 2000)
}

const configReady = ref(false)
const viewerConfig = ref<PDFViewerConfig>({})

onMounted(async () => {
  await bookSettings.load()

  const settings = bookSettings.effective.value as PdfReaderSettings
  const token = getAccessToken()

  viewerConfig.value = {
    theme: buildThemeConfig(),
    tabBar: 'never',
    disabledCategories: [
      'annotation',
      'signature',
      'form',
      'document-print',
      'export',
      'insert',
      'redaction',
      'document-open',
      'document-close',
      'document-protect',
      'document-export',
    ],
    scroll: {
      defaultStrategy: settings.scrollMode === 'horizontal' ? ScrollStrategy.Horizontal : ScrollStrategy.Vertical,
    },
    spread: {
      defaultSpreadMode: settings.spread === 'odd' ? SpreadMode.Odd : settings.spread === 'even' ? SpreadMode.Even : SpreadMode.None,
    },
    zoom: {
      defaultZoomLevel:
        settings.zoomMode === 'fit-width' ? ZoomMode.FitWidth : settings.zoomMode === 'fit-page' ? ZoomMode.FitPage : settings.customScale,
    },
    documentManager: {
      initialDocuments: [
        {
          url: `/api/v1/books/files/${props.fileId}/serve`,
          requestOptions: {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          },
        },
      ],
    },
  }

  configReady.value = true
})

function handleInit(container: EmbedPdfContainer) {
  viewerContainer = container
}

function handleReady(registry: PluginRegistry) {
  setupProgressTracking(registry)
  setupSettingsPersistence(registry)
  setupThemeSync()
}

async function setupProgressTracking(registry: PluginRegistry) {
  await progress.load()

  const scroll = registry.getPlugin<InstanceType<typeof ScrollPlugin>>(ScrollPlugin.id)?.provides() as ScrollCapability | undefined

  if (!scroll) return

  unsubLayoutReady = scroll.onLayoutReady(({ isInitial, totalPages }) => {
    if (!isInitial) return
    const initialPage = progress.pageNumber.value ?? 1
    if (initialPage > 1 && initialPage <= totalPages) {
      scroll.scrollToPage({ pageNumber: initialPage })
    }
  })

  unsubPageChange = scroll.onPageChange(({ pageNumber, totalPages }) => {
    onActivity()
    scheduleSave(pageNumber, totalPages)
  })
}

function setupSettingsPersistence(registry: PluginRegistry) {
  const scroll = registry.getPlugin<InstanceType<typeof ScrollPlugin>>(ScrollPlugin.id)?.provides() as ScrollCapability | undefined

  if (scroll) {
    scroll.onStateChange((state) => {
      const strategy = state.strategy
      if (strategy) {
        bookSettings.updateBookSettings({ scrollMode: strategy as PdfReaderSettings['scrollMode'] })
      }
    })
  }
}

function setupThemeSync() {
  themeObserver = new MutationObserver(() => {
    if (!viewerContainer) return
    viewerContainer.setTheme(buildThemeConfig())
  })

  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
}

onUnmounted(() => {
  unsubPageChange?.()
  unsubLayoutReady?.()
  themeObserver?.disconnect()
  if (saveTimer) clearTimeout(saveTimer)
})
</script>

<template>
  <div class="fixed inset-0 flex flex-col">
    <PDFViewer v-if="configReady" :config="viewerConfig" style="flex: 1; min-height: 0" @init="handleInit" @ready="handleReady" />
  </div>
</template>
