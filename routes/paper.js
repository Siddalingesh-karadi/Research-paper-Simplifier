// routes/paper.js
// Defines three API endpoints:
//   POST /api/upload   — Receives a PDF, extracts text, returns word count
//   POST /api/simplify — Calls AI to simplify the previously uploaded paper
//   POST /api/ask      — Answers a question about the uploaded paper

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const { extractTextFromPDF } = require('../services/pdfService');
const { simplifyPaper, answerQuestion } = require('../services/aiService');

const router = express.Router();

// ─── Multer Configuration ─────────────────────────────────────────────────────
// multer handles multipart/form-data (file uploads).
// Files are saved to the /uploads folder with their original extension.

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    // Create the uploads folder if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Use a timestamp prefix to avoid filename collisions
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

// File filter — only accept PDF files
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are accepted. Please upload a .pdf file.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50 MB maximum
  }
});

// ─── In-Memory Paper Store ────────────────────────────────────────────────────
// We store the extracted text in memory (keyed by a session token) so the
// /simplify and /ask endpoints can access it without re-processing the file.
//
// For a production app this would use Redis or a database, but for this project
// in-memory storage is appropriate — no database dependency required.

const paperStore = new Map(); // token → { text, filename }

// Simple token generator
function generateToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─── POST /api/upload ─────────────────────────────────────────────────────────
// Accepts a PDF file, extracts text, stores it, returns a session token.

router.post('/upload', upload.single('pdf'), async (req, res) => {
  // If multer rejected the file (wrong type), req.file is undefined
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded or file type is not PDF.' });
  }

  const filePath = req.file.path;

  try {
    // Extract text from the uploaded PDF
    const text = await extractTextFromPDF(filePath);

    // Create a token for this session
    const token = generateToken();

    // Store extracted text in memory
    paperStore.set(token, {
      text,
      filename: req.file.originalname,
      uploadedAt: Date.now()
    });

    // Delete the PDF file from disk immediately — we only needed the text
    fs.unlink(filePath, (err) => {
      if (err) console.warn('[Cleanup] Could not delete temp file:', filePath);
    });

    // Return the token and basic info to the frontend
    res.json({
      success: true,
      token,
      filename: req.file.originalname,
      wordCount: text.split(/\s+/).filter(Boolean).length,
      charCount: text.length
    });

  } catch (err) {
    // Clean up the file even if processing failed
    fs.unlink(filePath, () => {});
    console.error('[Upload Error]', err.message);
    res.status(422).json({ error: err.message });
  }
});

// ─── POST /api/simplify ───────────────────────────────────────────────────────
// Simplifies the paper stored under the given token.

router.post('/simplify', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Session token is missing. Please upload a paper first.' });
  }

  const paper = paperStore.get(token);
  if (!paper) {
    return res.status(404).json({
      error: 'Paper not found. It may have expired. Please upload the paper again.'
    });
  }

  try {
    const simplified = await simplifyPaper(paper.text);
    res.json({ success: true, result: simplified });
  } catch (err) {
    console.error('[Simplify Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/ask ────────────────────────────────────────────────────────────
// Answers a question about the paper stored under the given token.

router.post('/ask', async (req, res) => {
  const { token, question } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Session token is missing. Please upload a paper first.' });
  }

  if (!question || question.trim().length < 3) {
    return res.status(400).json({ error: 'Please enter a valid question.' });
  }

  const paper = paperStore.get(token);
  if (!paper) {
    return res.status(404).json({
      error: 'Paper not found. It may have expired. Please upload the paper again.'
    });
  }

  try {
    const answer = await answerQuestion(paper.text, question.trim());
    res.json({ success: true, answer });
  } catch (err) {
    console.error('[Ask Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Cleanup old sessions every hour ─────────────────────────────────────────
// Prevent the in-memory store from growing indefinitely.
setInterval(() => {
  const ONE_HOUR = 60 * 60 * 1000;
  const now = Date.now();
  for (const [token, data] of paperStore.entries()) {
    if (now - data.uploadedAt > ONE_HOUR) {
      paperStore.delete(token);
    }
  }
}, 60 * 60 * 1000);

module.exports = router;
