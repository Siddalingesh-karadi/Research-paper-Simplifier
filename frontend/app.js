// frontend/app.js
// Flow: Upload PDF → reads it → simplifies it → shows result
// Remove button resets everything back to upload.

'use strict';

// ─── DOM References ───────────────────────────────────────────────────────────
const fileInput         = document.getElementById('fileInput');
const dropZone          = document.getElementById('dropZone');
const fileInfo          = document.getElementById('fileInfo');
const fileName          = document.getElementById('fileName');
const fileSize          = document.getElementById('fileSize');
const removeFileBtn     = document.getElementById('removeFileBtn');
const uploadBtn         = document.getElementById('uploadBtn');
const uploadError       = document.getElementById('uploadError');

const uploadSection     = document.getElementById('uploadSection');
const processingSection = document.getElementById('processingSection');
const loadingText       = document.getElementById('loadingText');

const resultsSection    = document.getElementById('resultsSection');
const uploadedFileName  = document.getElementById('uploadedFileName');
const wordCountLabel    = document.getElementById('wordCountLabel');
const removeBtn         = document.getElementById('removeBtn');
const copyBtn           = document.getElementById('copyBtn');
const simplifyError     = document.getElementById('simplifyError');
const resultsBody       = document.getElementById('resultsBody');

const toast             = document.getElementById('toast');

// ─── State ────────────────────────────────────────────────────────────────────
let selectedFile = null;
let rawResult    = '';

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
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
function showToast(message) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3000);
}

function show(el)  { el.classList.remove('hidden'); }
function hide(el)  { el.classList.add('hidden'); }

// ─── File Selection ───────────────────────────────────────────────────────────

function handleFileSelect(file) {
  if (!file || file.type !== 'application/pdf') {
    showAlert(uploadError, 'Invalid file type. Please select a PDF file (.pdf).');
    return;
  }
  if (file.size > 50 * 1024 * 1024) {
    showAlert(uploadError, 'File is too large. Maximum allowed size is 50 MB.');
    return;
  }

  hideAlert(uploadError);
  selectedFile = file;

  fileName.textContent = file.name;
  fileSize.textContent = formatBytes(file.size);
  show(fileInfo);

  dropZone.classList.add('has-file');
  dropZone.querySelector('.drop-text').textContent = 'File selected';
  dropZone.querySelector('.drop-subtext').textContent = 'Click to change file';

  uploadBtn.disabled = false;
}

function resetFileSelection() {
  selectedFile = null;
  fileInput.value = '';
  hide(fileInfo);
  uploadBtn.disabled = true;
  dropZone.classList.remove('has-file');
  dropZone.querySelector('.drop-text').textContent = 'Drag and drop your PDF here';
  dropZone.querySelector('.drop-subtext').textContent = 'or click to select a file';
  hideAlert(uploadError);
}

// File input
fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) handleFileSelect(fileInput.files[0]);
});

// Remove before upload
removeFileBtn.addEventListener('click', (e) => {
  e.preventDefault();
  resetFileSelection();
});

// Drag & drop
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  handleFileSelect(e.dataTransfer.files[0]);
});

// Keyboard
dropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});

// ─── Upload → Simplify Flow ───────────────────────────────────────────────────

uploadBtn.addEventListener('click', async () => {
  if (!selectedFile) return;

  // Show processing, hide upload
  hide(uploadSection);
  show(processingSection);
  hide(resultsSection);
  loadingText.textContent = 'Uploading your paper...';

  const formData = new FormData();
  formData.append('pdf', selectedFile);

  let sessionToken = null;

  try {
    // ── Step 1: Upload ──────────────────────────────────
    const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
    const uploadData = await uploadRes.json();

    if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed. Please try again.');

    sessionToken = uploadData.token;
    uploadedFileName.textContent = uploadData.filename;
    wordCountLabel.textContent = `(~${uploadData.wordCount.toLocaleString()} words)`;

    // ── Step 2: Simplify ────────────────────────────────
    loadingText.textContent = 'Reading and simplifying your paper — this may take 15–30 seconds...';

    // Cycle messages while waiting
    const messages = [
      'Reading and simplifying your paper — this may take 15–30 seconds...',
      'Extracting key sections...',
      'Almost done — writing simplified explanation...'
    ];
    let msgIdx = 0;
    const msgTimer = setInterval(() => {
      msgIdx = (msgIdx + 1) % messages.length;
      loadingText.textContent = messages[msgIdx];
    }, 8000);

    const simplifyRes = await fetch('/api/simplify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: sessionToken })
    });

    clearInterval(msgTimer);

    const simplifyData = await simplifyRes.json();
    if (!simplifyRes.ok) throw new Error(simplifyData.error || 'Simplification failed. Please try again.');

    rawResult = simplifyData.result;
    renderResults(simplifyData.result);
    hideAlert(simplifyError);

    hide(processingSection);
    show(resultsSection);
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast('Paper simplified successfully!');

  } catch (err) {
    // On error — go back to upload, show error
    hide(processingSection);
    show(uploadSection);
    showAlert(uploadError, err.message);
    uploadBtn.disabled = false;
  }
});

// ─── Remove & Start Over ──────────────────────────────────────────────────────

removeBtn.addEventListener('click', () => {
  rawResult = '';
  resultsBody.innerHTML = '';
  hideAlert(simplifyError);
  resetFileSelection();
  hide(resultsSection);
  hide(processingSection);
  show(uploadSection);
  uploadSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast('Paper removed.');
});

// ─── Render Results ───────────────────────────────────────────────────────────

function renderResults(text) {
  resultsBody.innerHTML = '';

  const sectionRegex = /##\s+(\d+\.\s+[^\n]+)\n([\s\S]*?)(?=##\s+\d+\.|$)/g;
  const sections = [];
  let match;

  while ((match = sectionRegex.exec(text)) !== null) {
    sections.push({ title: match[1].trim(), body: match[2].trim() });
  }

  if (sections.length === 0) {
    const div = document.createElement('div');
    div.className = 'result-section';
    div.innerHTML = `<div class="result-section-body">${escapeHtml(text)}</div>`;
    resultsBody.appendChild(div);
    return;
  }

  sections.forEach((section, index) => {
    const div = document.createElement('div');
    div.className = 'result-section';
    const bodyHtml = markdownToHtml(section.body);
    const isNotAvailable = section.body.toLowerCase().includes('not available in this paper');

    div.innerHTML = `
      <div class="result-section-title">
        <span class="result-section-number">${index + 1}</span>
        ${escapeHtml(section.title.replace(/^\d+\.\s*/, ''))}
      </div>
      <div class="result-section-body ${isNotAvailable ? 'not-available' : ''}">
        ${bodyHtml}
      </div>`;

    resultsBody.appendChild(div);
  });
}

function markdownToHtml(md) {
  let html = md.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/^[*\-]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>(\n|$))+/g, (m) => `<ul>${m}</ul>`);
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
    copyBtn.textContent = '✓ Copied!';
    setTimeout(() => {
      copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
    }, 2000);
  } catch {
    showToast('Could not copy — please select and copy the text manually.');
  }
});
