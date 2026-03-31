/* ═══════════════════════════════════════════════════════════
   SchemeSaathi — Government Scheme Chatbot
   script.js
   
   HOW TO CONNECT TO REAL BACKEND:
   Find the comment "REPLACE WITH REAL API CALL" in sendMessage()
   and swap mockAIResponse(text) with a fetch() to /api/chat
════════════════════════════════════════════════════════════ */

// ─── STATE ───────────────────────────────────────────────────
let isLoading = false;
let selectedLang = 'en';
let chatHistory = [];
let userProfile = {};
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];

// ─── BACKEND CONFIG ──────────────────────────────────────────
const API_BASE = 'http://localhost:8000';
// Session ID persists for the browser tab lifetime so the backend can track history
const SESSION_ID = 'session_' + Math.random().toString(36).slice(2, 10);

const moonSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="currentColor" stroke="none"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
const sunSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;

// Initialize theme + language on load
document.addEventListener('DOMContentLoaded', () => {
    // ── Theme ────────────────────────────────────────────────
    const savedTheme = localStorage.getItem('theme');
    const btn = document.getElementById('theme-toggle');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        if (btn) btn.innerHTML = moonSvg;
    } else {
        if (btn) btn.innerHTML = sunSvg;
    }

    // ── Language ─────────────────────────────────────────────
    const savedLang = localStorage.getItem('lang') || 'en';
    selectedLang = savedLang;
    // Mark the correct option as selected in the <select>
    const langSelect = document.querySelector('.lang-select');
    if (langSelect) langSelect.value = savedLang;
    // Apply translations immediately
    updateUILanguage(savedLang);
});

function toggleTheme() {
    const isLight = document.body.classList.toggle('light-mode');
    const btn = document.getElementById('theme-toggle');
    if (btn) {
        btn.innerHTML = isLight ? moonSvg : sunSvg;
    }
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
}

function toggleSidebar() {
  const sidebar = document.getElementById('main-sidebar');
  if (sidebar) {
    sidebar.classList.toggle('collapsed');
  }
}

// ─── LANGUAGE SAMPLE TEXTS ───────────────────────────────────
const LANG_SAMPLES = {
  en: "I am a 35 year old female farmer from Rajasthan, earning ₹70,000 per year. I own 1 acre of land.",
  hi: "मैं 35 साल की किसान महिला हूँ, राजस्थान से, सालाना आय ₹70,000 है और 1 एकड़ जमीन है।",
  ta: "நான் 35 வயதான விவசாயி பெண், ராஜஸ்தானில் இருந்து, ஆண்டு வருமானம் ₹70,000, 1 ஏக்கர் நிலம் உள்ளது.",
  te: "నేను 35 సంవత్సరాల రైతు మహిళను, రాజస్థాన్ నుండి, వార్షిక ఆదాయం ₹70,000, 1 ఎకరం భూమి ఉంది.",
  bn: "আমি রাজস্থান থেকে ৩৫ বছর বয়সী একজন কৃষক মহিলা, বার্ষিক আয় ₹৭০,০০০, ১ একর জমি আছে।",
  mr: "मी ३५ वर्षांची शेतकरी महिला आहे, राजस्थानमधून, वार्षिक उत्पन्न ₹७०,००० आहे, १ एकर जमीन आहे.",
  gu: "હું 35 વર્ષની ખેડૂત મહિલા છું, રાજસ્થાનથી, વાર્ષિક આવક ₹70,000, 1 એકર જમીન છે.",
  kn: "ನಾನು ರಾಜಸ್ಥಾನದ 35 ವರ್ಷದ ರೈತ ಮಹಿಳೆ, ವಾರ್ಷಿಕ ಆದಾಯ ₹70,000, 1 ಎಕರೆ ಭೂಮಿ ಇದೆ."
};



/* ══════════════════════════════════════════════════════════════
   SEND MESSAGE — main pipeline
══════════════════════════════════════════════════════════════ */
async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || isLoading) return;

  // Hide welcome screen on first message
  document.getElementById('welcome-screen')?.remove();

  isLoading = true;
  document.getElementById('send-btn').disabled = true;

  addMessage('user', text);
  input.value = '';
  input.style.height = 'auto';

  const typingId = showTyping();

  try {
    // ── POST to FastAPI backend ──────────────────────────────
    const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, session_id: SESSION_ID })
    });
    
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const data = await res.json();
    
    removeTyping(typingId);

    // ── Backend returns { text: string, schemes: [] } ────────
    const botText   = data.text   || '';
    const schemes   = data.schemes || [];

    // Always show the bot's text reply
    if (botText) addMessage('bot', botText);

    // If schemes were returned, render them as cards
    if (schemes.length > 0) {
        renderBackendSchemes(schemes);
        updateSchemePanel(schemes);
    } else {
        updateMissingAlerts([]);
    }

  } catch (e) {
    removeTyping(typingId);
    addMessage('bot', i18n[selectedLang]?.error_api || '⚠️ Could not reach the backend. Make sure the server is running on port 8000.');
    console.error('Chat error:', e);
  }

  isLoading = false;
  document.getElementById('send-btn').disabled = false;
  input.focus();
}

/* ══════════════════════════════════════════════════════════════
   DOM BUILDERS
══════════════════════════════════════════════════════════════ */

// Add a plain user or simple bot message
function addMessage(role, text) {
  const container = document.getElementById('chat-messages');
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isUser = role === 'user';

  const row = document.createElement('div');
  row.className = `message-row ${role}`;
  row.innerHTML = `
    <div class="avatar ${role}">${isUser ? '👤' : '🏛️'}</div>
    <div class="message-content">
      <div class="bubble ${role}">${isUser ? escapeHtml(text) : text}</div>
      <span class="msg-time">${now}</span>
    </div>
  `;

  container.appendChild(row);
  scrollToBottom();
}

function showQuestions(data) {
  const container = document.getElementById('chat-messages');
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const questions = data.questions || [];
  const chips = questions.map(q => `<div style="margin-bottom:8px; display: flex; align-items:flex-start; gap:8px;">
                                      <span style="color:var(--saffron)">•</span> 
                                      <span>${q}</span>
                                    </div>`).join('');
                                    
  let missingHTML = `
    <div style="margin-bottom: 12px; font-size: 1.05em; line-height: 1.5; color: var(--text-primary);">
        ${data.message || "To help me find exactly what you need, please provide these details:"}
    </div>
    <div class="missing-data-prompt" style="margin-top:0; border:none; padding:10px 0 0 0; background:transparent;">
      <div style="font-size:0.95em; line-height:1.4">${chips}</div>
    </div>`;

  const row = document.createElement('div');
  row.className = 'message-row bot';
  row.innerHTML = `
    <div class="avatar bot">🏛️</div>
    <div class="message-content">
      <div class="bubble bot" style="background:transparent; border:none; padding:10px; box-shadow:none;">
         <div style="background-color:var(--bg-card); border: 1px solid var(--border-color); border-radius:12px; padding:18px; color:var(--text-primary);box-shadow: 0 4px 6px rgba(0,0,0,0.05);">    
             ${missingHTML}
         </div>
      </div>
      <span class="msg-time">${now}</span>
    </div>
  `;
  container.appendChild(row);
  scrollToBottom();
}

function showInfo(data) {
  const container = document.getElementById('chat-messages');
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let html = `<div style="margin-bottom:8px;font-size:1.05em;"><strong>${data.scheme || 'Information'}</strong></div>`;
  
  if (data.type === "documents" && data.documents) {
      if (data.documents.length === 0) {
          html += `<div style="font-size:0.95em">No specific documents listed.</div>`;
      } else {
          html += `<ul style="margin: 0; padding-left: 20px; font-size:0.95em">`;
          data.documents.forEach(doc => {
              html += `<li style="margin-bottom: 6px;">${doc}</li>`;
          });
          html += `</ul>`;
      }
  } else if (data.type === "apply" && data.steps) {
      if (data.steps.length === 0) {
          html += `<div style="font-size:0.95em">No specific steps listed.</div>`;
      } else {
          html += `<ol style="margin: 0; padding-left: 20px; font-size:0.95em">`;
          data.steps.forEach(step => {
              html += `<li style="margin-bottom: 6px;">${step}</li>`;
          });
          html += `</ol>`;
          if (data.url && data.url !== "#") {
              html += `<div style="margin-top: 12px;"><a href="${data.url}" target="_blank" style="color: #2563eb; text-decoration: underline; font-size:0.95em">Apply Here ↗</a></div>`;
          }
      }
  } else if (data.type === "details" && data.benefits) {
      html += `<div style="line-height: 1.5; font-size:0.95em; white-space: pre-wrap;">${data.benefits}</div>`;
  } else {
      html += `<div style="font-size:0.95em">${data.message || 'Information retrieved based on your query.'}</div>`;
  }

  const row = document.createElement('div');
  row.className = 'message-row bot';
  row.innerHTML = `
    <div class="avatar bot">🏛️</div>
    <div class="message-content">
      <div class="bubble bot" style="background:transparent; border:none; padding:10px; box-shadow:none;">
         <div style="background-color:var(--bg-card); border: 1px solid var(--border-color); border-radius:12px; padding:15px; color:var(--text-primary);box-shadow: 0 4px 6px rgba(0,0,0,0.05);">    
             ${html}
         </div>
      </div>
      <span class="msg-time">${now}</span>
    </div>
  `;
  container.appendChild(row);
  scrollToBottom();
}

/* ──────────────────────────────────────────────────────────────
   renderBackendSchemes — renders the scheme cards returned by
   the FastAPI backend ({ name, benefit, reason, apply, documents, steps })
────────────────────────────────────────────────────────────── */
function renderBackendSchemes(schemes) {
  const container = document.getElementById('chat-messages');
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let cardsHTML = schemes.map(s => `
    <div style="
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 14px;
      padding: 16px 18px;
      margin-bottom: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.07);
      transition: transform 0.18s, box-shadow 0.18s;
      cursor: ${s.apply ? 'pointer' : 'default'};
    "
    ${s.apply ? `onclick="window.open('${s.apply}','_blank')"
    onmouseenter="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 20px rgba(0,0,0,0.13)'"
    onmouseleave="this.style.transform='';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.07)'"
    ` : ''}>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
        <div style="font-weight:700;font-size:1em;color:var(--saffron);line-height:1.3;flex:1;">${s.name || 'Scheme'}</div>
        ${s.apply ? `<span style="font-size:0.78em;color:var(--primary);margin-left:8px;white-space:nowrap;">Apply ↗</span>` : ''}
      </div>
      <div style="font-size:0.88em;color:var(--text-secondary);line-height:1.5;margin-bottom:8px;">${s.benefit || ''}</div>
      ${s.documents && s.documents.length > 0 ? `
        <details style="margin-top:8px;" onclick="event.stopPropagation()">
          <summary style="cursor:pointer;font-size:0.82em;color:var(--primary);font-weight:600;">📄 Documents required (${s.documents.length})</summary>
          <ul style="margin:6px 0 0 16px;padding:0;font-size:0.82em;color:var(--text-secondary);">
            ${s.documents.map(d => `<li style="margin-bottom:3px;">${d}</li>`).join('')}
          </ul>
        </details>` : ''}
      ${s.steps && s.steps.length > 0 ? `
        <details style="margin-top:4px;" onclick="event.stopPropagation()">
          <summary style="cursor:pointer;font-size:0.82em;color:var(--primary);font-weight:600;">📝 How to apply (${s.steps.length} steps)</summary>
          <ol style="margin:6px 0 0 16px;padding:0;font-size:0.82em;color:var(--text-secondary);">
            ${s.steps.map(st => `<li style="margin-bottom:3px;">${st}</li>`).join('')}
          </ol>
        </details>` : ''}
    </div>
  `).join('');

  const row = document.createElement('div');
  row.className = 'message-row bot';
  row.innerHTML = `
    <div class="avatar bot">🏛️</div>
    <div class="message-content">
      <div class="bubble bot" style="background:transparent;border:none;padding:8px 0;box-shadow:none;min-width:320px;max-width:560px;">
        ${cardsHTML}
      </div>
      <span class="msg-time">${now}</span>
    </div>
  `;
  container.appendChild(row);
  scrollToBottom();
}

/* legacy renderSchemes — kept for compatibility */
function renderSchemes(data) {
  if (data.schemes) { renderBackendSchemes(data.schemes); return; }
  addMessage('bot', data.text || data.message || 'No results.');
}

// Typing indicator
function showTyping() {
  const container = document.getElementById('chat-messages');
  const id = 'typing-' + Date.now();
  const el = document.createElement('div');

  el.className = 'typing-indicator';
  el.id = id;
  el.innerHTML = `
    <div class="avatar bot">🏛️</div>
    <div class="typing-dots">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>`;

  container.appendChild(el);
  scrollToBottom();
  return id;
}

function removeTyping(id) {
  document.getElementById(id)?.remove();
}

/* ══════════════════════════════════════════════════════════════
   SIDEBAR UPDATERS
══════════════════════════════════════════════════════════════ */

function updateProfileSidebar(profile) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (!el || !val) return;
    el.textContent = val;
    el.classList.remove('empty');
  };

  if (profile.age) set('p-age', profile.age + ' yrs');
  if (profile.gender) set('p-gender', cap(profile.gender));
  if (profile.state && profile.state !== 'all') set('p-state', profile.state);
  if (profile.occupation) set('p-occ', profile.occupation);
  if (profile.annualIncome) set('p-income', '₹' + Number(profile.annualIncome).toLocaleString('en-IN'));
  if (profile.residence) set('p-res', cap(profile.residence));
}

function updateMissingAlerts(missing) {
  const box = document.getElementById('missing-alerts');
  if (!missing || missing.length === 0) {
    box.style.display = 'none';
    return;
  }
  box.style.display = 'flex';
  box.innerHTML = missing.map(m => `<div class="missing-tag">${m} ${i18n[selectedLang]?.not_provided || 'not provided'}</div>`).join('');
}

/* updateSchemePanel — sidebar panel, now accepts backend scheme objects
   { name, benefit, reason, apply, documents, steps } */
function updateSchemePanel(schemes) {
  const panel = document.getElementById('scheme-results');

  if (!schemes || schemes.length === 0) {
    panel.innerHTML = `<div class="no-results"><div class="no-results-icon">📋</div><span>${i18n[selectedLang]?.no_schemes || 'No schemes found yet.'}</span></div>`;
    return;
  }

  let html = `<div class="results-label">✅ Matching Schemes (${schemes.length})</div>`;
  schemes.forEach((s, i) => { html += buildSchemeCard(s, i * 80); });
  panel.innerHTML = html;
}

function buildSchemeCard(s, delay) {
  const applyUrl = s.apply || s.url || '#';
  return `
    <div class="scheme-card high" style="animation-delay:${delay}ms" onclick="window.open('${applyUrl}','_blank')">
      <div class="scheme-card-top">
        <div class="scheme-card-name">${s.name || s.scheme_name}</div>
      </div>
      <div class="scheme-card-benefit">${s.benefit || s.reason || ''}</div>
      <div class="scheme-card-meta">
        <a class="scheme-card-apply" href="${applyUrl}" target="_blank" onclick="event.stopPropagation()">${i18n[selectedLang]?.apply || 'Apply ↗'}</a>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════════════════════════
   INTERACTION HANDLERS
══════════════════════════════════════════════════════════════ */

// Click a missing-data chip → pre-fill question into input
function promptMissing(field) {
  const prompts = {
    'Age': 'Could you tell me your age?',
    'State': 'Which state do you live in?',
    'Annual Income': 'What is your approximate annual household income?',
    'Land ownership': 'Do you own any agricultural land? If yes, how many acres?'
  };
  const input = document.getElementById('chat-input');
  input.value = prompts[field] || `Please provide your ${field}`;
  autoResize(input);
  input.focus();
}

// Click a starter prompt → auto-send it
function useStarter(btn) {
  const rawText = btn.innerText.trim();
  // Strip leading emoji if present
  const text = rawText.replace(/^[\u{1F300}-\u{1FFFF}\u{1F600}-\u{1F64F}\u{2600}-\u{26FF}\s]+/u, '').trim();
  const input = document.getElementById('chat-input');
  input.value = text;
  autoResize(input);
  input.focus();
  sendMessage();
}

// Click a language pill → fill sample text for that language
function insertSample(lang) {
  const input = document.getElementById('chat-input');
  input.value = LANG_SAMPLES[lang] || LANG_SAMPLES['en'];
  autoResize(input);
  input.focus();
}

// Header language switcher toggle
function setLang(btn, lang) {
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  selectedLang = lang;
  updateUILanguage(selectedLang);
}

function setLangFromSelect(selectEl) {
  selectedLang = selectEl.value;
  localStorage.setItem('lang', selectedLang);
  updateUILanguage(selectedLang);
}

function updateUILanguage(lang) {
  if (typeof i18n === 'undefined' || !i18n[lang]) return;
  const t = i18n[lang];

  // Use textContent for leaf elements that must NOT contain HTML tags
  // Use innerHTML for elements like the welcome message that contain a <span>
  const textOnly = new Set(['OPTION', 'LABEL', 'BUTTON', 'SPAN', 'LI']);
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (!t[key]) return;
    if (textOnly.has(el.tagName)) {
      el.textContent = t[key];
    } else {
      el.innerHTML = t[key];
    }
  });

  // Translate placeholder attributes
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (t[key]) el.setAttribute('placeholder', t[key]);
  });
}




/* ══════════════════════════════════════════════════════════════
   CLEAR CHAT
══════════════════════════════════════════════════════════════ */
function clearChat() {
  const container = document.getElementById('chat-messages');
  container.innerHTML = '';

  // Reset profile sidebar
  ['p-age', 'p-gender', 'p-state', 'p-occ', 'p-income', 'p-res'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = '—'; el.classList.add('empty'); }
  });

  // Reset missing alerts
  const alerts = document.getElementById('missing-alerts');
  if (alerts) alerts.style.display = 'none';

  // Reset scheme panel
  // Re-inject welcome screen
  const welcome = document.createElement('div');
  welcome.className = 'welcome-screen';
  welcome.id = 'welcome-screen';
  welcome.innerHTML = `
    <div class="welcome-icon">🤝</div>
    <div class="welcome-title" data-i18n="welcome">${i18n[selectedLang]?.welcome || 'Namaste! I\'m <span>SchemeSaathi</span>'}</div>`;
  container.appendChild(welcome);

  userProfile = {};
  chatHistory = [];
}

/* ══════════════════════════════════════════════════════════════
   UTILITY FUNCTIONS
══════════════════════════════════════════════════════════════ */



function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function scrollToBottom() {
  const container = document.getElementById('chat-messages');
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function cap(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

function submitProfileForm(e) {
  e.preventDefault();
  const age    = document.getElementById('f-age')?.value.trim();
  const gender = document.getElementById('f-gender')?.value;
  const state  = document.getElementById('f-state')?.value;
  const occ    = document.getElementById('f-occ')?.value;
  const income = document.getElementById('f-income')?.value.trim();
  const res    = document.getElementById('f-res')?.value;

  const parts = [];
  if (age)    parts.push('I am ' + age + ' years old');
  if (gender) parts.push(gender);
  if (occ)    parts.push('working as a ' + occ);
  if (state)  parts.push('from ' + state);
  if (income) parts.push('with an annual income of Rs ' + Number(income).toLocaleString('en-IN'));
  if (res)    parts.push('living in a ' + res + ' area');

  if (parts.length === 0) {
    alert('Please fill in at least one field.');
    return;
  }

  const sentence = parts.join(', ') + '.';
  const input = document.getElementById('chat-input');
  if (input) {
    input.value = sentence;
    autoResize(input);
    sendMessage();
  }
}
