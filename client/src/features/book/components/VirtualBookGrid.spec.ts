import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { BookCard } from '@bookorbit/types'
import VirtualBookGrid from './VirtualBookGrid.vue'

vi.mock('vue-virtual-scroller', () => ({
  RecycleScroller: {
    name: 'RecycleScroller',
    props: ['items'],
    template: '<div data-testid="recycle-scroller"><slot v-for="item in items" :key="item.id" :item="item" /></div>',
  },
}))

vi.mock('./BookCoverCard.vue', () => ({
  default: {
    name: 'BookCoverCard',
    props: ['book', 'selectionMode', 'selected'],
    emits: ['action', 'select', 'update:book'],
    template: '<button data-testid="book-card" @click="$emit(\'action\', \'quick-view\')">{{ book.id }}</button>',
  },
}))

vi.mock('./CollapsedSeriesCard.vue', () => ({
  default: {
    name: 'CollapsedSeriesCard',
    props: ['book'],
    template: '<div data-testid="collapsed-series-card">{{ book.id }}</div>',
  },
}))

function makeBook(id: number): BookCard {
  return {
    id,
    status: 'present',
    title: `Book ${id}`,
    authors: [],
    seriesName: null,
    seriesIndex: id,
    files: [],
    publishedYear: null,
    language: null,
    genres: [],
    tags: [],
    rating: null,
    readingProgress: null,
    readStatus: null,
    addedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: null,
    metadataScore: null,
    hasCover: false,
    hasMetadataLocks: false,
    lockedFields: [],
    subtitle: null,
    publisher: null,
    pageCount: null,
    isbn13: null,
    narrators: [],
  }
}

describe('VirtualBookGrid', () => {
  it('uses the virtual scroller by default', () => {
    const wrapper = mount(VirtualBookGrid, {
      props: {
        books: [makeBook(1), makeBook(2)],
        coverSize: 120,
        gridGap: 12,
      },
    })

    expect(wrapper.find('[data-testid="recycle-scroller"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="book-grid-static"]').exists()).toBe(false)
  })

  it('renders every book directly when virtualization is disabled', () => {
    const books = Array.from({ length: 27 }, (_, index) => makeBook(index + 1))
    const wrapper = mount(VirtualBookGrid, {
      props: {
        books,
        coverSize: 120,
        gridGap: 12,
        virtualized: false,
      },
    })

    expect(wrapper.find('[data-testid="recycle-scroller"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="book-card"]')).toHaveLength(27)
  })

  it('keeps book actions wired in direct render mode', async () => {
    const books = [makeBook(1)]
    const wrapper = mount(VirtualBookGrid, {
      props: {
        books,
        coverSize: 120,
        gridGap: 12,
        virtualized: false,
      },
    })

    await wrapper.get('[data-testid="book-card"]').trigger('click')

    expect(wrapper.emitted('action')).toEqual([[books[0], 'quick-view']])
  })
})
