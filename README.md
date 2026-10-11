# Research Simplifier

A simple web application that helps students and beginners understand complex academic research papers, including IEEE papers and other PDF documents.

Upload a PDF → Click a button → Get a clear, section-by-section simplified explanation.

---

## Features

- **Upload any research paper PDF** (up to 10 MB)
- **Simplified explanation** across 13 structured sections
- **Ask questions** about the paper and get answers grounded in its content
- **Copy** the full explanation to clipboard
- **No login required** — open and use directly
- **Secure** — API key stays on the backend, PDFs deleted after processing

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | HTML, CSS, JavaScript | Clean UI, no framework needed |
| Backend | Node.js + Express.js | API server, file handling |
| PDF Parsing | pdf-parse | Extract text from uploaded PDFs |
| AI Simplification | Google Gemini 1.5 Flash | Generate structured, grounded explanations |
| File Upload | multer | Handle multipart form data |
| Config | dotenv | Keep API key secure on backend |

---

## Project Structure

```
Research_paper-Simplifier/
│
├── frontend/
│   ├── index.html        ← Single-page UI
│   ├── style.css         ← Minimal, clean styling
│   └── app.js            ← All client-side logic
│
├── routes/
│   └── paper.js          ← /api/upload, /api/simplify, /api/ask
│
├── services/
│   ├── pdfService.js     ← PDF text extraction
│   └── aiService.js      ← Gemini API integration
│
├── uploads/              ← Temp folder (PDFs deleted after processing)
├── server.js             ← Express entry point
├── .env                  ← API key (never committed)
├── .gitignore
└── package.json
```

---

## Setup & Running

### 1. Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher
- A free [Google Gemini API key](https://aistudio.google.com/app/apikey)

### 2. Clone the Repository

```bash
git clone https://github.com/Siddalingesh-karadi/Research_paper-Simplifier.git
cd Research_paper-Simplifier
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure API Key

Open the `.env` file and replace the placeholder with your actual key:

```
GEMINI_API_KEY=your_actual_key_here
PORT=3000
```

> **Never commit your `.env` file.** It is already listed in `.gitignore`.

### 5. Start the Server

```bash
npm start
```

### 6. Open the App

Open your browser and go to:

```
http://localhost:3000
```

---

## How to Use

1. **Upload** a research paper PDF (drag-and-drop or click to select)
2. Click **Upload & Process Paper**
3. Click **Simplify Paper** — wait 15–30 seconds for the AI to process
4. Read the **13-section simplified explanation**
5. Optionally, **ask questions** about the paper in the Q&A section
6. **Copy** the explanation or upload another paper

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload a PDF, extract text, return session token |
| POST | `/api/simplify` | Simplify the paper for a given session token |
| POST | `/api/ask` | Answer a question about the uploaded paper |

---

## Simplified Explanation Sections

1. Paper Overview
2. Abstract in Simple English
3. Problem Statement
4. Research Objectives
5. Existing Methods
6. Proposed Method
7. Methodology
8. Technologies and Algorithms Used
9. Results and Findings
10. Advantages
11. Limitations
12. Conclusion
13. Important Technical Terms Explained Simply

---

## Security Notes

- Uploaded PDF files are deleted from the server immediately after text extraction
- The Gemini API key is stored only in the `.env` file on the backend — it is never sent to the browser
- File size is limited to 10 MB
- Only PDF files are accepted (validated on both client and server)
- In-memory sessions expire after 1 hour

---

## Limitations

- Works best with **text-based PDFs** (not scanned/image PDFs)
- Very long papers (>50,000 characters) are truncated before sending to the AI
- Requires an active internet connection (Gemini API calls)
- Free Gemini API tier has rate limits — wait a minute if you hit a limit

---

## License

ISC
