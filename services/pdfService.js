// services/pdfService.js
// Responsible for reading a PDF file from disk and extracting its text content.
// Uses the 'pdf-parse' library which works entirely locally — no network calls.

const fs      = require('fs');
const pdfParse = require('pdf-parse');

/**
 * extractTextFromPDF
 * ------------------
 * Reads the PDF at the given file path and returns the raw text content.
 *
 * @param {string} filePath - Absolute path to the uploaded PDF file.
 * @returns {Promise<string>} - Extracted plain text.
 * @throws {Error} - If the file cannot be read or parsed.
 */
async function extractTextFromPDF(filePath) {
  // Read the file as a Buffer (binary data).
  const fileBuffer = fs.readFileSync(filePath);

  // pdf-parse reads the buffer and returns an object with a .text property.
  const data = await pdfParse(fileBuffer);

  // Trim whitespace and return.
  const text = data.text ? data.text.trim() : '';

  if (!text || text.length < 50) {
    throw new Error(
      'Could not extract readable text from this PDF. ' +
      'The file may be scanned (image-based) or encrypted. ' +
      'Please try a text-based PDF.'
    );
  }

  return text;
}

module.exports = { extractTextFromPDF };
