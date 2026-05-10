<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { ArrowLeft, BookOpen, Bookmark, BookmarkCheck, Maximize, Minimize, Search, Settings } from 'lucide-vue-next'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const props = defineProps<{
  chapterTitle: string
  isBookmarked: boolean
  settingsOpen: boolean
}>()

const emit = defineEmits<{
  back: []
  toggleSidebar: []
  toggleSearch: []
  toggleBookmark: []
  'update:settingsOpen': [open: boolean]
  toggleFullscreen: []
}>()

const isFullscreen = ref(false)

function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
}

function onSettingsOpenChange(open: boolean) {
  emit('update:settingsOpen', open)
}

onMounted(() => document.addEventListener('fullscreenchange', onFullscreenChange))
onUnmounted(() => document.removeEventListener('fullscreenchange', onFullscreenChange))
</script>

<template>
  <header
    class="fixed top-0 left-0 right-0 h-11 sm:h-12 z-50 flex items-center px-2 sm:px-3 gap-1 bg-background/90 backdrop-blur-md border-b border-border"
  >
    <!-- Left button group -->
    <div class="flex items-center gap-1 shrink-0">
      <Tooltip>
        <TooltipTrigger as-child>
          <button class="viewer-btn" @click="emit('back')">
            <ArrowLeft :size="18" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Go back</TooltipContent>
      </Tooltip>

      <div class="viewer-sep" />

      <Tooltip>
        <TooltipTrigger as-child>
          <button class="viewer-btn" @click="emit('toggleSidebar')">
            <BookOpen :size="18" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Table of contents</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <button class="viewer-btn" :class="isBookmarked ? '!text-primary' : ''" @click="emit('toggleBookmark')">
            <BookmarkCheck v-if="isBookmarked" :size="18" />
            <Bookmark v-else :size="18" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Toggle bookmark</TooltipContent>
      </Tooltip>
    </div>

    <!-- Title: absolutely centered on mobile, flex-1 on sm+ -->
    <div
      class="absolute inset-x-0 top-0 h-11 sm:h-12 flex items-center justify-center pointer-events-none sm:static sm:flex-1 sm:min-w-0 sm:h-auto sm:px-3 sm:pointer-events-auto"
    >
      <p class="text-sm font-serif font-medium truncate text-center text-muted-foreground max-w-[40vw] sm:max-w-none">{{ chapterTitle }}</p>
    </div>

    <!-- Right button group -->
    <div class="flex items-center gap-1 shrink-0 ml-auto">
      <Tooltip>
        <TooltipTrigger as-child>
          <button class="viewer-btn" @click="emit('toggleSearch')">
            <Search :size="18" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Search</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <button class="viewer-btn" @click="emit('toggleFullscreen')">
            <Minimize v-if="isFullscreen" :size="18" />
            <Maximize v-else :size="18" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{{ isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen' }}</TooltipContent>
      </Tooltip>

      <DropdownMenu :open="props.settingsOpen" @update:open="onSettingsOpenChange">
        <DropdownMenuTrigger as-child>
          <button class="viewer-btn" :class="props.settingsOpen ? '!bg-muted !text-foreground' : ''" title="Settings" aria-label="Reader settings">
            <Settings :size="18" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          side="bottom"
          :side-offset="10"
          class="w-[22rem] max-w-[calc(100vw-1rem)] max-h-[min(80vh,38rem)] rounded-lg border-border bg-card p-0 shadow-2xl overflow-hidden"
        >
          <slot name="settingsPanel" />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </header>
</template>
