<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getSupabase } from '../lib/supabase.js'

const CAT_SVG = `<svg viewBox="0 0 120 120" aria-hidden="true"><path d="M22 52 L25 13 L53 34 Z" fill="#F2A65A" stroke="#2B1D12" stroke-width="4" stroke-linejoin="round"/><path d="M98 52 L95 13 L67 34 Z" fill="#F2A65A" stroke="#2B1D12" stroke-width="4" stroke-linejoin="round"/><path d="M30 40 L30 24 L43 34 Z" fill="#F7B8B0"/><path d="M90 40 L90 24 L77 34 Z" fill="#F7B8B0"/><ellipse cx="60" cy="93" rx="47" ry="24" fill="#F2A65A" stroke="#2B1D12" stroke-width="4"/><ellipse cx="60" cy="58" rx="43" ry="36" fill="#F2A65A" stroke="#2B1D12" stroke-width="4"/><path d="M50 25 q10 7 20 0 M45 33 q15 8 30 0" stroke="#D9803A" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M37 58 q6 -7 12 0 M71 58 q6 -7 12 0" stroke="#2B1D12" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="33" cy="70" r="6" fill="#F7B8B0"/><circle cx="87" cy="70" r="6" fill="#F7B8B0"/><path d="M55 65 h10 l-5 5 z" fill="#E77A86" stroke="#2B1D12" stroke-width="2" stroke-linejoin="round"/><path d="M60 70 q-4 6 -9 3 M60 70 q4 6 9 3" stroke="#2B1D12" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M12 62 L31 65 M12 72 L31 71 M108 62 L89 65 M108 72 L89 71" stroke="#2B1D12" stroke-width="2.5" stroke-linecap="round"/><rect x="43" y="89" width="34" height="25" rx="6" fill="#3346FF" stroke="#2B1D12" stroke-width="3"/><rect x="47" y="91" width="26" height="16" rx="4" fill="#6573FF"/><ellipse cx="43" cy="104" rx="9" ry="7" fill="#FBE3C8" stroke="#2B1D12" stroke-width="3"/><ellipse cx="77" cy="104" rx="9" ry="7" fill="#FBE3C8" stroke="#2B1D12" stroke-width="3"/></svg>`

const open = ref(false)
const badge = ref(true)
const inputValue = ref('')
const mascotBtn = ref(null)
const chatPanel = ref(null)
const chatInput = ref(null)
const msgBox = ref(null)

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
    badge.value = false
    await nextTick()
    chatInput.value?.focus()
    if (msgBox.value) {
      msgBox.value.scrollTop = msgBox.value.scrollHeight
    }
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
  nextTick(() => {
    chatInput.value?.focus()
    if (msgBox.value) {
      msgBox.value.scrollTop = msgBox.value.scrollHeight
    }
  })
}

function handleChip(chip) {
  messages.value.push({ from: 'user', text: chip })
  messages.value.push({
    from: 'biscuit',
    text: getDemoReply(chip),
  })
  nextTick(() => {
    if (msgBox.value) {
      msgBox.value.scrollTop = msgBox.value.scrollHeight
    }
  })
}
</script>

<template>
  <!-- Mascot: fixed bottom-right, never covers task controls / primary CTA -->
  <button
    ref="mascotBtn"
    class="lct-mascot"
    @click="toggleChat"
    :aria-label="open ? 'Close chat with Biscuit' : badge ? 'Open chat with Biscuit (1 unread message)' : 'Open chat with Biscuit'"
    :aria-expanded="open"
    type="button"
  >
    <span class="lct-mascot__cat" v-html="CAT_SVG" aria-hidden="true"></span>
    <span v-if="badge" class="cat-badge" aria-hidden="true">1</span>
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
        <span class="lct-chat__av" v-html="CAT_SVG" aria-hidden="true"></span>
        <span class="lct-chat__title">Biscuit</span>
        <span class="lct-chat__demo-tag">demo / placeholder</span>
        <button class="lct-chat__close" type="button" @click="closeChat" aria-label="Close chat">×</button>
      </div>
      <div ref="msgBox" class="lct-chat__messages" role="status" aria-live="polite">
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
  width: 88px;
  height: 88px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  filter: drop-shadow(0 8px 14px rgba(0, 0, 0, 0.22));
  animation: lct-bob 3.2s ease-in-out infinite;
}

.lct-mascot:hover {
  animation: lct-wiggle 0.5s ease-in-out;
}

.lct-mascot:focus-visible {
  outline: 2px solid var(--lct-accent-indigo);
  outline-offset: 4px;
  border-radius: 50%;
}

.lct-mascot :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}

.lct-mascot__cat {
  display: block;
  width: 100%;
  height: 100%;
}

@keyframes lct-bob {
  50% {
    transform: translateY(-6px);
  }
}

@keyframes lct-wiggle {
  25% {
    transform: rotate(-6deg);
  }
  75% {
    transform: rotate(6deg);
  }
}

.cat-badge {
  position: absolute;
  top: 2px;
  right: 4px;
  min-width: 22px;
  height: 22px;
  border-radius: 11px;
  background: #C8431B;
  color: #ffffff;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  line-height: 22px;
  text-align: center;
  border: 2px solid var(--lct-card-surface);
}

.lct-chat {
  position: fixed;
  bottom: 120px;
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
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--lct-line-grey);
}

.lct-chat__av {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--lct-sunken-surface);
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  overflow: hidden;
}

.lct-chat__av :deep(svg) {
  width: 30px;
  height: 30px;
  display: block;
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
}

.lct-chat__close {
  margin-left: auto;
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
  .lct-mascot {
    right: 16px;
    bottom: 16px;
    width: 72px;
    height: 72px;
  }

  .lct-chat {
    right: 16px;
    bottom: 96px;
  }
}
</style>
