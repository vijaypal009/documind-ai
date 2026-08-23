# DocuMind AI - Document Intelligence & RAG Query Engine

A full-stack Retrieval-Augmented Generation (RAG) platform that enables users to upload documents (PDF/TXT) and execute grounded, context-aware queries using Gemini 3.6 Flash.

## Features
- **JWT Authentication & Security:** Token-based access with bcrypt password hashing and SQLite persistence.
- **Multi-Tenant Document Isolation:** User-specific vector indexing and isolated workspaces.
- **RAG Architecture:** Memory-efficient PDF buffer parsing, sliding-window chunking, and tokenized term-frequency retrieval.
- **Modern UI:** Markdown rendering, live grounding citations with similarity scores, and dark/light theme switching.

## Tech Stack
- **Backend:** Node.js, Express.js, JWT, Bcrypt, SQLite3, Multer, pdf2json
- **AI & Retrieval:** Google Gen AI SDK (`gemini-3.6-flash`), Custom Vector Store
- **Frontend:** Vanilla JS, HTML5, CSS3, Marked.js

## Setup & Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd <folder-name>