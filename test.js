require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const { chunkText } = require('./utils/chunker');
const { VectorStore } = require('./utils/vectorStore');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function answerQuestionWithRAG(query, store) {
  // 1. Retrieve top 2 relevant chunks
  const relevantChunks = await store.search(query, 2);
  const context = relevantChunks.map(c => c.text).join('\n---\n');

  // 2. Build the grounded prompt
  const prompt = `
You are a helpful document assistant. Answer the question strictly using only the provided context. If the answer cannot be found in the context, say "Information not found in the document."

Context:
${context}

Question:
${query}

Answer:
`;

  // 3. Generate the response with Gemini
  const response = await ai.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: prompt,
  });

  return response.text;
}

async function run() {
  const store = new VectorStore();

  const documentText = `
    National Institute of Technology placement rules state that students are eligible 
    for Dream and Super Dream job offers. A student securing a core engineering job can 
    still participate in higher-tier software hiring drives. Attendance for pre-placement 
    talks is mandatory. On the other hand, the campus cafeteria serves breakfast between 
    7:30 AM and 9:00 AM, with daily specials rotating between South Indian and North Indian menus.
  `;

  // Process and index document
  const chunks = chunkText(documentText, 120, 30);
  await store.addDocuments(chunks);

  // Ask questions
  const query1 = "Can a core engineering placed student apply for software drives?";
  console.log(`Q1: ${query1}`);
  const answer1 = await answerQuestionWithRAG(query1, store);
  console.log(`A1: ${answer1}\n`);

  const query2 = "What are the rules regarding gym timings?";
  console.log(`Q2: ${query2}`);
  const answer2 = await answerQuestionWithRAG(query2, store);
  console.log(`A2: ${answer2}`);
}

run();