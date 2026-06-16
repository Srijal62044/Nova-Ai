/* ============================================================
   NOVA AI — script.js
   Full application logic: Gemini API, chat management,
   voice, image generation, settings, and more.
   ============================================================ */

'use strict';

/* ── Gemini API Configuration ─────────────────────────────── */
const GEMINI_API_KEY = "AQ.Ab8RN6LKE3oeoGJ_q_9zjJkU527HmFoKKqq_QlupELPGNUSgGA";

// Chat models tried in order — falls back on quota (429), not-found (404), or unavailable (503)
const GEMINI_CHAT_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash-8b-latest',
  'gemini-1.5-pro-latest',
  'gemini-pro',
];

// Image generation models tried in order
const GEMINI_IMAGE_MODELS = [
  'gemini-2.0-flash-exp-image-generation',
  'gemini-2.0-flash-preview-image-generation',
];

/** Return a human-readable message from a raw Gemini API error */
function parseGeminiError(status, rawMessage) {
  if (!rawMessage) rawMessage = '';
  if (status === 429 || rawMessage.includes('Quota exceeded') || rawMessage.includes('quota')) {
    return 'Rate limit reached for this API key. Nova will automatically retry with a different model — please wait a moment and try again.';
  }
  if (status === 400) return 'Invalid request — please rephrase your message and try again.';
  if (status === 401 || status === 403) return 'API key is invalid or unauthorised. Please check the key and redeploy.';
  if (status === 503 || status === 500) return 'The Gemini service is temporarily unavailable. Please try again in a moment.';
  if (!navigator.onLine) return 'You appear to be offline. Check your internet connection and try again.';
  // Trim the raw message to remove excessive repetition
  return rawMessage.split('*')[0].trim().slice(0, 160) || `API error ${status}.`;
}

/* ── App State ────────────────────────────────────────────── */
let state = {
  chats: {},              // { [chatId]: { id, title, messages: [], createdAt, updatedAt } }
  activeChatId: null,     // currently open chat
  isGenerating: false,    // true while waiting for AI response
  voiceOutputEnabled: false,
  isRecording: false,
  recognition: null,      // SpeechRecognition instance
  synth: window.speechSynthesis,
  theme: 'dark',
  totalMessages: 0,
  todayMessages: 0,
  gallery: [],            // [{ src, prompt, timestamp }]
  currentImagePrompt: '', // used for regenerate
  renamingChatId: null,
  todayKey: new Date().toDateString(),
};

/* ── Markdown / Highlight Setup ──────────────────────────── */

/**
 * Safely highlight a code block using highlight.js.
 * Falls back to plain escaped text if hljs isn't available.
 */
function highlightCode(code, lang) {
  try {
    if (typeof hljs !== 'undefined') {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    }
  } catch (e) { /* ignore */ }
  return escapeHtml(code);
}

// Configure marked (v4 API — pinned in index.html)
try {
  marked.setOptions({ breaks: true, gfm: true });

  const renderer = new marked.Renderer();
  renderer.code = function (code, language) {
    const lang = (language || 'plaintext').trim();
    const highlighted = highlightCode(code, lang);
    const id = 'cb-' + Math.random().toString(36).slice(2, 9);
    return `<div class="code-block-wrapper" id="${id}">
      <div class="code-block-header">
        <span class="code-lang">${escapeHtml(lang)}</span>
        <button class="copy-code-btn" onclick="copyCode('${id}', this)">
          <i class="fa-regular fa-copy"></i> Copy
        </button>
      </div>
      <pre><code class="hljs language-${escapeHtml(lang)}">${highlighted}</code></pre>
    </div>`;
  };
  marked.use({ renderer });
} catch (e) {
  console.warn('marked setup failed:', e);
}

/** Render markdown safely — falls back to escaped text if marked isn't available */
function renderMarkdown(text) {
  try {
    if (typeof marked !== 'undefined' && marked.parse) {
      return marked.parse(text);
    }
  } catch (e) { /* ignore */ }
  return `<p>${escapeHtml(text).replace(/\n/g, '<br/>')}</p>`;
}

/* ============================================================
   INITIALIZATION
============================================================ */
function init() {
  loadFromStorage();
  renderChatList();
  updateStats();
  applyTheme(state.theme);
  initVoice();
  registerKeyboardShortcuts();

  // Show welcome if no active chat
  if (!state.activeChatId) {
    showWelcome();
  } else {
    openChat(state.activeChatId);
  }
}

/* ============================================================
   LOCAL STORAGE — Persistence
============================================================ */
function saveToStorage() {
  try {
    localStorage.setItem('nova_chats', JSON.stringify(state.chats));
    localStorage.setItem('nova_theme', state.theme);
    localStorage.setItem('nova_gallery', JSON.stringify(state.gallery));
    localStorage.setItem('nova_activeChatId', state.activeChatId || '');
    localStorage.setItem('nova_stats', JSON.stringify({
      totalMessages: state.totalMessages,
      todayMessages: state.todayMessages,
      todayKey: state.todayKey,
    }));
  } catch (e) {
    console.warn('Storage error:', e);
  }
}

function loadFromStorage() {
  try {
    const chats = localStorage.getItem('nova_chats');
    if (chats) state.chats = JSON.parse(chats);

    state.theme = localStorage.getItem('nova_theme') || 'dark';

    const gallery = localStorage.getItem('nova_gallery');
    if (gallery) state.gallery = JSON.parse(gallery);

    state.activeChatId = localStorage.getItem('nova_activeChatId') || null;
    // Validate activeChatId still exists
    if (state.activeChatId && !state.chats[state.activeChatId]) {
      state.activeChatId = null;
    }

    const stats = localStorage.getItem('nova_stats');
    if (stats) {
      const s = JSON.parse(stats);
      state.totalMessages = s.totalMessages || 0;
      // Reset today count if it's a new day
      const todayKey = new Date().toDateString();
      state.todayKey = todayKey;
      state.todayMessages = s.todayKey === todayKey ? (s.todayMessages || 0) : 0;
    }
  } catch (e) {
    console.warn('Load storage error:', e);
  }
}

/* ============================================================
   CHAT MANAGEMENT
============================================================ */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Create a new blank chat and open it */
function createNewChat() {
  const id = generateId();
  const chat = {
    id,
    title: 'New Chat',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  state.chats[id] = chat;
  saveToStorage();
  renderChatList();
  openChat(id);
  updateStats();
  focusInput();
}

/** Open an existing chat by ID */
function openChat(id) {
  if (!state.chats[id]) return;
  state.activeChatId = id;
  saveToStorage();
  renderChatList();
  showChatArea();
  renderAllMessages(id);
  updateTopbarTitle(state.chats[id].title);
  scrollToBottom(true);
  closeSidebar(); // close on mobile
}

/** Delete a chat */
function deleteChat(id, e) {
  e && e.stopPropagation();
  if (!confirm('Delete this conversation?')) return;
  delete state.chats[id];
  if (state.activeChatId === id) {
    state.activeChatId = null;
    showWelcome();
  }
  saveToStorage();
  renderChatList();
  updateStats();
}

/** Prompt to rename a chat */
function promptRenameChat(id, e) {
  e && e.stopPropagation();
  state.renamingChatId = id;
  const input = document.getElementById('renameInput');
  input.value = state.chats[id]?.title || '';
  openModal('renameModal');
  setTimeout(() => { input.focus(); input.select(); }, 100);
}

function confirmRename() {
  const id = state.renamingChatId;
  const val = document.getElementById('renameInput').value.trim();
  if (id && val && state.chats[id]) {
    state.chats[id].title = val;
    saveToStorage();
    renderChatList();
    if (state.activeChatId === id) updateTopbarTitle(val);
  }
  closeRenameModal();
}

function closeRenameModal() {
  closeModal('renameModal');
  state.renamingChatId = null;
}

function closeRenameOnOutside(e) {
  if (e.target.id === 'renameModal') closeRenameModal();
}

function handleRenameKeydown(e) {
  if (e.key === 'Enter') confirmRename();
  if (e.key === 'Escape') closeRenameModal();
}

/** Auto-generate a title from the first user message */
async function autoGenerateTitle(chatId, firstMessage) {
  try {
    const res = await callGemini([
      { role: 'user', parts: [{ text: `Summarize this message as a chat title in 4-6 words max, no quotes, no punctuation: "${firstMessage}"` }] }
    ]);
    const title = res?.trim() || firstMessage.slice(0, 40);
    if (state.chats[chatId]) {
      state.chats[chatId].title = title;
      saveToStorage();
      renderChatList();
      if (state.activeChatId === chatId) updateTopbarTitle(title);
    }
  } catch {
    // Keep default title on error
  }
}

/** Filter chat list by search */
function filterChats(query) {
  const items = document.querySelectorAll('.chat-item');
  const q = query.toLowerCase().trim();
  let visible = 0;
  items.forEach(item => {
    const title = item.querySelector('.chat-item-title')?.textContent?.toLowerCase() || '';
    const matches = !q || title.includes(q);
    item.style.display = matches ? '' : 'none';
    if (matches) visible++;
  });
  const noMsg = document.getElementById('noChatsMsg');
  if (noMsg) noMsg.style.display = visible === 0 ? 'block' : 'none';
}

/** Clear all chats */
function clearAllChats() {
  if (!confirm('Delete ALL conversations permanently? This cannot be undone.')) return;
  state.chats = {};
  state.activeChatId = null;
  state.totalMessages = 0;
  state.todayMessages = 0;
  saveToStorage();
  renderChatList();
  updateStats();
  showWelcome();
  closeSettings();
  showToast('All conversations cleared.', 'success');
}

/* ============================================================
   RENDER — Chat List
============================================================ */
function renderChatList() {
  const list = document.getElementById('chatList');
  const noMsg = document.getElementById('noChatsMsg');
  if (!list) return;

  // Sort chats by updatedAt descending
  const sorted = Object.values(state.chats).sort((a, b) => b.updatedAt - a.updatedAt);
  list.innerHTML = '';

  if (sorted.length === 0) {
    noMsg.style.display = 'block';
    return;
  }
  noMsg.style.display = 'none';

  sorted.forEach(chat => {
    const li = document.createElement('li');
    li.className = 'chat-item' + (chat.id === state.activeChatId ? ' active' : '');
    li.dataset.chatId = chat.id;

    // Last message preview
    const lastMsg = chat.messages[chat.messages.length - 1];
    const preview = lastMsg
      ? lastMsg.content.replace(/[#*`>]/g, '').slice(0, 50)
      : 'Empty conversation';

    li.innerHTML = `
      <button class="chat-item-btn" onclick="openChat('${chat.id}')">
        <span class="chat-item-title">${escapeHtml(chat.title)}</span>
        <span class="chat-item-meta">${escapeHtml(preview)}</span>
      </button>
      <div class="chat-item-actions">
        <button class="chat-action-btn" onclick="promptRenameChat('${chat.id}', event)" title="Rename">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="chat-action-btn delete" onclick="deleteChat('${chat.id}', event)" title="Delete">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>`;
    list.appendChild(li);
  });
}

/* ============================================================
   RENDER — Messages
============================================================ */
function renderAllMessages(chatId) {
  const container = document.getElementById('messagesContainer');
  if (!container) return;
  container.innerHTML = '';
  const chat = state.chats[chatId];
  if (!chat) return;

  chat.messages.forEach(msg => {
    const el = buildMessageElement(msg);
    container.appendChild(el);
  });
  scrollToBottom(true);
}

/** Build a DOM element for a single message */
function buildMessageElement(msg) {
  const div = document.createElement('div');
  div.className = `message ${msg.role}`;
  div.dataset.msgId = msg.id;

  const avatarIcon = msg.role === 'ai' ? 'fa-atom' : 'fa-user';
  const senderName = msg.role === 'ai' ? 'Nova AI' : 'You';
  const timeStr = formatTime(msg.timestamp);

  let contentHtml = '';

  if (msg.type === 'image') {
    // Image message — use data attributes to avoid putting base64 in onclick
    contentHtml = `
      <div class="msg-image-wrap">
        <img src="${msg.imageData}" alt="${escapeHtml(msg.content)}" class="msg-image"
          data-prompt="${escapeHtml(msg.content)}"
          onclick="openLightboxForImg(this)" />
        <p class="image-caption">🎨 ${escapeHtml(msg.content)}</p>
      </div>`;
  } else {
    // Text message — render markdown for AI, plain for user
    const rendered = msg.role === 'ai'
      ? renderMarkdown(msg.content)
      : `<p>${escapeHtml(msg.content).replace(/\n/g, '<br/>')}</p>`;
    contentHtml = rendered;
  }

  div.innerHTML = `
    <div class="msg-avatar"><i class="fa-solid ${avatarIcon}"></i></div>
    <div class="msg-bubble-wrap">
      <div class="msg-meta">
        <span class="msg-name">${senderName}</span>
        <span class="msg-time">${timeStr}</span>
      </div>
      <div class="msg-bubble">${contentHtml}</div>
      ${msg.role === 'ai' ? `
        <div class="msg-actions">
          <button class="msg-action-btn" onclick="copyMessage('${msg.id}')">
            <i class="fa-regular fa-copy"></i> Copy
          </button>
          <button class="msg-action-btn" onclick="speakMessage('${msg.id}')">
            <i class="fa-solid fa-volume-high"></i> Speak
          </button>
        </div>` : ''}
    </div>`;
  return div;
}

/** Append a single new message to the DOM */
function appendMessage(msg) {
  const container = document.getElementById('messagesContainer');
  if (!container) return;
  const el = buildMessageElement(msg);
  container.appendChild(el);
  scrollToBottom();
}

/* ============================================================
   SEND MESSAGE FLOW
============================================================ */
async function sendMessage() {
  const input = document.getElementById('userInput');
  const text = input.value.trim();
  if (!text || state.isGenerating) return;

  // Clear input, reset height
  input.value = '';
  input.style.height = '';
  setSendButtonState(true);

  // Ensure active chat
  if (!state.activeChatId) createNewChat();

  const chatId = state.activeChatId;
  const chat = state.chats[chatId];

  // Check for /image command
  if (text.startsWith('/image ')) {
    const prompt = text.slice(7).trim();
    if (prompt) {
      await handleImageGeneration(chatId, prompt);
    } else {
      showToast('Usage: /image <your prompt>', 'error');
      setSendButtonState(false);
    }
    return;
  }

  // Build user message object
  const userMsg = {
    id: generateId(),
    role: 'user',
    type: 'text',
    content: text,
    timestamp: Date.now(),
  };
  chat.messages.push(userMsg);
  chat.updatedAt = Date.now();

  // Auto-generate title from first message
  if (chat.messages.length === 1) {
    autoGenerateTitle(chatId, text);
  }

  // Update stats
  state.totalMessages++;
  state.todayMessages++;
  saveToStorage();
  updateStats();

  appendMessage(userMsg);
  showTypingIndicator();

  // Call Gemini
  try {
    const history = buildGeminiHistory(chat.messages.slice(0, -1)); // exclude the new msg
    history.push({ role: 'user', parts: [{ text }] });
    const reply = await callGemini(history);

    removeTypingIndicator();

    const aiMsg = {
      id: generateId(),
      role: 'ai',
      type: 'text',
      content: reply,
      timestamp: Date.now(),
    };
    chat.messages.push(aiMsg);
    chat.updatedAt = Date.now();
    state.totalMessages++;
    state.todayMessages++;
    saveToStorage();
    updateStats();

    appendMessage(aiMsg);

    // Voice output if enabled
    if (state.voiceOutputEnabled) {
      speakText(stripMarkdown(reply));
    }
  } catch (err) {
    removeTypingIndicator();
    showErrorMessage(err.message || 'Failed to get a response. Check your connection.');
  }

  setSendButtonState(false);
  focusInput();
}

/** Build the Gemini-compatible conversation history */
function buildGeminiHistory(messages) {
  return messages
    .filter(m => m.type === 'text')
    .map(m => ({
      role: m.role === 'ai' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
}

/* ============================================================
   GEMINI API CALLS
============================================================ */
const SYSTEM_PROMPT = `You are Nova AI, a highly intelligent, helpful, and articulate AI assistant powered by Google Gemini. You provide accurate, thoughtful, and well-structured responses. You support markdown formatting in your responses including code blocks, lists, tables, and emphasis. You are friendly but professional.`;

/**
 * Call Gemini chat API with automatic model fallback.
 * Tries each model in GEMINI_CHAT_MODELS in order.
 * Falls back on 429 (quota exceeded) and 503 (unavailable).
 * @param {Array} contents - Array of { role, parts } objects.
 * @returns {Promise<string>} - The text response.
 */
async function callGemini(contents) {
  let lastError = null;

  for (const model of GEMINI_CHAT_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.9,
            topP: 0.95,
            maxOutputTokens: 8192,
          },
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          }
        }),
      });
    } catch (networkErr) {
      // Network failure — no point trying other models
      throw new Error('Unable to reach the Gemini API. Check your internet connection.');
    }

    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
      throw new Error('Gemini returned an empty response. Please try again.');
    }

    // Parse the error body
    const errBody = await res.json().catch(() => ({}));
    const rawMsg = errBody?.error?.message || '';
    const status = res.status;

    // Fall back to the next model for quota, not-found, or service errors
    if (status === 429 || status === 404 || status === 503) {
      lastError = parseGeminiError(status, rawMsg);
      continue; // try next model
    }

    // For auth / bad-request errors, fail immediately — retrying won't help
    throw new Error(parseGeminiError(status, rawMsg));
  }

  // All models exhausted
  throw new Error(lastError || 'All Gemini models are currently rate-limited. Please wait a minute and try again.');
}

/**
 * Call Gemini Image Generation API with model fallback.
 * Tries each model in GEMINI_IMAGE_MODELS in order.
 * @param {string} prompt - The image description.
 * @returns {Promise<string>} - Base64 data URL of the generated image.
 */
async function callGeminiImage(prompt) {
  let lastErr = null;

  for (const model of GEMINI_IMAGE_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
        }),
      });
    } catch {
      throw new Error('Unable to reach the Gemini API. Check your internet connection.');
    }

    if (res.ok) {
      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const imgPart = parts.find(p => p.inlineData);
      if (imgPart?.inlineData) {
        const { mimeType, data: b64 } = imgPart.inlineData;
        return `data:${mimeType};base64,${b64}`;
      }
      // Response OK but no image part — model may have returned text only
      lastErr = 'The model responded but did not return an image. Try a more descriptive prompt.';
      continue;
    }

    const errBody = await res.json().catch(() => ({}));
    const rawMsg = errBody?.error?.message || '';
    // Fall back on 404 (model not available) and 429 (quota)
    if (res.status === 404 || res.status === 429 || res.status === 503) {
      lastErr = parseGeminiError(res.status, rawMsg);
      continue;
    }
    throw new Error(parseGeminiError(res.status, rawMsg));
  }

  throw new Error(lastErr || 'Image generation is not available with this API key. Try a standard Gemini API key from aistudio.google.com.');
}

/* ============================================================
   IMAGE GENERATION
============================================================ */
async function handleImageGeneration(chatId, prompt) {
  const chat = state.chats[chatId];
  state.isGenerating = true;
  state.currentImagePrompt = prompt;

  // Add user message
  const userMsg = {
    id: generateId(),
    role: 'user',
    type: 'text',
    content: `/image ${prompt}`,
    timestamp: Date.now(),
  };
  chat.messages.push(userMsg);
  appendMessage(userMsg);

  // Show generating indicator
  const genEl = showGeneratingIndicator();

  try {
    const dataUrl = await callGeminiImage(prompt);

    removeGeneratingIndicator(genEl);

    // Add image message
    const imgMsg = {
      id: generateId(),
      role: 'ai',
      type: 'image',
      content: prompt,
      imageData: dataUrl,
      timestamp: Date.now(),
    };
    chat.messages.push(imgMsg);
    chat.updatedAt = Date.now();

    // Add to gallery
    state.gallery.push({
      src: dataUrl,
      prompt,
      timestamp: Date.now(),
    });

    state.totalMessages += 2;
    state.todayMessages += 2;
    saveToStorage();
    updateStats();
    appendMessage(imgMsg);

    // Show gallery button
    document.getElementById('galleryBtn').style.display = 'flex';
    showToast('Image generated!', 'success');
  } catch (err) {
    removeGeneratingIndicator(genEl);
    showErrorMessage(err.message || 'Image generation failed. Please try again.');
  }

  state.isGenerating = false;
  setSendButtonState(false);
  focusInput();
}

function regenerateImage() {
  if (!state.currentImagePrompt || !state.activeChatId) return;
  closeLightbox();
  handleImageGeneration(state.activeChatId, state.currentImagePrompt);
}

/* ============================================================
   TYPING / GENERATING INDICATORS
============================================================ */
function showTypingIndicator() {
  state.isGenerating = true;
  const container = document.getElementById('messagesContainer');
  if (!container) return;

  const div = document.createElement('div');
  div.className = 'message ai';
  div.id = 'typingIndicator';
  div.innerHTML = `
    <div class="msg-avatar"><i class="fa-solid fa-atom"></i></div>
    <div class="msg-bubble-wrap">
      <div class="msg-meta"><span class="msg-name">Nova AI</span></div>
      <div class="typing-indicator">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    </div>`;
  container.appendChild(div);
  scrollToBottom();
}

function removeTypingIndicator() {
  state.isGenerating = false;
  document.getElementById('typingIndicator')?.remove();
}

function showGeneratingIndicator() {
  const container = document.getElementById('messagesContainer');
  if (!container) return null;

  const div = document.createElement('div');
  div.className = 'message ai';
  div.id = 'generatingIndicator';
  div.innerHTML = `
    <div class="msg-avatar"><i class="fa-solid fa-atom"></i></div>
    <div class="msg-bubble-wrap">
      <div class="msg-meta"><span class="msg-name">Nova AI</span></div>
      <div class="generating-overlay">
        <div class="generating-spinner"></div>
        <span class="generating-text">Generating image…</span>
      </div>
    </div>`;
  container.appendChild(div);
  scrollToBottom();
  return div;
}

function removeGeneratingIndicator(el) {
  el?.remove();
}

function showErrorMessage(text) {
  const container = document.getElementById('messagesContainer');
  if (!container) return;

  const div = document.createElement('div');
  div.className = 'message ai';

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.style.cssText = 'background:rgba(239,68,68,0.12);color:#ef4444;border-color:rgba(239,68,68,0.2)';
  avatar.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';

  const wrap = document.createElement('div');
  wrap.className = 'msg-bubble-wrap';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble error-bubble';
  bubble.style.cssText = 'border-color:rgba(239,68,68,0.25);background:rgba(239,68,68,0.06)';

  // Icon + title row
  const title = document.createElement('div');
  title.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px;font-weight:700;color:#ef4444;font-size:13px';
  title.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Something went wrong';

  // Message text — plain colour, no red dump
  const msg = document.createElement('p');
  msg.style.cssText = 'margin:0 0 10px;font-size:14px;line-height:1.6;color:var(--text-secondary)';
  msg.textContent = text;

  bubble.appendChild(title);
  bubble.appendChild(msg);
  wrap.appendChild(bubble);
  div.appendChild(avatar);
  div.appendChild(wrap);
  container.appendChild(div);
  scrollToBottom();

  // Show a brief toast only — no raw dump
  const brief = text.length > 80 ? text.slice(0, 77) + '…' : text;
  showToast(brief, 'error');
}

/* ============================================================
   VOICE FEATURES
============================================================ */
function initVoice() {
  // Speech recognition
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    state.recognition = new SpeechRecognition();
    state.recognition.continuous = false;
    state.recognition.interimResults = false;
    state.recognition.lang = 'en-US';

    state.recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      const input = document.getElementById('userInput');
      input.value += (input.value ? ' ' : '') + transcript;
      autoResizeTextarea(input);
      stopVoiceInput();
    };

    state.recognition.onerror = (e) => {
      console.warn('Speech recognition error:', e.error);
      stopVoiceInput();
      if (e.error !== 'aborted') showToast('Voice input error: ' + e.error, 'error');
    };

    state.recognition.onend = () => stopVoiceInput();
  }
}

function toggleVoiceInput() {
  if (!state.recognition) {
    showToast('Voice input not supported in this browser.', 'error');
    return;
  }
  if (state.isRecording) {
    stopVoiceInput();
  } else {
    startVoiceInput();
  }
}

function startVoiceInput() {
  try {
    state.recognition.start();
    state.isRecording = true;
    document.getElementById('voiceInputBtn').classList.add('recording');
    showToast('Listening…');
  } catch {
    showToast('Could not start voice input.', 'error');
  }
}

function stopVoiceInput() {
  if (state.recognition && state.isRecording) {
    try { state.recognition.stop(); } catch { /* ignore */ }
  }
  state.isRecording = false;
  document.getElementById('voiceInputBtn')?.classList.remove('recording');
}

function toggleVoiceOutput() {
  state.voiceOutputEnabled = !state.voiceOutputEnabled;
  const btn = document.getElementById('voiceOutputBtn');
  btn.classList.toggle('active', state.voiceOutputEnabled);
  showToast(state.voiceOutputEnabled ? 'Voice output enabled.' : 'Voice output disabled.');
}

function speakText(text) {
  if (!state.synth || !text) return;
  state.synth.cancel();
  const utter = new SpeechSynthesisUtterance(text.slice(0, 1000));
  utter.rate = 1.05;
  utter.pitch = 1;
  state.synth.speak(utter);
}

function speakMessage(msgId) {
  const chat = state.chats[state.activeChatId];
  if (!chat) return;
  const msg = chat.messages.find(m => m.id === msgId);
  if (msg) speakText(stripMarkdown(msg.content));
}

function stripMarkdown(text) {
  return text
    .replace(/```[\s\S]*?```/g, '[code block]')
    .replace(/`[^`]+`/g, '')
    .replace(/[#*_~>|-]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim();
}

/* ============================================================
   INPUT HANDLING
============================================================ */
function handleInputKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 200) + 'px';
}

function setSendButtonState(disabled) {
  const btn = document.getElementById('sendBtn');
  if (btn) btn.disabled = disabled;
}

function focusInput() {
  setTimeout(() => document.getElementById('userInput')?.focus(), 50);
}

function usePrompt(btn) {
  // Extract text nodes only — excludes Font Awesome icon content
  const text = [...btn.childNodes]
    .filter(n => n.nodeType === Node.TEXT_NODE)
    .map(n => n.textContent.trim())
    .filter(Boolean)
    .join(' ')
    .trim();
  if (!text) return;
  if (!state.activeChatId) createNewChat();
  document.getElementById('userInput').value = text;
  setTimeout(sendMessage, 80);
}

/* ============================================================
   UI — Welcome / Chat Area toggle
============================================================ */
function showWelcome() {
  document.getElementById('welcomeScreen').style.display = 'flex';
  document.getElementById('chatArea').style.display = 'none';
  document.getElementById('currentChatTitle').textContent = 'Nova AI';
}

function showChatArea() {
  document.getElementById('welcomeScreen').style.display = 'none';
  document.getElementById('chatArea').style.display = 'block';
}

function updateTopbarTitle(title) {
  const el = document.getElementById('currentChatTitle');
  if (el) el.textContent = title;
}

function scrollToBottom(instant = false) {
  const area = document.getElementById('chatArea');
  if (!area) return;
  if (instant) {
    area.scrollTop = area.scrollHeight;
  } else {
    requestAnimationFrame(() => {
      area.scrollTo({ top: area.scrollHeight, behavior: 'smooth' });
    });
  }
}

/* ============================================================
   SIDEBAR
============================================================ */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const main = document.getElementById('mainContent');

  if (window.innerWidth <= 768) {
    // Mobile: toggle mobile-open class
    const open = sidebar.classList.toggle('mobile-open');
    document.getElementById('overlay').classList.toggle('visible', open);
  } else {
    // Desktop: collapse/expand
    const collapsed = sidebar.classList.toggle('collapsed');
    main.classList.toggle('sidebar-hidden', collapsed);
  }
}

function closeSidebar() {
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('mobile-open');
    document.getElementById('overlay').classList.remove('visible');
  }
}

/* ============================================================
   MODALS
============================================================ */
function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

function openSettings() {
  // Sync active theme button
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === state.theme);
  });
  openModal('settingsModal');
}

function closeSettings() { closeModal('settingsModal'); }
function closeSettingsOnOutside(e) { if (e.target.id === 'settingsModal') closeSettings(); }

/* ============================================================
   THEME
============================================================ */
function setTheme(theme, btn) {
  state.theme = theme;
  applyTheme(theme);
  saveToStorage();
  document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
  btn?.classList.add('active');
  showToast(`Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`, 'success');
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

/* ============================================================
   STATS
============================================================ */
function updateStats() {
  const chatCount = Object.keys(state.chats).length;
  const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  el('statMessages', state.totalMessages);
  el('statChats', chatCount);
  el('statToday', state.todayMessages);

  // Show gallery button if images exist
  if (state.gallery.length > 0) {
    document.getElementById('galleryBtn').style.display = 'flex';
  }
}

/* ============================================================
   CODE COPY
============================================================ */
function copyCode(wrapperId, btn) {
  const wrapper = document.getElementById(wrapperId);
  if (!wrapper) return;
  const code = wrapper.querySelector('code')?.innerText || '';
  navigator.clipboard.writeText(code).then(() => {
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
      btn.classList.remove('copied');
    }, 2000);
  }).catch(() => showToast('Copy failed.', 'error'));
}

function copyMessage(msgId) {
  const chat = state.chats[state.activeChatId];
  if (!chat) return;
  const msg = chat.messages.find(m => m.id === msgId);
  if (!msg) return;
  navigator.clipboard.writeText(msg.content).then(() => {
    showToast('Copied to clipboard!', 'success');
  }).catch(() => showToast('Copy failed.', 'error'));
}

/* ============================================================
   LIGHTBOX
============================================================ */
/** Open lightbox from an <img> element (uses data-prompt attribute) */
function openLightboxForImg(imgEl) {
  const src = imgEl.src;
  const prompt = imgEl.dataset.prompt || '';
  openLightboxFromSrc(src, prompt);
}

function openLightboxFromSrc(src, prompt) {
  state.currentImagePrompt = prompt;
  document.getElementById('lightboxImg').src = src;
  document.getElementById('lightbox').classList.add('open');
}

function closeLightbox(e) {
  if (!e || e.target.id === 'lightbox' || e.target.classList.contains('danger')) {
    document.getElementById('lightbox').classList.remove('open');
  }
}

function downloadLightboxImage() {
  const img = document.getElementById('lightboxImg');
  if (!img?.src) return;
  const a = document.createElement('a');
  a.href = img.src;
  a.download = `nova-ai-${Date.now()}.png`;
  a.click();
  showToast('Image downloaded!', 'success');
}

/* ============================================================
   GALLERY
============================================================ */
function openGallery() {
  const grid = document.getElementById('galleryGrid');
  const empty = document.getElementById('galleryEmpty');
  grid.innerHTML = '';

  if (state.gallery.length === 0) {
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    state.gallery.slice().reverse().forEach(item => {
      const div = document.createElement('div');
      div.className = 'gallery-item';
      // Use DOM creation to avoid embedding base64 in HTML attributes
      const img = document.createElement('img');
      img.src = item.src;
      img.alt = item.prompt;
      img.loading = 'lazy';
      img.dataset.prompt = item.prompt;
      img.addEventListener('click', () => openLightboxFromSrc(item.src, item.prompt));
      const label = document.createElement('div');
      label.className = 'gallery-item-label';
      label.textContent = item.prompt;
      div.appendChild(img);
      div.appendChild(label);
      grid.appendChild(div);
    });
  }
  openModal('galleryModal');
}

function closeGallery() { closeModal('galleryModal'); }
function closeGalleryOnOutside(e) { if (e.target.id === 'galleryModal') closeGallery(); }

/* ============================================================
   EXPORT
============================================================ */
function exportConversations() {
  const data = {
    exportedAt: new Date().toISOString(),
    chats: Object.values(state.chats).map(chat => ({
      id: chat.id,
      title: chat.title,
      createdAt: new Date(chat.createdAt).toISOString(),
      messages: chat.messages
        .filter(m => m.type === 'text')
        .map(m => ({
          role: m.role,
          content: m.content,
          timestamp: new Date(m.timestamp).toISOString(),
        })),
    })),
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nova-ai-export-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Export downloaded!', 'success');
  closeSettings();
}

/* ============================================================
   TOAST NOTIFICATION
============================================================ */
let toastTimeout;
function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 2800);
}

/* ============================================================
   KEYBOARD SHORTCUTS
============================================================ */
function registerKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl+N — new chat
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      createNewChat();
    }
    // Ctrl+K — focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      const s = document.getElementById('searchInput');
      s?.focus();
      s?.select();
    }
    // Escape — close any open modal
    if (e.key === 'Escape') {
      closeSettings();
      closeLightbox();
      closeGallery();
      closeRenameModal();
    }
  });
}

/* ============================================================
   UTILITY HELPERS
============================================================ */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/* ============================================================
   START THE APP
============================================================ */
document.addEventListener('DOMContentLoaded', init);
