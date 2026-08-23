require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const PDFParser = require('pdf2json');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('./utils/db');
const { chunkText } = require('./utils/chunker');
const { VectorStore } = require('./utils/vectorStore');

const app = express();
const port = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'documind_secure_jwt_secret_key_2026';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({ storage: multer.memoryStorage() });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const chatModel = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

const userStores = new Map();

function getUserStore(userId) {
  if (!userStores.has(userId)) {
    userStores.set(userId, {
      store: new VectorStore(),
      documentInfo: null,
    });
  }
  return userStores.get(userId);
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. Token missing.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Session expired or invalid.' });
    }
    req.user = user;
    next();
  });
}

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

// --- Auth Endpoints ---

app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run(
      `INSERT INTO users (email, password) VALUES (?, ?)`,
      [email.toLowerCase(), hashedPassword],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Email already registered.' });
          }
          return res.status(500).json({ error: 'Database registration error.' });
        }
        const token = jwt.sign({ id: this.lastID, email: email.toLowerCase() }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ token, email: email.toLowerCase() });
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  db.get(`SELECT * FROM users WHERE email = ?`, [email.toLowerCase()], async (err, user) => {
    if (err || !user) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, email: user.email });
  });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  const userSession = getUserStore(req.user.id);
  res.json({
    email: req.user.email,
    document: userSession.documentInfo,
  });
});

// --- App Endpoints ---

app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
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

    const userSession = getUserStore(req.user.id);
    userSession.store.clear();

    const chunks = chunkText(rawText, 400, 80);
    await userSession.store.addDocuments(chunks);

    userSession.documentInfo = {
      filename: req.file.originalname,
      totalChunks: chunks.length,
      uploadedAt: new Date().toISOString(),
    };

    res.json({
      message: 'Document indexed successfully.',
      document: userSession.documentInfo,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to process document.' });
  }
});

app.post('/api/chat', authenticateToken, async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Question is required.' });
    }

    const userSession = getUserStore(req.user.id);
    if (userSession.store.documents.length === 0) {
      return res.status(400).json({ error: 'Please upload and index a document first.' });
    }

    const topChunks = await userSession.store.search(question, 5);
    const context = topChunks.map((c) => c.text).join('\n---\n');

    const prompt = `
You are DocuMind AI, an expert analytical document assistant.
Analyze the provided document excerpts to answer the user's request thoroughly and accurately.
You are permitted to evaluate, rate, critique, summarize, or extract details based on the contents provided.
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

// Explicit Route for root and SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`DocuMind AI running on port ${port}`);
});