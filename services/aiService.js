// services/aiService.js
// Handles all communication with the Google Gemini API.
// The API key is read from the environment variable — it is NEVER exposed to the frontend.

const https = require('https');

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

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
      temperature: 0.2,       // Low temperature = factual, grounded output
      topK: 40,
      topP: 0.9,
      maxOutputTokens: 4096   // Enough for a detailed paper summary
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
  // Limit input to prevent huge API costs and timeouts.
  // Gemini 1.5 Flash supports ~1M tokens but we cap at ~12,000 words for speed.
  const MAX_CHARS = 50000;
  const truncated = paperText.length > MAX_CHARS
    ? paperText.slice(0, MAX_CHARS) + '\n\n[Note: Paper was truncated to fit processing limits.]'
    : paperText;

  const prompt = `
You are an academic research assistant helping students and beginners understand research papers.

Your task is to read the following research paper and produce a simplified explanation.

IMPORTANT RULES:
1. Base your explanation ONLY on the content provided. Do not invent results, statistics, or conclusions.
2. If a section is not present in the paper, write exactly: "Not available in this paper."
3. Use simple, clear English. Avoid unnecessary jargon.
4. When you must use a technical term, explain it briefly in plain English immediately after.
5. Keep each section concise and easy to read.
6. Use bullet points for lists.

OUTPUT FORMAT — respond with EXACTLY these 13 section headings in this order:

## 1. Paper Overview
(One short paragraph summarising what this paper is about and who wrote it, if mentioned.)

## 2. Abstract in Simple English
(Rewrite the abstract in plain English so a non-expert can understand it.)

## 3. Problem Statement
(What problem or challenge does this research address?)

## 4. Research Objectives
(What specific goals did the researchers set out to achieve?)

## 5. Existing Methods
(What methods or approaches existed before this research? What were their shortcomings?)

## 6. Proposed Method
(What new method, system, or approach does this paper introduce?)

## 7. Methodology
(Step-by-step: how did the researchers carry out their work?)

## 8. Technologies and Algorithms Used
(List the key technologies, tools, algorithms, or datasets used.)

## 9. Results and Findings
(What did the researchers find? Include specific numbers or metrics if the paper mentions them.)

## 10. Advantages
(What are the strengths or benefits of the proposed method?)

## 11. Limitations
(What are the weaknesses, constraints, or areas for future improvement?)

## 12. Conclusion
(What is the overall takeaway from this research?)

## 13. Important Technical Terms Explained Simply
(List 4–8 key technical terms from the paper and explain each one in one or two simple sentences.)

---
RESEARCH PAPER TEXT:
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
