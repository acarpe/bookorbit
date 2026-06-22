<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { X } from '@lucide/vue'
import { copyToClipboard } from '@/lib/clipboard'

defineProps<{ resetUrl: string }>()
const emit = defineEmits<{ close: [] }>()

const copied = ref(false)
const copyFailed = ref(false)
let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null

function resetCopyFeedbackAfterDelay() {
  if (copyFeedbackTimer) clearTimeout(copyFeedbackTimer)
  copyFeedbackTimer = setTimeout(() => {
    copied.value = false
    copyFailed.value = false
    copyFeedbackTimer = null
  }, 2000)
}

onUnmounted(() => {
  if (copyFeedbackTimer) clearTimeout(copyFeedbackTimer)
})

async function copy(url: string) {
  const didCopy = await copyToClipboard(url)
  if (!didCopy) {
    copied.value = false
    copyFailed.value = true
    resetCopyFeedbackAfterDelay()
    return
  }

  copyFailed.value = false
  copied.value = true
  resetCopyFeedbackAfterDelay()
}
</script>

<template>
  <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4" @click.self="emit('close')">
    <div class="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
      <div class="flex items-start justify-between mb-4">
        <h2 class="text-base font-semibold text-foreground">Password Reset Link</h2>
        <button @click="emit('close')" class="text-muted-foreground hover:text-foreground transition-colors">
          <X :size="16" />
        </button>
      </div>

      <p class="text-sm text-muted-foreground mb-3">Share this link with the user. It expires in 15 minutes.</p>

      <div class="flex gap-2">
        <input
          :value="resetUrl"
          readonly
          class="flex-1 rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none overflow-x-auto"
        />
        <button
          @click="copy(resetUrl)"
          class="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap"
        >
          {{ copied ? 'Copied!' : copyFailed ? 'Copy failed' : 'Copy' }}
        </button>
      </div>

      <p class="mt-3 text-xs text-amber-600 dark:text-amber-400">This link will not be shown again.</p>
    </div>
  </div>
</template>
