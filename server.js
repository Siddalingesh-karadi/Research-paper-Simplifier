// server.js — Entry point for Research Simplifier backend
// Loads environment variables, sets up Express, mounts routes, and starts the server.

require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const paperRoutes = require('./routes/paper');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────────────────────────

// Allow the frontend (served from /frontend) to call this backend.
app.use(cors());

// Parse JSON bodies for the /ask route.
app.use(express.json());

// Serve the frontend folder as static files.
// Users visit http://localhost:3000 and get frontend/index.html.
app.use(express.static(path.join(__dirname, 'frontend')));

// ─── API Routes ───────────────────────────────────────────────────────────────

// All paper-related endpoints: /api/upload, /api/simplify, /api/ask
app.use('/api', paperRoutes);

// ─── Catch-All: Serve Frontend ────────────────────────────────────────────────

// For any unrecognised route, send back index.html.
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// ─── Global Error Handler ─────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: err.message || 'Internal server error.' });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✅ Research Simplifier running at http://localhost:${PORT}`);
  console.log(`   API Key configured: ${process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here' ? 'Yes ✓' : 'No ✗ — set GEMINI_API_KEY in .env'}`);
});
