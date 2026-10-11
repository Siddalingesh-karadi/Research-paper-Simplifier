// services/aiService.js
// Handles all communication with the Google Gemini API.
// The API key is read from the environment variable — it is NEVER exposed to the frontend.

const https = require('https');

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent';

// ─── Helper: Call Gemini API ──────────────────────────────────────────────────

/**
 * callGemini
 * ----------
 * Sends a prompt to the Gemini API and returns the text response.
 *
 * @param {string} prompt - The full prompt to send.
 * @returns {Promise<string>} - The model's text response.
 */
async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error(
      'Gemini API key is not configured. ' +
      'Please add your GEMINI_API_KEY to the .env file.'
    );
  }

  const url = `${GEMINI_API_URL}?key=${apiKey}`;

  const requestBody = JSON.stringify({
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      topK: 40,
      topP: 0.9,
      maxOutputTokens: 1500   // Kept short for fast response
    }
  });

  // Use native https instead of axios to avoid extra dependencies.
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody)
        }
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(rawData);

            // Check for API-level errors
            if (parsed.error) {
              return reject(new Error(`Gemini API error: ${parsed.error.message}`));
            }

            const text =
              parsed?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!text) {
              return reject(new Error('Gemini returned an empty response. Please try again.'));
            }

            resolve(text);
          } catch (e) {
            reject(new Error('Failed to parse Gemini API response.'));
          }
        });
      }
    );

    req.on('error', (e) => reject(new Error(`Network error: ${e.message}`)));
    req.write(requestBody);
    req.end();
  });
}

// ─── Simplify Paper ───────────────────────────────────────────────────────────

/**
 * simplifyPaper
 * -------------
 * Builds a structured prompt and asks Gemini to produce a simplified
 * explanation of the research paper across 13 defined sections.
 *
 * @param {string} paperText - Raw extracted text from the PDF.
 * @returns {Promise<string>} - Structured simplified explanation in plain text.
 */
async function simplifyPaper(paperText) {
  // Cap input for speed — first 20,000 chars covers most papers adequately.
  const MAX_CHARS = 20000;
  const truncated = paperText.length > MAX_CHARS
    ? paperText.slice(0, MAX_CHARS)
    : paperText;

  const prompt = `
You are a research assistant. Simplify the research paper below for a beginner.

RULES:
- Be concise and clear. Use simple English.
- Base answers ONLY on the paper. Do not invent facts.
- If a section is missing, write: "Not mentioned in this paper."
- Use bullet points where helpful.

Respond with EXACTLY these 5 sections:

## 1. What is this paper about?
(2-3 sentences: topic, goal, and main contribution.)

## 2. Problem & Solution
(What problem does it solve? What approach did the authors use?)

## 3. How it works
(Brief step-by-step of the methodology or system.)

## 4. Results
(Key findings and numbers/metrics mentioned in the paper.)

## 5. Conclusion & Limitations
(Main takeaway and any weaknesses or future work mentioned.)

---
PAPER:
${truncated}
`;

  return callGemini(prompt);
}

// ─── Answer Question ──────────────────────────────────────────────────────────

/**
 * answerQuestion
 * --------------
 * Answers a user's question strictly based on the paper's content.
 *
 * @param {string} paperText - Raw extracted text from the PDF.
 * @param {string} question  - The user's question.
 * @returns {Promise<string>} - The answer.
 */
async function answerQuestion(paperText, question) {
  const MAX_CHARS = 50000;
  const truncated = paperText.length > MAX_CHARS
    ? paperText.slice(0, MAX_CHARS)
    : paperText;

  const prompt = `
You are an academic research assistant.

A user has uploaded a research paper and is asking a question about it.

RULES:
1. Answer ONLY based on the paper content provided below.
2. If the answer is not in the paper, say: "I could not find information about this in the paper."
3. Do not invent facts, numbers, or conclusions.
4. Keep the answer clear, concise, and easy to understand.
5. If the question is unrelated to the paper, say: "That question does not appear to be related to this paper."

USER'S QUESTION:
${question}

---
RESEARCH PAPER TEXT:
${truncated}
`;

  return callGemini(prompt);
}

module.exports = { simplifyPaper, answerQuestion };
