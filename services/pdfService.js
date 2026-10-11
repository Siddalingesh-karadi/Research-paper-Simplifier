// services/pdfService.js
// Extracts plain text from an uploaded PDF file.
// Uses pdfjs-dist (Mozilla's PDF.js) — works on all Node.js versions including v24.

const fs   = require('fs');
const path = require('path');

/**
 * extractTextFromPDF
 * ------------------
 * Reads the PDF at filePath, iterates every page, and returns the full text.
 *
 * @param {string} filePath - Absolute path to the uploaded PDF file.
 * @returns {Promise<string>} - Extracted plain text.
 * @throws {Error} - If the file cannot be read or has no extractable text.
 */
async function extractTextFromPDF(filePath) {
  // Dynamically import pdfjs-dist (it uses ES module exports internally).
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  // Suppress pdfjs internal font-not-found warnings (they don't affect text extraction).
  pdfjsLib.GlobalWorkerOptions && (pdfjsLib.GlobalWorkerOptions.workerSrc = '');

  // Read file into a Uint8Array (the format pdfjs-dist expects).
  const fileBuffer = fs.readFileSync(filePath);
  const uint8Array = new Uint8Array(fileBuffer);

  // Load the PDF document. disableRange/disableStream = no network fetching needed.
  const loadingTask = pdfjsLib.getDocument({
    data: uint8Array,
    standardFontDataUrl: '',   // suppresses the font warning
    verbosity: 0               // silence internal log messages
  });
  const pdfDoc = await loadingTask.promise;

  const totalPages = pdfDoc.numPages;
  const pageTexts  = [];

  // Extract text from every page.
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page        = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Join text items with spaces; add a newline between pages.
    const pageText = textContent.items
      .map(item => item.str)
      .join(' ');

    pageTexts.push(pageText);
  }

  const fullText = pageTexts.join('\n').trim();

  if (!fullText || fullText.length < 50) {
    throw new Error(
      'Could not extract readable text from this PDF. ' +
      'The file may be scanned (image-based) or encrypted. ' +
      'Please upload a text-based PDF.'
    );
  }

  return fullText;
}

module.exports = { extractTextFromPDF };
