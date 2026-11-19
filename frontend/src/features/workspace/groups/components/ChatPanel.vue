<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import BaseButton from '@/shared/components/BaseButton.vue'
import { formatMessageTime } from '../format'
import { useGroups } from '../useGroups'
import type { Channel } from '../types'
import PersonAvatar from './PersonAvatar.vue'

const props = defineProps<{ groupId: string; channel: Channel }>()
const store = useGroups()
const group = computed(() => store.group(props.groupId))
const messages = computed(() => store.channelMessages(props.channel.id))
const permission = computed(() => store.canPost(props.groupId, props.channel.id))
const drafts = reactive<Record<string, string>>({})
const draftKey = computed(() => `${props.groupId}:${props.channel.id}`)
const text = computed({
  get: () => drafts[draftKey.value] ?? '',
  set: (value: string) => { drafts[draftKey.value] = value },
})
const error = ref('')
const scroller = ref<HTMLElement | null>(null)
const input = ref<HTMLTextAreaElement | null>(null)

function scrollToBottom(): void {
  void nextTick(() => {
    if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
  })
}

watch(draftKey, () => {
  error.value = ''
  store.markRead(props.channel.id)
  scrollToBottom()
}, { immediate: true })

watch(() => messages.value.length, () => {
  const el = scroller.value
  const nearBottom = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120
  store.markRead(props.channel.id)
  if (nearBottom) scrollToBottom()
})

function send(): void {
  if (!text.value.trim() || !permission.value.ok) return
  error.value = ''
  const result = store.sendTextMessage(props.groupId, props.channel.id, text.value)
  if (!result.ok) {
    error.value = result.error
    return
  }
  text.value = ''
  scrollToBottom()
  input.value?.focus()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    send()
  }
}
</script>

<template>
  <section class="chat" aria-label="Trò chuyện nhóm">
    <header class="chat__header">
      <h1>{{ group?.name ?? 'Trò chuyện' }}</h1>
    </header>

    <div ref="scroller" class="chat__messages ws-scroll" role="log" aria-label="Tin nhắn" aria-live="polite" aria-relevant="additions" data-test="chat-scroll">
      <p v-if="!messages.length" class="chat__empty">Chưa có tin nhắn. Hãy gửi lời chào đầu tiên.</p>
      <article v-for="message in messages" :key="message.id" class="message" :data-test="`msg-${message.id}`">
        <PersonAvatar :person="store.person(message.authorId)" :size="36" />
        <div class="message__body">
          <div class="message__meta">
            <strong>{{ store.displayName(groupId, message.authorId) }}</strong>
            <time :datetime="message.at">{{ formatMessageTime(message.at) }}</time>
          </div>
          <p>{{ message.text || 'Tin nhắn không có nội dung văn bản.' }}</p>
        </div>
      </article>
    </div>

    <form class="chat__composer" @submit.prevent="send">
      <label class="visually-hidden" for="group-message">Tin nhắn</label>
      <div class="chat__input-row">
        <textarea
          id="group-message"
          ref="input"
          v-model="text"
          class="ws-input chat__input"
          placeholder="Nhập tin nhắn…"
          rows="2"
          maxlength="2000"
          :disabled="!permission.ok"
          aria-describedby="group-message-hint group-message-error"
          @keydown="onKeydown"
        />
        <BaseButton type="submit" class="ws-btn-auto" :disabled="!text.trim() || !permission.ok">Gửi</BaseButton>
      </div>
      <p id="group-message-hint" class="chat__hint">Enter để gửi · Shift + Enter để xuống dòng</p>
      <p v-if="error || !permission.ok" id="group-message-error" class="chat__error" role="alert">
        {{ error || (!permission.ok ? permission.error : '') }}
      </p>
    </form>
  </section>
</template>

<style scoped>
.chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  min-width: 0;
  background: var(--ws-bg);
}

.chat__header {
  flex: none;
  padding: 1.125rem 1.5rem;
  border-bottom: 1px solid var(--ws-border);
  background: var(--ws-surface);
}

.chat__header h1 {
  margin: 0;
  overflow-wrap: anywhere;
  font-size: 1.125rem;
}

.chat__messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1.25rem 1.5rem;
}

.chat__empty {
  color: var(--ws-text-3);
  text-align: center;
}

.message {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.message__body {
  flex: 1;
  min-width: 0;
}

.message__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25rem 0.75rem;
}

.message__meta strong {
  font-size: 0.875rem;
  overflow-wrap: anywhere;
}

.message__meta time {
  font-size: 0.75rem;
  color: var(--ws-text-3);
}

.message__body p {
  margin: 0.25rem 0 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.6;
}

.chat__composer {
  flex: none;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--ws-border);
  background: var(--ws-surface);
}

.chat__input-row {
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
}

.chat__input {
  flex: 1;
  min-width: 0;
  height: auto;
  min-height: 3.5rem;
  max-height: 10rem;
  resize: vertical;
}

.chat__hint,
.chat__error {
  margin: 0.5rem 0 0;
  font-size: 0.75rem;
  color: var(--ws-text-3);
}

.chat__error {
  color: var(--ws-danger);
}

@media (max-width: 36rem) {
  .chat__header,
  .chat__messages,
  .chat__composer {
    padding: 0.875rem;
  }

  .chat__input-row {
    gap: 0.5rem;
  }
}
</style>
