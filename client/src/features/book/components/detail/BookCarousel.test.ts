import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

import BookCarousel, { type CarouselBook } from './BookCarousel.vue'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn<() => void>() }),
}))

vi.mock('@/features/book/composables/useCoverVersions', () => ({
  useCoverVersions: () => ({
    coverUrl: (id: number, size: string) => `/api/covers/${id}/${size}`,
  }),
}))

vi.mock('@/features/book/components/BookCoverPlaceholder.vue', () => ({
  default: defineComponent({
    name: 'BookCoverPlaceholder',
    props: ['title', 'authorLine', 'isAudio', 'seed'],
    setup(props) {
      return () => h('div', { 'data-testid': 'placeholder', 'data-title': props.title, 'data-author': props.authorLine }, [])
    },
  }),
}))

vi.mock('@/features/book/lib/book-cover', () => ({
  bookCoverStyle: (seed: string) => ({ background: `linear-gradient(${seed})`, color: 'oklch(90% 0.05 200)' }),
}))

function makeBook(overrides: Partial<CarouselBook> = {}): CarouselBook {
  return {
    id: 1,
    title: 'Dune',
    hasCover: true,
    authors: ['Frank Herbert'],
    seriesIndex: null,
    ...overrides,
  }
}

function mountCarousel(books: CarouselBook[], options: { loading?: boolean; showSeriesIndex?: boolean } = {}) {
  return mount(BookCarousel, {
    props: {
      books,
      loading: options.loading ?? false,
      showSeriesIndex: options.showSeriesIndex ?? false,
    },
    global: {
      stubs: { ChevronLeft: true, ChevronRight: true },
    },
  })
}

describe('BookCarousel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when not loading and books array is empty', () => {
    const wrapper = mountCarousel([])
    expect(wrapper.find('[data-book-id]').exists()).toBe(false)
  })

  it('renders loading skeletons when loading is true', () => {
    const wrapper = mountCarousel([], { loading: true })
    const skeletons = wrapper.findAll('.animate-shimmer')
    expect(skeletons.length).toBe(10)
  })

  it('renders an img when book.hasCover is true', () => {
    const book = makeBook({ hasCover: true })
    const wrapper = mountCarousel([book])
    expect(wrapper.find('img').exists()).toBe(true)
    expect(wrapper.find('[data-testid="placeholder"]').exists()).toBe(false)
  })

  it('renders BookCoverPlaceholder when book.hasCover is false', () => {
    const book = makeBook({ hasCover: false, title: 'Unknown', authors: [] })
    const wrapper = mountCarousel([book])
    expect(wrapper.find('[data-testid="placeholder"]').exists()).toBe(true)
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('passes title to BookCoverPlaceholder', () => {
    const book = makeBook({ hasCover: false, title: 'Foundation', authors: [] })
    const wrapper = mountCarousel([book])
    const placeholder = wrapper.find('[data-testid="placeholder"]')
    expect(placeholder.attributes('data-title')).toBe('Foundation')
  })

  it('passes joined authors as authorLine to BookCoverPlaceholder', () => {
    const book = makeBook({ hasCover: false, authors: ['Isaac Asimov', 'Robert Heinlein'] })
    const wrapper = mountCarousel([book])
    const placeholder = wrapper.find('[data-testid="placeholder"]')
    expect(placeholder.attributes('data-author')).toBe('Isaac Asimov, Robert Heinlein')
  })

  it('passes null authorLine to BookCoverPlaceholder when authors array is empty', () => {
    const book = makeBook({ hasCover: false, authors: [] })
    const wrapper = mountCarousel([book])
    const placeholder = wrapper.find('[data-testid="placeholder"]')
    expect(placeholder.attributes('data-author')).toBeUndefined()
  })

  it('renders the correct cover image src when hasCover is true', () => {
    const book = makeBook({ id: 42, hasCover: true })
    const wrapper = mountCarousel([book])
    expect(wrapper.find('img').attributes('src')).toBe('/api/covers/42/thumbnail')
  })

  it('shows series index badge when showSeriesIndex is true and seriesIndex is set', () => {
    const book = makeBook({ seriesIndex: 3 })
    const wrapper = mountCarousel([book], { showSeriesIndex: true })
    expect(wrapper.find('span').text()).toContain('#3')
  })

  it('does not show series index badge when showSeriesIndex is false', () => {
    const book = makeBook({ seriesIndex: 3 })
    const wrapper = mountCarousel([book], { showSeriesIndex: false })
    expect(wrapper.find('span').exists()).toBe(false)
  })

  it('does not show series index badge when seriesIndex is null', () => {
    const book = makeBook({ seriesIndex: null })
    const wrapper = mountCarousel([book], { showSeriesIndex: true })
    expect(wrapper.find('span').exists()).toBe(false)
  })

  it('renders multiple books', () => {
    const books = [makeBook({ id: 1, hasCover: true }), makeBook({ id: 2, hasCover: false }), makeBook({ id: 3, hasCover: true })]
    const wrapper = mountCarousel(books)
    expect(wrapper.findAll('[data-book-id]').length).toBe(3)
    expect(wrapper.findAll('img').length).toBe(2)
    expect(wrapper.findAll('[data-testid="placeholder"]').length).toBe(1)
  })

  it('uses book id as seed when title is null', () => {
    const book = makeBook({ hasCover: false, title: null, id: 99 })
    const wrapper = mountCarousel([book])
    const placeholder = wrapper.find('[data-testid="placeholder"]')
    expect(placeholder.exists()).toBe(true)
  })

  it('applies data-book-id attribute for scroll-into-view behaviour', () => {
    const book = makeBook({ id: 77 })
    const wrapper = mountCarousel([book])
    expect(wrapper.find('[data-book-id="77"]').exists()).toBe(true)
  })
})
