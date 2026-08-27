require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const PDFParser = require('pdf2json');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { chunkText } = require('./utils/chunker');
const { VectorStore } = require('./utils/vectorStore');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({ storage: multer.memoryStorage() });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const chatModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

const globalStore = new VectorStore();
let currentDocument = null;

function parsePdfBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, 1);
    pdfParser.on('pdfParser_dataError', (errData) => reject(errData.parserError));
    pdfParser.on('pdfParser_dataReady', () => {
      resolve(pdfParser.getRawTextContent());
    });
    pdfParser.parseBuffer(buffer);
  });
}

// Upload & Index Endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    let rawText = '';
    if (req.file.mimetype === 'application/pdf') {
      rawText = await parsePdfBuffer(req.file.buffer);
    } else {
      rawText = req.file.buffer.toString('utf-8');
    }

    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ error: 'The uploaded file contains no readable text.' });
    }

    globalStore.clear();

    const chunks = chunkText(rawText, 400, 80);
    await globalStore.addDocuments(chunks);

    currentDocument = {
      filename: req.file.originalname,
      totalChunks: chunks.length,
      uploadedAt: new Date().toISOString(),
    };

    res.json({
      message: 'Document indexed successfully.',
      document: currentDocument,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to process document.' });
  }
});

// Q&A Query Endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Question is required.' });
    }

    if (globalStore.documents.length === 0) {
      return res.status(400).json({ error: 'Please upload and index a document first.' });
    }

    const topChunks = await globalStore.search(question, 5);
    const context = topChunks.map((c) => c.text).join('\n---\n');

    const prompt = `
You are DocuMind AI, an expert analytical document assistant.
Analyze the provided document excerpts to answer the user's request thoroughly and accurately.
Format your output cleanly using markdown headings, bullet points, and bold text.
If the request is completely unrelated to anything in the document context, state: "I cannot find this information in the uploaded document."

Context Excerpts:
${context}

User Request:
${question}

Response:
`;

    const result = await chatModel.generateContent(prompt);
    const response = await result.response;

    res.json({
      answer: response.text(),
      sources: topChunks.map((c) => ({ text: c.text, score: c.score })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to generate answer.' });
  }
});

// Express v5 compatible SPA fallback
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`DocuMind AI running on port ${port}`);
});