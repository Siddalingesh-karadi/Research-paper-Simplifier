// frontend/app.js
// All client-side logic for Research Simplifier.
// Communicates with the backend via fetch() calls to /api/*

'use strict';

// ─── DOM References ───────────────────────────────────────────────────────────
const fileInput         = document.getElementById('fileInput');
const dropZone          = document.getElementById('dropZone');
const dropZoneContent   = document.getElementById('dropZoneContent');
const fileInfo          = document.getElementById('fileInfo');
const fileName          = document.getElementById('fileName');
const fileSize          = document.getElementById('fileSize');
const removeFileBtn     = document.getElementById('removeFileBtn');
const uploadBtn         = document.getElementById('uploadBtn');
const uploadError       = document.getElementById('uploadError');

const uploadSection     = document.getElementById('uploadSection');
const simplifySection   = document.getElementById('simplifySection');
const resultsSection    = document.getElementById('resultsSection');
const qaSection         = document.getElementById('qaSection');

const uploadedFileName  = document.getElementById('uploadedFileName');
const wordCountLabel    = document.getElementById('wordCountLabel');
const uploadAnotherBtn  = document.getElementById('uploadAnotherBtn');
const simplifyBtn       = document.getElementById('simplifyBtn');
const loading           = document.getElementById('loading');
const loadingText       = document.getElementById('loadingText');
const simplifyError     = document.getElementById('simplifyError');

const resultsBody       = document.getElementById('resultsBody');
const copyBtn           = document.getElementById('copyBtn');

const questionInput     = document.getElementById('questionInput');
const askBtn            = document.getElementById('askBtn');
const qaLoading         = document.getElementById('qaLoading');
const qaError           = document.getElementById('qaError');
const qaAnswer          = document.getElementById('qaAnswer');
const qaAnswerText      = document.getElementById('qaAnswerText');
const toast             = document.getElementById('toast');

// ─── State ────────────────────────────────────────────────────────────────────
let selectedFile = null;  // The File object chosen by the user
let sessionToken = null;  // Token returned by /api/upload (used by /simplify and /ask)
let rawResult    = '';    // Plain text of the simplified explanation (for copy)

// ─── Utility Functions ────────────────────────────────────────────────────────

/** Format bytes to human-readable string */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Show or hide an alert element */
function showAlert(el, message) {
  el.textContent = message;
  el.classList.remove('hidden');
}
function hideAlert(el) {
  el.textContent = '';
  el.classList.add('hidden');
}

/** Show a temporary toast notification */
let toastTimer = null;
function showToast(message) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3000);
}

/** Scroll element into view smoothly */
function scrollTo(el) {
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── File Handling ────────────────────────────────────────────────────────────

function handleFileSelect(file) {
  // Validate file type
  if (!file || file.type !== 'application/pdf') {
    showAlert(uploadError, 'Invalid file type. Please select a PDF file (.pdf).');
    return;
  }

  // Validate file size (10 MB)
  if (file.size > 10 * 1024 * 1024) {
    showAlert(uploadError, 'File is too large. Maximum allowed size is 10 MB.');
    return;
  }

  hideAlert(uploadError);
  selectedFile = file;

  // Show file info
  fileName.textContent = file.name;
  fileSize.textContent = formatBytes(file.size);
  fileInfo.classList.remove('hidden');

  // Update drop zone appearance
  dropZone.classList.add('has-file');
  dropZone.querySelector('.drop-text').textContent = 'File selected';
  dropZone.querySelector('.drop-subtext').textContent = 'Click to change file';

  // Enable the upload button
  uploadBtn.disabled = false;
}

function resetFileSelection() {
  selectedFile = null;
  fileInput.value = '';
  fileInfo.classList.add('hidden');
  uploadBtn.disabled = true;
  dropZone.classList.remove('has-file');
  dropZone.querySelector('.drop-text').textContent = 'Drag and drop your PDF here';
  dropZone.querySelector('.drop-subtext').textContent = 'or click to select a file';
  hideAlert(uploadError);
}

// File input change
fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) {
    handleFileSelect(fileInput.files[0]);
  }
});

// Remove file
removeFileBtn.addEventListener('click', (e) => {
  e.preventDefault();
  resetFileSelection();
});

// Drag and drop
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  handleFileSelect(file);
});

// Keyboard accessibility for drop zone
dropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});

// ─── Upload PDF ───────────────────────────────────────────────────────────────

uploadBtn.addEventListener('click', async () => {
  if (!selectedFile) return;

  uploadBtn.disabled = true;
  uploadBtn.textContent = 'Uploading...';
  hideAlert(uploadError);

  const formData = new FormData();
  formData.append('pdf', selectedFile);

  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Upload failed. Please try again.');
    }

    // Store the session token
    sessionToken = data.token;

    // Show the simplify section
    uploadedFileName.textContent = data.filename;
    wordCountLabel.textContent = `(~${data.wordCount.toLocaleString()} words extracted)`;

    simplifySection.classList.remove('hidden');
    scrollTo(simplifySection);

    showToast('Paper uploaded successfully!');

  } catch (err) {
    showAlert(uploadError, err.message);
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Upload & Process Paper';
  }
});

// ─── Upload Another Paper ─────────────────────────────────────────────────────

uploadAnotherBtn.addEventListener('click', () => {
  // Reset all state
  sessionToken = null;
  rawResult = '';
  resetFileSelection();

  // Hide all sections except upload
  simplifySection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  qaSection.classList.add('hidden');
  resultsBody.innerHTML = '';
  hideAlert(simplifyError);
  qaAnswer.classList.add('hidden');
  qaAnswerText.textContent = '';
  questionInput.value = '';

  scrollTo(uploadSection);
});

// ─── Simplify Paper ───────────────────────────────────────────────────────────

simplifyBtn.addEventListener('click', async () => {
  if (!sessionToken) {
    showAlert(simplifyError, 'No paper loaded. Please upload a paper first.');
    return;
  }

  hideAlert(simplifyError);
  simplifyBtn.disabled = true;
  loading.classList.remove('hidden');
  resultsSection.classList.add('hidden');
  qaSection.classList.add('hidden');

  // Cycle loading messages to keep user informed
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

  try {
    const response = await fetch('/api/simplify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: sessionToken })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Simplification failed. Please try again.');
    }

    rawResult = data.result;
    renderResults(data.result);

    resultsSection.classList.remove('hidden');
    qaSection.classList.remove('hidden');
    scrollTo(resultsSection);

  } catch (err) {
    showAlert(simplifyError, err.message);
  } finally {
    clearInterval(msgTimer);
    loading.classList.add('hidden');
    simplifyBtn.disabled = false;
    simplifyBtn.textContent = 'Simplify Paper';
  }
});

// ─── Render Results ───────────────────────────────────────────────────────────

/**
 * Parses the Gemini response (markdown headings + body text)
 * into structured HTML sections for display.
 */
function renderResults(text) {
  resultsBody.innerHTML = '';

  // Split on ## headings
  const sectionRegex = /##\s+(\d+\.\s+[^\n]+)\n([\s\S]*?)(?=##\s+\d+\.|$)/g;
  const sections = [];
  let match;

  while ((match = sectionRegex.exec(text)) !== null) {
    sections.push({
      title: match[1].trim(),
      body:  match[2].trim()
    });
  }

  if (sections.length === 0) {
    // If parsing fails, display raw text inside a single section
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

    // Mark "Not available" sections with muted style
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

/** Simple markdown-to-HTML converter for the result body */
function markdownToHtml(md) {
  // Bold: **text**
  let html = md.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Numbered list items: "1. item"
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

  // Bullet list items: "- item" or "* item"
  html = html.replace(/^[*\-]\s+(.+)$/gm, '<li>$1</li>');

  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>[\s\S]*?<\/li>(\n|$))+/g, (m) => `<ul>${m}</ul>`);

  // Paragraphs: remaining non-empty lines
  html = html
    .split('\n')
    .map(line => {
      const t = line.trim();
      if (!t) return '';
      if (t.startsWith('<ul>') || t.startsWith('<li>') || t.startsWith('</ul>')) return t;
      return `<p>${t}</p>`;
    })
    .join('\n');

  return html;
}

/** Escape HTML special characters to prevent XSS */
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

// ─── Ask a Question ───────────────────────────────────────────────────────────

async function submitQuestion() {
  const question = questionInput.value.trim();

  if (!question) {
    showAlert(qaError, 'Please type a question first.');
    questionInput.focus();
    return;
  }

  if (!sessionToken) {
    showAlert(qaError, 'No paper loaded. Please upload a paper first.');
    return;
  }

  hideAlert(qaError);
  qaAnswer.classList.add('hidden');
  qaLoading.classList.remove('hidden');
  askBtn.disabled = true;

  try {
    const response = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: sessionToken, question })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Could not get an answer. Please try again.');
    }

    qaAnswerText.textContent = data.answer;
    qaAnswer.classList.remove('hidden');
    scrollTo(qaAnswer);

  } catch (err) {
    showAlert(qaError, err.message);
  } finally {
    qaLoading.classList.add('hidden');
    askBtn.disabled = false;
  }
}

askBtn.addEventListener('click', submitQuestion);

questionInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitQuestion();
});
