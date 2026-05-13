<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { BookOpen, ChevronDown, Play } from 'lucide-vue-next'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { FORMAT_TO_GROUP, READER_OPENABLE_FORMATS } from '@bookorbit/types'
import type { BookCard, BookFileRef } from '@bookorbit/types'
import { getFormatColor } from '@/features/book/lib/format-colors'

const props = defineProps<{
  book: BookCard
}>()

const router = useRouter()

const readableFiles = computed(() => {
  const normalized = props.book.files.filter((file) => {
    const format = file.format?.trim().toLowerCase()
    return format ? READER_OPENABLE_FORMATS.has(format) : false
  })
  const primary = normalized.find((file) => file.role === 'primary')
  return primary ? [primary, ...normalized.filter((file) => file.id !== primary.id)] : normalized
})

const isMultiTrackAudio = computed(() => {
  const audioFiles = readableFiles.value.filter((file) => {
    const format = file.format?.toLowerCase()
    return format ? FORMAT_TO_GROUP[format] === 'audio' : false
  })
  return audioFiles.length > 1
})

const openableFiles = computed<BookFileRef[]>(() => {
  const collapsed = isMultiTrackAudio.value
    ? (() => {
        const firstAudio = readableFiles.value.find((file) => {
          const format = file.format?.toLowerCase()
          return format ? FORMAT_TO_GROUP[format] === 'audio' : false
        })
        const nonAudio = readableFiles.value.filter((file) => {
          const format = file.format?.toLowerCase()
          return format ? FORMAT_TO_GROUP[format] !== 'audio' : false
        })
        return firstAudio ? [firstAudio, ...nonAudio] : nonAudio
      })()
    : readableFiles.value

  const seen = new Set<string>()
  return collapsed.filter((file) => {
    const key = file.format!.trim().toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
})

const primaryFile = computed(() => openableFiles.value.find((file) => file.role === 'primary') ?? openableFiles.value[0] ?? null)

const primaryIsAudio = computed(() => {
  const format = primaryFile.value?.format?.toLowerCase()
  return format ? FORMAT_TO_GROUP[format] === 'audio' : false
})

const canOpen = computed(() => props.book.status !== 'missing' && !!primaryFile.value)
const hasMultipleFormats = computed(() => openableFiles.value.length > 1)

function actionVerb(file: BookFileRef | null): string {
  const format = file?.format?.toLowerCase()
  return format && FORMAT_TO_GROUP[format] === 'audio' ? 'Play' : 'Read'
}

function isAudioFile(file: BookFileRef | null): boolean {
  const format = file?.format?.toLowerCase()
  return format ? FORMAT_TO_GROUP[format] === 'audio' : false
}

function formatLabel(file: BookFileRef | null): string {
  return file?.format?.trim().toUpperCase() ?? 'FILE'
}

function formatBadgeStyle(format: string) {
  const color = getFormatColor(format)
  return {
    color,
    borderColor: `${color}66`,
    backgroundColor: `${color}1a`,
  }
}

function openFile(file: BookFileRef | null) {
  if (!file || props.book.status === 'missing') return
  router.push({
    name: 'reader',
    params: { bookId: props.book.id, fileId: file.id },
    query: { format: file.format ?? 'epub' },
  })
}
</script>

<template>
  <div v-if="canOpen" class="flex w-full items-center justify-start">
    <div v-if="hasMultipleFormats" class="mr-auto flex h-7 items-center overflow-hidden rounded-md">
      <button
        type="button"
        class="inline-flex h-7 w-7 items-center justify-center rounded-l-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        :aria-label="`${actionVerb(primaryFile)} ${formatLabel(primaryFile)}`"
        :title="`${actionVerb(primaryFile)} ${formatLabel(primaryFile)}`"
        @click.stop="openFile(primaryFile)"
      >
        <Play v-if="primaryIsAudio" :size="13" class="text-sky-500" />
        <BookOpen v-else :size="13" class="text-emerald-500" />
      </button>
      <div class="w-px shrink-0 bg-border/80" />
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="inline-flex h-7 w-6 shrink-0 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            aria-label="Choose format to read or play"
            @click.stop
          >
            <ChevronDown :size="12" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-48">
          <DropdownMenuItem v-for="file in openableFiles" :key="file.id" class="gap-2" @select="openFile(file)">
            <span
              class="rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              :style="formatBadgeStyle(file.format?.toLowerCase() ?? '?')"
            >
              {{ file.format }}
            </span>
            <span class="flex-1 truncate text-xs">{{ actionVerb(file) }} {{ formatLabel(file) }}</span>
            <span v-if="file.role === 'primary' && !isMultiTrackAudio" class="text-[10px] text-primary">Primary</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <button
      v-else
      type="button"
      class="mr-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
      :aria-label="`${actionVerb(primaryFile)} ${formatLabel(primaryFile)}`"
      :title="`${actionVerb(primaryFile)} ${formatLabel(primaryFile)}`"
      @click.stop="openFile(primaryFile)"
    >
      <Play v-if="isAudioFile(primaryFile)" :size="13" class="text-sky-500" />
      <BookOpen v-else :size="13" class="text-emerald-500" />
    </button>
  </div>

  <span v-else class="text-xs text-muted-foreground/40">-</span>
</template>
