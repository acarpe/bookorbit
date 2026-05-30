<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

import { bookCoverStyle } from '@/features/book/lib/book-cover'
import { useCoverVersions } from '@/features/book/composables/useCoverVersions'
import BookCoverPlaceholder from '@/features/book/components/BookCoverPlaceholder.vue'
import BookCoverSurface from '@/features/book/components/BookCoverSurface.vue'
import { coverAspectRatioValue, DEFAULT_COVER_ASPECT_RATIO, fittedCoverFrameStyle } from '@/features/book/lib/cover-aspect-ratio'

export interface CarouselBook {
  id: number
  title: string | null
  seriesIndex?: number | null
  hasCover: boolean
  authors: string[]
  isAudiobook?: boolean
}

const props = withDefaults(
  defineProps<{
    books: CarouselBook[]
    loading: boolean
    currentBookId?: number | null
    showSeriesIndex?: boolean
    showHeader?: boolean
  }>(),
  {
    currentBookId: null,
    showSeriesIndex: false,
    showHeader: true,
  },
)

const router = useRouter()
const { coverUrl } = useCoverVersions()
const scrollEl = ref<HTMLElement | null>(null)
const slotAspectRatio = coverAspectRatioValue(DEFAULT_COVER_ASPECT_RATIO)

type CoverState = {
  loaded: boolean
  failed: boolean
  imageRatio: number | null
}

const coverStateByBookId = ref<Record<number, CoverState>>({})

function scroll(direction: 'left' | 'right') {
  if (!scrollEl.value) return
  scrollEl.value.scrollBy({ left: direction === 'left' ? -240 : 240, behavior: 'smooth' })
}

function navigateToBook(bookId: number) {
  router.push({ name: 'book-detail', params: { bookId } })
}

function formatSeriesIndex(index: number | null | undefined): string {
  if (index == null) return ''
  return Number.isInteger(index) ? `#${index}` : `#${index}`
}

function isAudiobook(book: CarouselBook): boolean {
  return book.isAudiobook ?? false
}

function cardAspectRatio(book: CarouselBook): string {
  return isAudiobook(book) ? '1/1' : DEFAULT_COVER_ASPECT_RATIO
}

function coverState(bookId: number): CoverState {
  return coverStateByBookId.value[bookId] ?? { loaded: false, failed: false, imageRatio: null }
}

function isCoverLoaded(bookId: number): boolean {
  return coverState(bookId).loaded
}

function isCoverFailed(bookId: number): boolean {
  return coverState(bookId).failed
}

function fittedCoverSpineStyle(bookId: number): Record<string, string> {
  return fittedCoverFrameStyle(coverState(bookId).imageRatio, slotAspectRatio)
}

function handleCoverLoad(bookId: number, event: Event): void {
  const target = event.target as HTMLImageElement | null
  const imageRatio = target && target.naturalWidth > 0 && target.naturalHeight > 0 ? target.naturalWidth / target.naturalHeight : null
  coverStateByBookId.value = {
    ...coverStateByBookId.value,
    [bookId]: { loaded: true, failed: false, imageRatio },
  }
}

function handleCoverError(bookId: number): void {
  coverStateByBookId.value = {
    ...coverStateByBookId.value,
    [bookId]: { loaded: false, failed: true, imageRatio: null },
  }
}

watch(
  () => props.books,
  (books) => {
    const previous = coverStateByBookId.value
    const next: Record<number, CoverState> = {}
    for (const book of books) {
      const existing = previous[book.id]
      next[book.id] = existing ? { ...existing, failed: false } : { loaded: false, failed: false, imageRatio: null }
    }
    coverStateByBookId.value = next
  },
  { immediate: true },
)

watch(
  () => [props.books, props.loading, props.currentBookId] as const,
  async ([books, loading, currentId]) => {
    if (loading || !currentId || books.length === 0) return
    await nextTick()
    if (!scrollEl.value) return
    const card = scrollEl.value.querySelector(`[data-book-id="${currentId}"]`)
    if (card) card.scrollIntoView({ inline: 'center', behavior: 'instant', block: 'nearest' })
  },
  { immediate: true },
)
defineExpose({ scroll })
</script>

<template>
  <div v-if="loading || books.length > 0">
    <div v-if="showHeader" class="flex items-center justify-between mb-4">
      <slot name="header" />
      <div class="flex items-center gap-1">
        <button
          class="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          @click="scroll('left')"
        >
          <ChevronLeft :size="14" />
        </button>
        <button
          class="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          @click="scroll('right')"
        >
          <ChevronRight :size="14" />
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex gap-3 overflow-x-auto pb-2">
      <div v-for="i in 10" :key="i" class="w-24 shrink-0">
        <div class="w-full rounded-sm bg-muted animate-shimmer" style="aspect-ratio: 2/3" />
      </div>
    </div>

    <div v-else ref="scrollEl" class="flex gap-6 overflow-x-auto pb-2">
      <button
        v-for="(book, index) in books"
        :key="book.id"
        :data-book-id="book.id"
        class="shrink-0 text-left group animate-fade-up"
        :class="isAudiobook(book) ? 'w-38' : 'w-30'"
        :style="{ animationDelay: `${index * 40}ms` }"
        @click="navigateToBook(book.id)"
      >
        <BookCoverSurface
          class="book-cover-surface--spine-fitted relative w-full rounded-sm overflow-hidden transition-transform duration-150 group-hover:scale-[1.02]"
          :interactive="true"
          :disable-spine="isAudiobook(book)"
          :style="[
            { aspectRatio: cardAspectRatio(book) },
            !book.hasCover || !isCoverLoaded(book.id) || isCoverFailed(book.id) ? bookCoverStyle(book.title ?? String(book.id)) : {},
          ]"
        >
          <img
            v-if="book.hasCover && isCoverLoaded(book.id) && !isCoverFailed(book.id) && !isAudiobook(book)"
            :src="coverUrl(book.id, 'thumbnail')"
            class="absolute inset-0 w-full h-full object-cover scale-110 blur-md brightness-90 transition-opacity duration-300 ease-out"
            aria-hidden="true"
            loading="lazy"
          />
          <img
            v-if="book.hasCover && !isCoverFailed(book.id)"
            :src="coverUrl(book.id, 'thumbnail')"
            :alt="book.title ?? ''"
            class="absolute inset-0 w-full h-full transition-opacity duration-300 ease-out"
            :class="[isAudiobook(book) ? 'object-cover' : 'object-contain', isCoverLoaded(book.id) ? 'opacity-100' : 'opacity-0']"
            loading="lazy"
            @load="handleCoverLoad(book.id, $event)"
            @error="handleCoverError(book.id)"
          />
          <div v-if="book.hasCover && !isCoverLoaded(book.id) && !isCoverFailed(book.id)" class="absolute inset-0 animate-pulse bg-white/10" />
          <div
            v-if="!isAudiobook(book) && book.hasCover && isCoverLoaded(book.id) && !isCoverFailed(book.id)"
            class="book-cover-spine-layer absolute z-[3]"
            :style="fittedCoverSpineStyle(book.id)"
          />
          <BookCoverPlaceholder
            v-if="!book.hasCover || isCoverFailed(book.id)"
            :title="book.title"
            :author-line="book.authors.length > 0 ? book.authors.join(', ') : null"
            :is-audio="isAudiobook(book)"
            :seed="book.title ?? String(book.id)"
          />
          <span
            v-if="showSeriesIndex && book.seriesIndex != null"
            class="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-[9px] font-semibold leading-none px-1.5 py-1 rounded-full pointer-events-none"
          >
            {{ formatSeriesIndex(book.seriesIndex) }}
          </span>
        </BookCoverSurface>
      </button>
    </div>
  </div>
</template>
