// Local In-Memory Retrieval (No external embedding API calls = zero 404 errors)
class VectorStore {
  constructor() {
    this.documents = []; // array of { text, terms: Set, termFreq: Map }
  }

  clear() {
    this.documents = [];
  }

  tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);
  }

  calculateScore(queryTokens, doc) {
    let score = 0;
    queryTokens.forEach((token) => {
      const count = doc.termFreq.get(token) || 0;
      if (count > 0) {
        // TF-IDF inspired score
        score += 1 + Math.log(count);
      }
    });
    return score;
  }

  async addDocuments(chunks) {
    for (const chunk of chunks) {
      const tokens = this.tokenize(chunk);
      const termFreq = new Map();
      tokens.forEach((t) => {
        termFreq.set(t, (termFreq.get(t) || 0) + 1);
      });

      this.documents.push({
        text: chunk,
        termFreq: termFreq,
      });
    }
  }

  async search(query, topK = 3) {
    const queryTokens = this.tokenize(query);

    const scored = this.documents.map((doc) => ({
      text: doc.text,
      score: this.calculateScore(queryTokens, doc),
    }));

    // Sort by relevance score descending
    scored.sort((a, b) => b.score - a.score);

    // If no exact match found, return the top non-zero or first chunk
    const positiveMatches = scored.filter((s) => s.score > 0);
    return positiveMatches.length > 0 ? positiveMatches.slice(0, topK) : scored.slice(0, topK);
  }
}

module.exports = { VectorStore };