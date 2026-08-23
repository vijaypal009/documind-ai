/**
 * Splits text into overlapping chunks.
 * @param {string} text - The raw text from the document.
 * @param {number} chunkSize - Character size per chunk (default 500).
 * @param {number} chunkOverlap - Overlap between consecutive chunks (default 100).
 * @returns {string[]} Array of chunked text strings.
 */
function chunkText(text, chunkSize = 500, chunkOverlap = 100) {
  if (!text || text.trim().length === 0) return [];

  const cleanedText = text.replace(/\s+/g, ' ').trim();
  const chunks = [];
  let startIndex = 0;

  while (startIndex < cleanedText.length) {
    let endIndex = startIndex + chunkSize;

    // If we're not at the very end, try not to cut off in the middle of a word
    if (endIndex < cleanedText.length) {
      const lastSpaceIndex = cleanedText.lastIndexOf(' ', endIndex);
      if (lastSpaceIndex > startIndex) {
        endIndex = lastSpaceIndex;
      }
    }

    const chunk = cleanedText.slice(startIndex, endIndex).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    startIndex = endIndex - chunkOverlap;
    if (startIndex >= cleanedText.length || endIndex >= cleanedText.length) {
      break;
    }
  }

  return chunks;
}

module.exports = { chunkText };