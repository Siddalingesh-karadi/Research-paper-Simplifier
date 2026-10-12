// frontend/app.js
// ResearchSimplifier — Full client-side logic
// Flow: Upload PDF → Simplify → Show 5-section result → Q&A
'use strict';

// ─── DOM References ───────────────────────────────────────────────────────────
const fileInput          = document.getElementById('fileInput');
const dropZone           = document.getElementById('dropZone');
const fileInfo           = document.getElementById('fileInfo');
const fileName           = document.getElementById('fileName');
const fileSize           = document.getElementById('fileSize');
const removeFileBtn      = document.getElementById('removeFileBtn');
const uploadBtn          = document.getElementById('uploadBtn');
const uploadError        = document.getElementById('uploadError');

const uploadSection      = document.getElementById('uploadSection');
const processingSection  = document.getElementById('processingSection');
const loadingText        = document.getElementById('loadingText');

const resultsSection     = document.getElementById('resultsSection');
const uploadedFileName   = document.getElementById('uploadedFileName');
const wordCountLabel     = document.getElementById('wordCountLabel');
const removeBtn          = document.getElementById('removeBtn');
const copyBtn            = document.getElementById('copyBtn');
const simplifyError      = document.getElementById('simplifyError');
const resultsBody        = document.getElementById('resultsBody');

const questionInput      = document.getElementById('questionInput');
const askBtn             = document.getElementById('askBtn');
const askError           = document.getElementById('askError');
const qaAnswer           = document.getElementById('qaAnswer');
const qaAnswerText       = document.getElementById('qaAnswerText');
const qaQuestionEcho     = document.getElementById('qaQuestionEcho');
const qaSpinner          = document.getElementById('qaSpinner');
const qaSuggestions      = document.getElementById('qaSuggestions');

// Step indicator elements
const step2Num           = document.getElementById('step2Num');
const step3Num           = document.getElementById('step3Num');

// Processing step elements
const procStep1          = document.getElementById('procStep1');
const procStep2          = document.getElementById('procStep2');
const procStep3          = document.getElementById('procStep3');

const toast              = document.getElementById('toast');

// ─── State ────────────────────────────────────────────────────────────────────
let selectedFile   = null;
let sessionToken   = null;
let rawResult      = '';

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes < 1024)            return `${bytes} B`;
  if (bytes < 1024 * 1024)     return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function showAlert(el, message) {
  el.textContent = message;
  el.classList.remove('hidden');
}
function hideAlert(el) {
  el.textContent = '';
  el.classList.add('hidden');
}

let toastTimer = null;
function showToast(message, duration = 3500) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), duration);
}

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

// ─── Step Indicator ───────────────────────────────────────────────────────────

function setStepDone(stepEl) {
  stepEl.classList.remove('active');
  stepEl.classList.add('done');
  stepEl.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12"/>
    </svg>`;
}

function setStepActive(stepEl) {
  stepEl.classList.add('active');
}

// ─── Processing Steps ─────────────────────────────────────────────────────────

function setProcessingStep(step) {
  // step = 1, 2, or 3
  [procStep1, procStep2, procStep3].forEach((el, i) => {
    el.classList.remove('active', 'done');
    if (i + 1 < step)  el.classList.add('done');
    if (i + 1 === step) el.classList.add('active');
  });
}

// ─── File Selection ───────────────────────────────────────────────────────────

function handleFileSelect(file) {
  if (!file) return;

  if (file.type !== 'application/pdf') {
    showAlert(uploadError, '⚠ Invalid file type. Please select a PDF file (.pdf).');
    return;
  }
  if (file.size > 50 * 1024 * 1024) {
    showAlert(uploadError, '⚠ File is too large. Maximum allowed size is 50 MB.');
    return;
  }

  hideAlert(uploadError);
  selectedFile = file;

  fileName.textContent = file.name;
  fileSize.textContent = formatBytes(file.size);
  show(fileInfo);

  dropZone.classList.add('has-file');
  dropZone.querySelector('.drop-text').textContent = 'File ready to upload';
  dropZone.querySelector('.drop-subtext').innerHTML = '<span class="drop-link">Click to change</span>';

  uploadBtn.disabled = false;
}

function resetFileSelection() {
  selectedFile = null;
  fileInput.value = '';
  hide(fileInfo);
  uploadBtn.disabled = true;
  dropZone.classList.remove('has-file');
  dropZone.querySelector('.drop-text').textContent = 'Drag & drop your PDF here';
  dropZone.querySelector('.drop-subtext').innerHTML = 'or <span class="drop-link">click to browse files</span>';
  hideAlert(uploadError);
}

// File input change
fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) handleFileSelect(fileInput.files[0]);
});

// Remove before upload
removeFileBtn.addEventListener('click', (e) => {
  e.preventDefault();
  resetFileSelection();
});

// Drag & drop
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', (e) => {
  if (!dropZone.contains(e.relatedTarget)) {
    dropZone.classList.remove('drag-over');
  }
});
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  handleFileSelect(file);
});

// Keyboard accessibility
dropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});

// ─── Upload → Simplify Flow ───────────────────────────────────────────────────

uploadBtn.addEventListener('click', async () => {
  if (!selectedFile) return;

  // Reset state
  rawResult      = '';
  sessionToken   = null;
  resultsBody.innerHTML = '';
  hideAlert(uploadError);
  hideAlert(simplifyError);

  // Show processing
  hide(uploadSection);
  show(processingSection);
  hide(resultsSection);
  setProcessingStep(1);
  loadingText.textContent = 'Extracting text from your PDF...';

  const formData = new FormData();
  formData.append('pdf', selectedFile);

  try {
    // ── Step 1: Upload & Extract ──────────────────────────────────────────
    const uploadRes  = await fetch('/api/upload', { method: 'POST', body: formData });
    const uploadData = await uploadRes.json();

    if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed. Please try again.');

    sessionToken = uploadData.token;
    uploadedFileName.textContent = uploadData.filename;
    wordCountLabel.textContent   = `· ~${uploadData.wordCount.toLocaleString()} words`;

    // ── Step 2: Simplify ──────────────────────────────────────────────────
    setProcessingStep(2);

    const loadingMessages = [
      'AI is reading the paper...',
      'Identifying key sections and contributions...',
      'Writing your simplified explanation...',
    ];
    let msgIdx = 0;
    loadingText.textContent = loadingMessages[0];

    const msgTimer = setInterval(() => {
      msgIdx = Math.min(msgIdx + 1, loadingMessages.length - 1);
      loadingText.textContent = loadingMessages[msgIdx];
      if (msgIdx === 2) setProcessingStep(3);
    }, 7000);

    const simplifyRes  = await fetch('/api/simplify', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token: sessionToken }),
    });

    clearInterval(msgTimer);
    const simplifyData = await simplifyRes.json();

    if (!simplifyRes.ok) throw new Error(simplifyData.error || 'Simplification failed. Please try again.');

    rawResult = simplifyData.result;
    renderResults(simplifyData.result);

    // Transition to results
    hide(processingSection);
    show(resultsSection);
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast('✓ Paper simplified successfully!');

  } catch (err) {
    hide(processingSection);
    show(uploadSection);
    showAlert(uploadError, err.message);
    uploadBtn.disabled = false;
  }
});

// ─── Remove & Start Over ──────────────────────────────────────────────────────

removeBtn.addEventListener('click', () => {
  rawResult    = '';
  sessionToken = null;
  resultsBody.innerHTML = '';
  hideAlert(simplifyError);
  hideAlert(askError);
  hide(qaAnswer);
  questionInput.value = '';
  resetFileSelection();
  hide(resultsSection);
  hide(processingSection);
  show(uploadSection);
  uploadSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast('Paper removed — ready for a new upload.');
});

// ─── Render Results ───────────────────────────────────────────────────────────

// Section icon map
const SECTION_ICONS = {
  0: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>`,
  1: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  2: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  3: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 20 22 8 12 3 2 8 2 20"/><line x1="2" y1="8" x2="22" y2="8"/><line x1="12" y1="3" x2="12" y2="20"/></svg>`,
  4: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
};

function renderResults(text) {
  resultsBody.innerHTML = '';

  // Match "## N. Title\n body" pattern
  const sectionRegex = /##\s+(\d+\.\s+[^\n]+)\n([\s\S]*?)(?=##\s+\d+\.|$)/g;
  const sections = [];
  let match;

  while ((match = sectionRegex.exec(text)) !== null) {
    sections.push({ title: match[1].trim(), body: match[2].trim() });
  }

  // Fallback: render raw text if no sections parsed
  if (sections.length === 0) {
    const div = document.createElement('div');
    div.className = 'result-section';
    div.innerHTML = `<div class="result-section-body">${escapeHtml(text)}</div>`;
    resultsBody.appendChild(div);
    return;
  }

  sections.forEach((section, index) => {
    const div      = document.createElement('div');
    div.className  = 'result-section';
    const bodyHtml = markdownToHtml(section.body);
    const isNA     = /not mentioned|not available|not stated/i.test(section.body);
    const icon     = SECTION_ICONS[index] || SECTION_ICONS[0];

    div.innerHTML = `
      <div class="result-section-title">
        <span class="result-section-number" aria-hidden="true">${index + 1}</span>
        <span class="result-section-icon" aria-hidden="true">${icon}</span>
        ${escapeHtml(section.title.replace(/^\d+\.\s*/, ''))}
      </div>
      <div class="result-section-body${isNA ? ' not-available' : ''}">
        ${bodyHtml}
      </div>`;

    resultsBody.appendChild(div);
  });
}

// Minimal markdown → safe HTML (bullets, bold, paragraphs)
function markdownToHtml(md) {
  // Bold
  let html = md.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Numbered list items
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
  // Bullet list items
  html = html.replace(/^[*\-]\s+(.+)$/gm, '<li>$1</li>');
  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>[\s\S]*?<\/li>(\n|$))+/g, (m) => `<ul>${m}</ul>`);
  // Paragraphs
  html = html.split('\n').map(line => {
    const t = line.trim();
    if (!t) return '';
    if (t.startsWith('<ul>') || t.startsWith('<li>') || t.startsWith('</ul>')) return t;
    return `<p>${t}</p>`;
  }).join('\n');
  return html;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Copy Results ─────────────────────────────────────────────────────────────

copyBtn.addEventListener('click', async () => {
  if (!rawResult) return;
  try {
    await navigator.clipboard.writeText(rawResult);
    const orig = copyBtn.innerHTML;
    copyBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
      Copied!`;
    setTimeout(() => { copyBtn.innerHTML = orig; }, 2500);
    showToast('Explanation copied to clipboard.');
  } catch {
    showToast('Could not copy — please select text manually.');
  }
});

// ─── Q&A: Suggestion Chips ───────────────────────────────────────────────────

qaSuggestions.addEventListener('click', (e) => {
  const chip = e.target.closest('.suggestion-chip');
  if (!chip) return;
  questionInput.value = chip.dataset.q;
  questionInput.focus();
  askBtn.click();
});

// ─── Q&A: Submit ─────────────────────────────────────────────────────────────

askBtn.addEventListener('click', async () => {
  const question = questionInput.value.trim();

  if (!question || question.length < 3) {
    showAlert(askError, 'Please enter a question (at least 3 characters).');
    questionInput.focus();
    return;
  }
  if (!sessionToken) {
    showAlert(askError, 'No paper loaded. Please upload a paper first.');
    return;
  }

  // Show answer box with spinner
  hideAlert(askError);
  show(qaAnswer);
  qaQuestionEcho.textContent = `"${question}"`;
  qaAnswerText.textContent   = '';
  show(qaSpinner);
  askBtn.disabled = true;

  try {
    const res  = await fetch('/api/ask', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token: sessionToken, question }),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Failed to get an answer. Please try again.');

    hide(qaSpinner);
    qaAnswerText.textContent = data.answer;

  } catch (err) {
    hide(qaAnswer);
    showAlert(askError, err.message);
  } finally {
    askBtn.disabled = false;
  }
});

// Allow submitting with Enter key in the input
questionInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    askBtn.click();
  }
});

// ─── Section icon style tweak ─────────────────────────────────────────────────
// Inject inline style for section icon (sibling to number badge)
const styleEl = document.createElement('style');
styleEl.textContent = `
  .result-section-icon {
    display: flex;
    align-items: center;
    color: #a78bfa;
    flex-shrink: 0;
    margin-right: 2px;
  }
`;
document.head.appendChild(styleEl);
