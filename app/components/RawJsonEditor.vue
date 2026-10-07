<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, useId, useTemplateRef, watch } from 'vue'
import Button from '#layers/sine/app/components/UI/Button.vue'
import type { Layout } from '../utils/layout'

/**
 * The layout as KLE JSON, editable: the JSON tool's body. Every edit is checked
 * in the background parser as it is typed, and Apply puts a valid one on the
 * canvas as one undoable step. Unapplied text stays with its document.
 */
const props = defineProps<{ text: string; changed: boolean; parse: (text: string) => Promise<Layout> }>()
const emit = defineEmits<{
  change: [text: string]
  apply: [layout: Layout, source: string]
  discard: []
}>()
const status = ref<'checking' | 'valid' | 'invalid'>('checking')
const error = ref('')
const parsed = shallowRef<Layout>()
const statusId = useId()
const field = useTemplateRef<HTMLTextAreaElement>('field')
let version = 0
let timer: ReturnType<typeof setTimeout> | undefined
let validatedText = ''

watch(() => props.text, text => {
  const request = ++version
  clearTimeout(timer)
  status.value = 'checking'
  error.value = ''
  parsed.value = undefined
  timer = setTimeout(async () => {
    try {
      const layout = await props.parse(text)
      if (request !== version) return
      parsed.value = layout
      validatedText = text
      status.value = 'valid'
    } catch (reason) {
      if (request !== version) return
      error.value = reason instanceof Error ? reason.message : String(reason)
      status.value = 'invalid'
    }
  }, 350)
}, { immediate: true, flush: 'sync' })

const message = computed(() => {
  if (status.value === 'checking') return 'Checking…'
  if (status.value === 'invalid') return error.value
  return props.changed ? 'A valid layout. Apply it to put it on the canvas.' : 'The layout on the canvas.'
})

function apply() {
  if (status.value === 'valid' && parsed.value && validatedText === props.text) emit('apply', parsed.value, validatedText)
}
function onKeydown(event: KeyboardEvent) {
  // The editor's own chord for its own action, as a form's submit would be.
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    apply()
  }
}
defineExpose({ focus: () => field.value?.focus() })
onBeforeUnmount(() => { version++; clearTimeout(timer) })
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-3 px-4 pb-4">
    <textarea
      ref="field"
      :value="text"
      class="type-data min-h-0 flex-1 resize-none overflow-auto whitespace-pre rounded-xl bg-surface p-3 text-xs leading-5 text-ink outline-none ring-1 ring-inset ring-line focus:ring-2 focus:ring-surface-inverse"
      wrap="off"
      aria-label="Layout JSON"
      :aria-invalid="status === 'invalid' || undefined"
      :aria-describedby="statusId"
      spellcheck="false"
      autocomplete="off"
      @input="emit('change', ($event.target as HTMLTextAreaElement).value)"
      @keydown="onKeydown" />
    <div class="flex min-h-8 items-center gap-2">
      <p
        :id="statusId"
        role="status"
        aria-live="polite"
        class="type-caption line-clamp-3 min-w-0 flex-1 break-words"
        :class="status === 'invalid' && 'text-bad'">
        {{ message }}
      </p>
      <Button variant="ghost" size="sm" :disabled="!changed" @click="emit('discard')">Discard</Button>
      <Button size="sm" :disabled="!changed || status !== 'valid'" @click="apply">Apply</Button>
    </div>
  </div>
</template>
