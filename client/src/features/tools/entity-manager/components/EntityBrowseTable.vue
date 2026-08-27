<script setup lang="ts">
import { computed } from 'vue'
import type {
  BrowseEntityBookCountFilter,
  BrowseEntityItem,
  BrowseEntitySortBy,
  BrowseEntitySortOrder,
  EntityTypeCapabilities,
} from '@bookorbit/types'

import EntityBrowsePager from './EntityBrowsePager.vue'
import EntityBrowseToolbar from './EntityBrowseToolbar.vue'
import EntityDataGrid from './EntityDataGrid.vue'
import type { EntityRowDensity } from '../types'

const props = defineProps<{
  items: BrowseEntityItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  search: string
  sortBy: BrowseEntitySortBy
  sortOrder: BrowseEntitySortOrder
  bookCount: BrowseEntityBookCountFilter
  density: EntityRowDensity
  loading: boolean
  selectedIds: Set<number | string>
  capabilities: EntityTypeCapabilities
  isInline: boolean
}>()

const emit = defineEmits<{
  'update:page': [value: number]
  'update:pageSize': [value: number]
  'update:search': [value: string]
  'update:bookCount': [value: BrowseEntityBookCountFilter]
  'update:density': [value: EntityRowDensity]
  sortChange: [sortBy: BrowseEntitySortBy, sortOrder: BrowseEntitySortOrder]
  select: [id: number | string, event: MouseEvent]
  toggleAll: [selected: boolean]
  rename: [item: BrowseEntityItem]
  delete: [item: BrowseEntityItem]
  split: [item: BrowseEntityItem]
  bulkDelete: []
  bulkMerge: []
  clearSelection: []
  clearFilters: []
}>()

const hasActiveFilters = computed(() => props.search.length > 0 || props.bookCount === 'empty')

function handleUpdatePage(value: number): void {
  emit('update:page', value)
}

function handleUpdatePageSize(value: number): void {
  emit('update:pageSize', value)
}

function handleUpdateSearch(value: string): void {
  emit('update:search', value)
}

function handleUpdateBookCount(value: BrowseEntityBookCountFilter): void {
  emit('update:bookCount', value)
}

function handleUpdateDensity(value: EntityRowDensity): void {
  emit('update:density', value)
}

function handleSortChange(sortBy: BrowseEntitySortBy, sortOrder: BrowseEntitySortOrder): void {
  emit('sortChange', sortBy, sortOrder)
}

function handleSelect(id: number | string, event: MouseEvent): void {
  emit('select', id, event)
}

function handleToggleAll(selected: boolean): void {
  emit('toggleAll', selected)
}

function handleRename(item: BrowseEntityItem): void {
  emit('rename', item)
}

function handleDelete(item: BrowseEntityItem): void {
  emit('delete', item)
}

function handleSplit(item: BrowseEntityItem): void {
  emit('split', item)
}

function handleBulkDelete(): void {
  emit('bulkDelete')
}

function handleBulkMerge(): void {
  emit('bulkMerge')
}

function handleClearSelection(): void {
  emit('clearSelection')
}

function handleClearFilters(): void {
  emit('clearFilters')
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex-none pb-3">
      <EntityBrowseToolbar
        :search="search"
        :book-count="bookCount"
        :total="total"
        :density="density"
        :selected-count="selectedIds.size"
        :is-inline="isInline"
        @update:search="handleUpdateSearch"
        @update:book-count="handleUpdateBookCount"
        @update:density="handleUpdateDensity"
        @bulk-merge="handleBulkMerge"
        @bulk-delete="handleBulkDelete"
        @clear-selection="handleClearSelection"
      />
    </div>

    <EntityDataGrid
      :items="items"
      :selected-ids="selectedIds"
      :capabilities="capabilities"
      :is-inline="isInline"
      :loading="loading"
      :density="density"
      :sort-by="sortBy"
      :sort-order="sortOrder"
      :has-active-filters="hasActiveFilters"
      @select="handleSelect"
      @toggle-all="handleToggleAll"
      @sort-change="handleSortChange"
      @rename="handleRename"
      @delete="handleDelete"
      @split="handleSplit"
      @clear-filters="handleClearFilters"
    />

    <EntityBrowsePager
      :page="page"
      :page-size="pageSize"
      :total="total"
      :total-pages="totalPages"
      @update:page="handleUpdatePage"
      @update:page-size="handleUpdatePageSize"
    />
  </div>
</template>
