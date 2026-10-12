// services/aiService.js
// Handles all communication with the Google Gemini API.
// The API key is read from the environment variable — it is NEVER exposed to the frontend.

const https = require('https');

// ─── Configuration ────────────────────────────────────────────────────────────

// Primary model — Gemini 2.0 Flash (fast, free-tier friendly)
const GEMINI_MODEL   = 'gemini-2.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ─── Helper: Call Gemini API ──────────────────────────────────────────────────

/**
 * callGemini
 * ----------
 * Sends a prompt to the Gemini API and returns the text response.
 *
 * @param {string} prompt          - The full prompt to send.
 * @param {object} [genConfig]     - Optional override for generationConfig.
 * @returns {Promise<string>}      - The model's text response.
 */
async function callGemini(prompt, genConfig = {}) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error(
      'Gemini API key is not configured. ' +
      'Please add your GEMINI_API_KEY to the .env file.'
    );
  }

  const url = `${GEMINI_API_URL}?key=${apiKey}`;

  const defaultConfig = {
    temperature:     0.2,   // Near-deterministic → reduces hallucination
    topK:            40,
    topP:            0.9,
    maxOutputTokens: 2048,
  };

  const requestBody = JSON.stringify({
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: { ...defaultConfig, ...genConfig },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ]
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method:  'POST',
        headers: {
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
        }
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(rawData);

            if (parsed.error) {
              return reject(new Error(`Gemini API error: ${parsed.error.message}`));
            }

            const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!text) {
              const blockReason = parsed?.candidates?.[0]?.finishReason;
              return reject(new Error(
                blockReason === 'SAFETY'
                  ? 'The AI declined to process this content due to safety filters. Please try a different paper.'
                  : 'Gemini returned an empty response. Please try again.'
              ));
            }

            resolve(text.trim());
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
 * explanation of the research paper across 5 defined sections.
 *
 * @param {string} paperText - Raw extracted text from the PDF.
 * @returns {Promise<string>} - Structured simplified explanation in markdown.
 */
async function simplifyPaper(paperText) {
  // Cap input — first 20,000 chars covers most 8–15 page papers adequately.
  const MAX_CHARS = 20000;
  const truncated = paperText.length > MAX_CHARS
    ? paperText.slice(0, MAX_CHARS) + '\n\n[Paper truncated at 20,000 characters for processing]'
    : paperText;

  const prompt = `
You are an expert academic research assistant helping students understand research papers.

TASK: Simplify the research paper below into a structured, beginner-friendly explanation.

STRICT RULES:
1. Base ALL answers ONLY on the paper content provided. Do not add outside knowledge or invent facts.
2. If a section's content is not present in the paper, write exactly: "Not mentioned in this paper."
3. Use simple, clear English. Avoid jargon unless you briefly explain it.
4. Use bullet points (starting with -) for lists. Use **bold** for key terms.
5. Be thorough but concise — aim for 3–6 bullet points or 2–4 sentences per section.

OUTPUT FORMAT: You MUST respond with EXACTLY these 5 sections using these exact headings:

## 1. What is this paper about?
(2-3 sentences: the topic, the main goal, and the key contribution or finding.)

## 2. Problem & Solution
(What specific problem does this paper address? What is the proposed solution or approach?)

## 3. How it works
(Step-by-step explanation of the methodology, system, or approach used. Use bullet points.)

## 4. Results & Key Findings
(What were the main results? Include any numbers, accuracy metrics, or benchmarks mentioned.)

## 5. Conclusion & Limitations
(Main takeaway of the paper, and any weaknesses, limitations, or future work the authors mention.)

---
RESEARCH PAPER TEXT:
${truncated}
`;

  return callGemini(prompt, { maxOutputTokens: 2048 });
}

// ─── Answer Question ──────────────────────────────────────────────────────────

/**
 * answerQuestion
 * --------------
 * Answers a user's question strictly based on the paper's content.
 *
 * @param {string} paperText - Raw extracted text from the PDF.
 * @param {string} question  - The user's question.
 * @returns {Promise<string>} - The grounded answer.
 */
async function answerQuestion(paperText, question) {
  const MAX_CHARS = 50000;
  const truncated = paperText.length > MAX_CHARS
    ? paperText.slice(0, MAX_CHARS) + '\n\n[Paper truncated]'
    : paperText;

  const prompt = `
You are an academic research assistant. A user has uploaded a research paper and is asking a question about it.

STRICT RULES:
1. Answer ONLY based on the paper content provided below.
2. If the answer is not in the paper, respond with: "I could not find information about this in the paper."
3. Do NOT invent facts, numbers, citations, or conclusions not present in the paper.
4. Keep the answer clear, accurate, and easy to understand.
5. If the question is unrelated to the paper, say: "That question does not appear to be related to this paper."
6. You may use bullet points for multi-part answers. Use **bold** for key terms.

USER'S QUESTION:
${question}

---
RESEARCH PAPER TEXT:
${truncated}
`;

  return callGemini(prompt, { maxOutputTokens: 1024, temperature: 0.15 });
}

module.exports = { simplifyPaper, answerQuestion };
