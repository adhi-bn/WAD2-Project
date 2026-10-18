<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getSupabase } from '../lib/supabase.js'

const open = ref(false)
const inputValue = ref('')
const mascotBtn = ref(null)
const chatPanel = ref(null)
const chatInput = ref(null)

const messages = ref([
  { from: 'biscuit', text: "I'm Biscuit — this is a demo chat. Responses are placeholder copy." },
  { from: 'biscuit', text: 'Choose a barebones kit, switches and keycaps to start building your keyboard.' },
])

const quickChips = ['Barebones kit?', '5-pin switches?', 'ANSI vs ISO keycaps', 'Save my build']

function getDemoReply(text) {
  if (/save|cloud/i.test(text)) {
    const supabase = getSupabase()
    if (!supabase) {
      return 'Cloud save is not available because Supabase is not configured — keep building your keyboard locally in your browser.'
    }
    return 'Cloud save is a demo placeholder right now — keep building your keyboard locally.'
  }
  if (/barebones/i.test(text)) {
    return 'A barebones kit is the base unit with the case and fixed internals bundled and priced as one Part.'
  }
  if (/switch|5-pin/i.test(text)) {
    return 'Our builder uses a 5-pin-only switch policy so every switch fits 5-pin hot-swap barebones sockets.'
  }
  if (/keycap|ansi|iso/i.test(text)) {
    return 'Pick a keycap set whose physical layout (ANSI or ISO) matches your barebones kit.'
  }
  return 'Meow — that is a demo reply. This chat is placeholder copy.'
}

function toggleChat() {
  if (open.value) {
    closeChat()
  } else {
    open.value = true
  }
}

function closeChat() {
  if (!open.value) return
  open.value = false
  nextTick(() => {
    mascotBtn.value?.focus()
  })
}

watch(open, async (isOpen) => {
  if (isOpen) {
    await nextTick()
    chatInput.value?.focus()
  }
})

function handleDocumentKeydown(event) {
  if (!open.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    closeChat()
    return
  }
  if (event.key === 'Tab' && chatPanel.value) {
    const focusables = Array.from(
      chatPanel.value.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
      ),
    )
    if (!focusables.length) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const active = document.activeElement
    if (event.shiftKey) {
      if (active === first || !chatPanel.value.contains(active)) {
        event.preventDefault()
        last.focus()
      }
    } else if (active === last || !chatPanel.value.contains(active)) {
      event.preventDefault()
      first.focus()
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleDocumentKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleDocumentKeydown)
})

function sendMessage() {
  const text = inputValue.value.trim()
  if (!text) return
  messages.value.push({ from: 'user', text })
  inputValue.value = ''
  messages.value.push({
    from: 'biscuit',
    text: getDemoReply(text),
  })
}

function handleChip(chip) {
  messages.value.push({ from: 'user', text: chip })
  messages.value.push({
    from: 'biscuit',
    text: getDemoReply(chip),
  })
}
</script>

<template>
  <!-- Mascot: fixed bottom-right, never covers task controls / primary CTA -->
  <button
    ref="mascotBtn"
    class="lct-mascot"
    @click="toggleChat"
    aria-label="Open chat with Biscuit"
    :aria-expanded="open"
    type="button"
  >
    <span class="lct-mascot__mark" aria-hidden="true">🐾</span>
    <span class="lct-mascot__badge" v-if="!open" aria-hidden="true">!</span>
  </button>

  <!-- Chat dialog: labelled demo/placeholder, never auto-opens (open starts false) -->
  <div
    v-if="open"
    class="lct-chat"
    role="dialog"
    aria-modal="true"
    aria-label="Chat with Biscuit — demo / placeholder"
  >
    <div class="lct-chat__overlay" @click="closeChat" />
    <div ref="chatPanel" class="lct-chat__panel">
      <div class="lct-chat__header">
        <span class="lct-chat__title">Chat with Biscuit</span>
        <span class="lct-chat__demo-tag">demo / placeholder</span>
        <button class="lct-chat__close" type="button" @click="closeChat" aria-label="Close chat">×</button>
      </div>
      <div class="lct-chat__messages" role="status" aria-live="polite">
        <div
          v-for="(msg, i) in messages"
          :key="i"
          class="lct-chat__msg"
          :class="`lct-chat__msg--${msg.from}`"
        >
          {{ msg.text }}
        </div>
      </div>
      <form class="lct-chat__input-row" @submit.prevent="sendMessage">
        <input
          ref="chatInput"
          v-model="inputValue"
          type="text"
          placeholder="Type a message…"
          class="lct-chat__input-field"
        />
        <button
          class="lct-chat__send"
          type="submit"
          :disabled="!inputValue.trim()"
        >
          Send
        </button>
      </form>
      <div class="lct-chat__chips">
        <button
          v-for="(chip, i) in quickChips"
          :key="i"
          class="lct-chat__chip"
          type="button"
          @click="handleChip(chip)"
        >
          {{ chip }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* prefers-reduced-motion: no animation */
@media (prefers-reduced-motion: reduce) {
  .lct-mascot,
  .lct-chat__panel {
    transition: none !important;
    animation: none !important;
  }
}

.lct-mascot {
  position: fixed;
  bottom: 28px;
  right: 28px;
  z-index: 1000;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  background: var(--lct-accent-indigo);
  color: var(--lct-on-accent);
  border: none;
  border-radius: var(--lct-radius-pill);
  font-size: 24px;
  cursor: pointer;
  box-shadow: var(--lct-shadow-card);
}

.lct-mascot:focus-visible {
  outline: 2px solid var(--lct-accent-indigo);
  outline-offset: 2px;
}

.lct-mascot__badge {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 16px;
  height: 16px;
  background: var(--lct-danger-orange);
  color: var(--lct-on-accent);
  border-radius: var(--lct-radius-pill);
  font-size: 10px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.lct-chat {
  position: fixed;
  bottom: 96px;
  right: 28px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lct-chat__overlay {
  position: fixed;
  inset: 0;
  background: rgba(18, 21, 28, 0.45);
  backdrop-filter: blur(2px);
}

.lct-chat__panel {
  position: relative;
  z-index: 1;
  background: var(--lct-card-surface);
  border: 1px solid var(--lct-line-grey);
  border-radius: var(--lct-radius-card);
  width: min(360px, calc(100vw - 32px));
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--lct-shadow-card);
}

.lct-chat__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--lct-line-grey);
}

.lct-chat__title {
  font-weight: 600;
  color: var(--lct-text-ink);
}

.lct-chat__demo-tag {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lct-text-ink);
  background: var(--lct-danger-tint);
  padding: 2px 8px;
  border-radius: var(--lct-radius-tag);
  margin-left: 8px;
}

.lct-chat__close {
  background: none;
  border: none;
  min-width: 36px;
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: var(--lct-muted-ink);
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.lct-chat__close:focus-visible {
  outline: 2px solid var(--lct-accent-indigo);
  outline-offset: 2px;
}

.lct-chat__messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--lct-text-ink);
  font-size: 14px;
  line-height: 1.5;
}

.lct-chat__msg {
  padding: 8px 12px;
  border-radius: var(--lct-radius-row);
  max-width: 85%;
}

.lct-chat__msg--biscuit {
  background: var(--lct-accent-tint);
  align-self: flex-start;
}

.lct-chat__msg--user {
  background: var(--lct-accent-indigo);
  color: var(--lct-on-accent);
  align-self: flex-end;
}

.lct-chat__input-row {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--lct-line-grey);
}

.lct-chat__input-field {
  flex: 1;
  padding: 10px 14px;
  background: var(--lct-sunken-surface);
  color: var(--lct-text-ink);
  border: 1px solid var(--lct-line-grey);
  border-radius: var(--lct-radius-control);
  font-size: 14px;
  font-family: inherit;
}

.lct-chat__input-field:focus {
  outline: 2px solid var(--lct-accent-indigo);
  outline-offset: 2px;
  border-color: var(--lct-accent-indigo);
}

.lct-chat__send {
  padding: 10px 16px;
  background: var(--lct-accent-indigo);
  color: var(--lct-on-accent);
  border: none;
  border-radius: var(--lct-radius-pill);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.lct-chat__send:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.lct-chat__send:focus-visible {
  outline: 2px solid var(--lct-accent-indigo);
  outline-offset: 2px;
}

.lct-chat__chips {
  display: flex;
  gap: 6px;
  padding: 12px 16px;
  border-top: 1px solid var(--lct-line-grey);
  overflow-x: auto;
}

.lct-chat__chip {
  padding: 6px 12px;
  background: var(--lct-sunken-surface);
  border: 1px solid var(--lct-line-grey);
  border-radius: var(--lct-radius-pill);
  font-size: 12px;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  color: var(--lct-text-ink);
  cursor: pointer;
  white-space: nowrap;
}

.lct-chat__chip:hover {
  border-color: var(--lct-accent-indigo);
}

.lct-chat__chip:focus-visible {
  outline: 2px solid var(--lct-accent-indigo);
  outline-offset: 2px;
}

@media (max-width: 420px) {
  .lct-mascot,
  .lct-chat {
    right: 16px;
    bottom: 16px;
  }
}
</style>
