<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  Bold,
  Check,
  Eraser,
  Eye,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  PencilLine,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
  Unlink,
  X,
} from '@lucide/vue'
import Link from '@tiptap/extension-link'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { normalizeDescriptionHtml } from '@/features/book/lib/description-html'

const props = defineProps<{
  modelValue: string | null
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const linkPanelOpen = ref(false)
const linkUrl = ref('')
const linkError = ref<string | null>(null)
const previewOpen = ref(false)

const editor = useEditor({
  content: props.modelValue ?? '',
  editable: !props.disabled,
  extensions: [
    StarterKit.configure({
      code: false,
      codeBlock: false,
      heading: false,
      horizontalRule: false,
      link: false,
    }),
    Link.configure({
      autolink: false,
      defaultProtocol: 'https',
      linkOnPaste: false,
      openOnClick: false,
      protocols: ['http', 'https', 'mailto'],
      HTMLAttributes: {
        rel: null,
        target: null,
      },
    }),
  ],
  editorProps: {
    attributes: {
      class:
        'min-h-[10rem] w-full outline-none px-3 py-2 text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5',
    },
  },
  onUpdate: ({ editor: instance }) => {
    emit('update:modelValue', normalizeDescriptionHtml(instance.getHTML()))
  },
})

const canEdit = computed(() => !!editor.value && !props.disabled)
const isBoldActive = computed(() => editor.value?.isActive('bold') ?? false)
const isItalicActive = computed(() => editor.value?.isActive('italic') ?? false)
const isUnderlineActive = computed(() => editor.value?.isActive('underline') ?? false)
const isStrikeActive = computed(() => editor.value?.isActive('strike') ?? false)
const isBulletListActive = computed(() => editor.value?.isActive('bulletList') ?? false)
const isOrderedListActive = computed(() => editor.value?.isActive('orderedList') ?? false)
const isBlockquoteActive = computed(() => editor.value?.isActive('blockquote') ?? false)
const isLinkActive = computed(() => editor.value?.isActive('link') ?? false)
const canUndo = computed(() => canEdit.value && (editor.value?.can().undo() ?? false))
const canRedo = computed(() => canEdit.value && (editor.value?.can().redo() ?? false))
const canIndentList = computed(() => canEdit.value && (editor.value?.can().sinkListItem('listItem') ?? false))
const canOutdentList = computed(() => canEdit.value && (editor.value?.can().liftListItem('listItem') ?? false))
const previewHtml = computed(() => normalizeDescriptionHtml(editor.value?.getHTML() ?? props.modelValue ?? '') ?? '')

const boldButtonClass = computed(() => buttonClass(isBoldActive.value))
const italicButtonClass = computed(() => buttonClass(isItalicActive.value))
const underlineButtonClass = computed(() => buttonClass(isUnderlineActive.value))
const strikeButtonClass = computed(() => buttonClass(isStrikeActive.value))
const bulletListButtonClass = computed(() => buttonClass(isBulletListActive.value))
const orderedListButtonClass = computed(() => buttonClass(isOrderedListActive.value))
const blockquoteButtonClass = computed(() => buttonClass(isBlockquoteActive.value))
const linkButtonClass = computed(() => buttonClass(isLinkActive.value || linkPanelOpen.value))
const previewButtonClass = computed(() => buttonClass(previewOpen.value))
const plainButtonClass = computed(() => buttonClass(false))

watch(
  () => props.disabled,
  (disabled) => {
    editor.value?.setEditable(!disabled)
    if (disabled) closeLinkPanel()
  },
)

watch(
  () => props.modelValue,
  (value) => {
    const instance = editor.value
    if (!instance) return

    const current = normalizeDescriptionHtml(instance.getHTML())
    const next = normalizeDescriptionHtml(value)
    if (current === next) return

    instance.commands.setContent(value ?? '', { emitUpdate: false })
  },
)

onBeforeUnmount(() => {
  editor.value?.destroy()
})

function buttonClass(isActive: boolean) {
  return [
    'inline-flex size-8 shrink-0 items-center justify-center rounded-md border text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40',
    isActive ? 'border-primary bg-primary text-primary-foreground' : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
  ]
}

function toggleBold() {
  editor.value?.chain().focus().toggleBold().run()
}

function toggleItalic() {
  editor.value?.chain().focus().toggleItalic().run()
}

function toggleUnderline() {
  editor.value?.chain().focus().toggleUnderline().run()
}

function toggleStrike() {
  editor.value?.chain().focus().toggleStrike().run()
}

function toggleBulletList() {
  editor.value?.chain().focus().toggleBulletList().run()
}

function toggleOrderedList() {
  editor.value?.chain().focus().toggleOrderedList().run()
}

function toggleBlockquote() {
  editor.value?.chain().focus().toggleBlockquote().run()
}

function indentList() {
  editor.value?.chain().focus().sinkListItem('listItem').run()
}

function outdentList() {
  editor.value?.chain().focus().liftListItem('listItem').run()
}

function undo() {
  editor.value?.chain().focus().undo().run()
}

function redo() {
  editor.value?.chain().focus().redo().run()
}

function clearFormatting() {
  editor.value?.chain().focus().unsetAllMarks().clearNodes().run()
  closeLinkPanel()
}

function togglePreview() {
  previewOpen.value = !previewOpen.value
  closeLinkPanel()
}

function toggleLinkPanel() {
  if (!canEdit.value) return
  if (linkPanelOpen.value) {
    closeLinkPanel()
    return
  }

  const href = editor.value?.getAttributes('link')['href']
  linkUrl.value = typeof href === 'string' ? href : ''
  linkError.value = null
  linkPanelOpen.value = true
}

function applyLink() {
  const instance = editor.value
  if (!instance) return

  const href = normalizeLinkUrl(linkUrl.value)
  if (!href) {
    instance.chain().focus().extendMarkRange('link').unsetLink().run()
    closeLinkPanel()
    return
  }

  if (!isAllowedLinkUrl(href)) {
    linkError.value = 'Use http, https, or mailto.'
    return
  }

  instance.chain().focus().extendMarkRange('link').setLink({ href }).run()
  closeLinkPanel()
}

function removeLink() {
  editor.value?.chain().focus().extendMarkRange('link').unsetLink().run()
  closeLinkPanel()
}

function closeLinkPanel() {
  linkPanelOpen.value = false
  linkUrl.value = ''
  linkError.value = null
}

function normalizeLinkUrl(raw: string): string {
  const value = raw.trim()
  if (!value) return ''
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) return value
  return `https://${value}`
}

function isAllowedLinkUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:'
  } catch {
    return false
  }
}
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-input bg-background transition-shadow focus-within:ring-1 focus-within:ring-ring">
    <div class="flex min-h-10 flex-wrap items-center gap-1 border-b border-border bg-muted/30 px-1.5 py-1">
      <Tooltip>
        <TooltipTrigger as-child>
          <button type="button" :class="boldButtonClass" :disabled="!canEdit" aria-label="Bold" @click="toggleBold">
            <Bold class="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Bold</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <button type="button" :class="italicButtonClass" :disabled="!canEdit" aria-label="Italic" @click="toggleItalic">
            <Italic class="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Italic</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <button type="button" :class="underlineButtonClass" :disabled="!canEdit" aria-label="Underline" @click="toggleUnderline">
            <Underline class="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Underline</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <button type="button" :class="strikeButtonClass" :disabled="!canEdit" aria-label="Strikethrough" @click="toggleStrike">
            <Strikethrough class="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Strikethrough</TooltipContent>
      </Tooltip>

      <div class="mx-0.5 h-5 w-px bg-border" />

      <Tooltip>
        <TooltipTrigger as-child>
          <button type="button" :class="bulletListButtonClass" :disabled="!canEdit" aria-label="Bullet list" @click="toggleBulletList">
            <List class="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Bullet list</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <button type="button" :class="orderedListButtonClass" :disabled="!canEdit" aria-label="Numbered list" @click="toggleOrderedList">
            <ListOrdered class="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Numbered list</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <button type="button" :class="plainButtonClass" :disabled="!canOutdentList" aria-label="Outdent list item" @click="outdentList">
            <IndentDecrease class="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Outdent</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <button type="button" :class="plainButtonClass" :disabled="!canIndentList" aria-label="Indent list item" @click="indentList">
            <IndentIncrease class="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Indent</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <button type="button" :class="blockquoteButtonClass" :disabled="!canEdit" aria-label="Quote" @click="toggleBlockquote">
            <Quote class="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Quote</TooltipContent>
      </Tooltip>

      <div class="mx-0.5 h-5 w-px bg-border" />

      <Tooltip>
        <TooltipTrigger as-child>
          <button type="button" :class="linkButtonClass" :disabled="!canEdit" aria-label="Edit link" @click="toggleLinkPanel">
            <LinkIcon class="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Link</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <button type="button" :class="plainButtonClass" :disabled="!canEdit || !isLinkActive" aria-label="Remove link" @click="removeLink">
            <Unlink class="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Remove link</TooltipContent>
      </Tooltip>

      <div class="mx-0.5 h-5 w-px bg-border" />

      <Tooltip>
        <TooltipTrigger as-child>
          <button type="button" :class="plainButtonClass" :disabled="!canUndo" aria-label="Undo" @click="undo">
            <Undo2 class="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Undo</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <button type="button" :class="plainButtonClass" :disabled="!canRedo" aria-label="Redo" @click="redo">
            <Redo2 class="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Redo</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <button type="button" :class="plainButtonClass" :disabled="!canEdit" aria-label="Clear formatting" @click="clearFormatting">
            <Eraser class="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Clear formatting</TooltipContent>
      </Tooltip>

      <div class="mx-0.5 h-5 w-px bg-border" />

      <Tooltip>
        <TooltipTrigger as-child>
          <button type="button" :class="previewButtonClass" aria-label="Preview description" @click="togglePreview">
            <PencilLine v-if="previewOpen" class="size-4" />
            <Eye v-else class="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{{ previewOpen ? 'Edit' : 'Preview' }}</TooltipContent>
      </Tooltip>
    </div>

    <div v-if="linkPanelOpen" class="flex flex-wrap items-start gap-2 border-b border-border bg-card px-2 py-2">
      <label class="min-w-0 flex-1">
        <span class="sr-only">Link URL</span>
        <input
          v-model="linkUrl"
          type="url"
          class="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-1 focus:ring-ring"
          placeholder="https://example.com"
          @keydown.enter.prevent="applyLink"
          @keydown.esc.prevent="closeLinkPanel"
        />
        <span v-if="linkError" class="mt-1 block text-xs text-destructive">{{ linkError }}</span>
      </label>
      <div class="flex shrink-0 items-center gap-1">
        <Tooltip>
          <TooltipTrigger as-child>
            <button
              type="button"
              class="inline-flex size-8 items-center justify-center rounded-md border border-input hover:bg-muted"
              aria-label="Apply link"
              @click="applyLink"
            >
              <Check class="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Apply</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child>
            <button
              type="button"
              class="inline-flex size-8 items-center justify-center rounded-md border border-input hover:bg-muted"
              aria-label="Cancel link"
              @click="closeLinkPanel"
            >
              <X class="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Cancel</TooltipContent>
        </Tooltip>
      </div>
    </div>

    <div
      v-if="previewOpen"
      class="min-h-[10rem] px-3 py-2 text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5"
    >
      <!-- eslint-disable-next-line vue/no-v-html -- sanitized by sanitizeDescriptionHtml -->
      <div v-if="previewHtml" v-html="previewHtml"></div>
      <p v-else class="italic text-muted-foreground">No description available.</p>
    </div>
    <EditorContent v-else-if="editor" :editor="editor" :class="{ 'pointer-events-none opacity-50': disabled }" />
  </div>
</template>
