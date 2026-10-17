<script setup>
import { ref } from 'vue'

const open = ref(false)
const inputValue = ref('')

const messages = ref([
  { from: 'biscuit', text: "I'm Biscuit — this is a demo chat. Responses are placeholder copy." },
  { from: 'biscuit', text: "Choose a barebones kit, switches and keycaps to start building your keyboard." },
])

const quickChips = ['Barebones kit?', '3-pin vs 5-pin switches', 'ANSI vs ISO keycaps', 'Save my build']

function toggleChat() {
  open.value = !open.value
}

function closeChat() {
  open.value = false
}

function sendMessage() {
  const text = inputValue.value.trim()
  if (!text) return
  messages.value.push({ from: 'user', text })
  inputValue.value = ''
  // Demo placeholder reply — rules-based, no AI claim
  messages.value.push({
    from: 'biscuit',
    text: 'Meow — that is a demo reply. This chat is placeholder copy.',
  })
}

function handleChip(chip) {
  if (/save/i.test(chip)) {
    messages.value.push({ from: 'user', text: chip })
    messages.value.push({
      from: 'biscuit',
      text: 'The cloud save is not available yet — keep building your keyboard.',
    })
    inputValue.value = ''
    return
  }
  inputValue.value = chip
  sendMessage()
}
</script>

<template>
  <!-- Mascot: fixed bottom-right, never covers task controls / primary CTA -->
  <button
    class="lct-mascot catbtn"
    @click="toggleChat"
    @keydown.esc="closeChat"
    aria-label="Open chat with Biscuit"
    :aria-expanded="open"
    tabindex="0"
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
    @keydown.esc="closeChat"
  >
    <div class="lct-chat__overlay" @click="closeChat" />
    <div class="lct-chat__panel" @click.self>
      <div class="lct-chat__header">
        <span class="lct-chat__title">Chat with Biscuit</span>
        <span class="lct-chat__demo-tag">demo / placeholder</span>
        <button class="lct-chat__close" @click="closeChat" aria-label="Close chat">×</button>
      </div>
      <div class="lct-chat__messages msgs" role="status" aria-live="polite">
        <div
          v-for="(msg, i) in messages"
          :key="i"
          class="lct-chat__msg"
          :class="`lct-chat__msg--${msg.from}`"
        >
          {{ msg.text }}
        </div>
      </div>
      <form class="lct-chat__input-row chatin" @submit.prevent="sendMessage">
        <input
          v-model="inputValue"
          type="text"
          placeholder="Type a message…"
          class="lct-chat__input-field"
        />
        <button
          class="lct-chat__send"
          type="button"
          @click="sendMessage"
          :disabled="!inputValue.trim()"
        >
          Send
        </button>
      </form>
      <div class="lct-chat__chips quick">
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
  background: var(--lct-accent-indigo, #3346FF);
  color: var(--lct-on-accent, #FFFFFF);
  border: none;
  border-radius: 999px;
  font-size: 24px;
  cursor: pointer;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
}

.lct-mascot:focus-visible {
  outline: 2px solid var(--lct-accent-indigo, #3346FF);
  outline-offset: 2px;
}

.lct-mascot__badge {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 16px;
  height: 16px;
  background: var(--lct-danger-orange, #D2461A);
  color: var(--lct-on-accent, #FFFFFF);
  border-radius: 999px;
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
  background: var(--lct-card-surface, #FFFFFF);
  border: 1px solid var(--lct-line-grey, #D6DAE3);
  border-radius: var(--lct-rounded-card, 18px);
  width: 320px;
  max-width: 92vw;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.35);
}

.lct-chat__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--lct-line-grey, #D6DAE3);
}

.lct-chat__title {
  font-weight: 600;
  color: var(--lct-text-ink, #12151C);
}

.lct-chat__demo-tag {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--lct-warning-ochre, #9A6400);
  background: var(--lct-danger-tint, #FCE6DD);
  padding: 2px 8px;
  border-radius: 999px;
  margin-left: 8px;
}

.lct-chat__close {
  background: none;
  border: none;
  font-size: 20px;
  color: var(--lct-muted-ink, #596072);
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.lct-chat__close:focus-visible {
  outline: 2px solid var(--lct-accent-indigo, #3346FF);
  outline-offset: 2px;
}

.lct-chat__messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--lct-text-ink, #12151C);
  font-size: 14px;
  line-height: 1.5;
}

.lct-chat__msg {
  padding: 8px 12px;
  border-radius: var(--lct-rounded-row, 14px);
  max-width: 85%;
}

.lct-chat__msg--biscuit {
  background: var(--lct-accent-tint, #E2E5FF);
  align-self: flex-start;
}

.lct-chat__msg--user {
  background: var(--lct-accent-indigo, #3346FF);
  color: var(--lct-on-accent, #FFFFFF);
  align-self: flex-end;
}

.lct-chat__input-row {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--lct-line-grey, #D6DAE3);
}

.lct-chat__input-field {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid var(--lct-line-grey, #D6DAE3);
  border-radius: var(--lct-rounded-control, 12px);
  font-size: 14px;
  font-family: inherit;
}

.lct-chat__input-field:focus {
  outline: 2px solid var(--lct-accent-indigo, #3346FF);
  outline-offset: 2px;
  border-color: var(--lct-accent-indigo, #3346FF);
}

.lct-chat__send {
  padding: 10px 16px;
  background: var(--lct-accent-indigo, #3346FF);
  color: var(--lct-on-accent, #FFFFFF);
  border: none;
  border-radius: var(--lct-rounded-control, 12px);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.lct-chat__send:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.lct-chat__send:focus-visible {
  outline: 2px solid var(--lct-accent-indigo, #3346FF);
  outline-offset: 2px;
}

.lct-chat__chips {
  display: flex;
  gap: 6px;
  padding: 12px 16px;
  border-top: 1px solid var(--lct-line-grey, #D6DAE3);
  overflow-x: auto;
}

.lct-chat__chip {
  padding: 6px 12px;
  background: var(--lct-sunken-surface, #F4F5F9);
  border: 1px solid var(--lct-line-grey, #D6DAE3);
  border-radius: 999px;
  font-size: 12px;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  color: var(--lct-text-ink, #12151C);
  cursor: pointer;
  white-space: nowrap;
}

.lct-chat__chip:hover {
  border-color: var(--lct-accent-indigo, #3346FF);
}

.lct-chat__chip:focus-visible {
  outline: 2px solid var(--lct-accent-indigo, #3346FF);
  outline-offset: 2px;
}
</style>
