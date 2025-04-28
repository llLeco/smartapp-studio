export function splitTextIntoChunks(text: string, maxTokens: number): string[] {
    const sentences = text.split(/(?<=[.?!])\s+/);
    const chunks: string[] = [];
    let currentChunk = '';
  
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > maxTokens * 4) { // 1 token ~ 4 characters
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      currentChunk += ' ' + sentence;
    }
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
    return chunks;
  }
  