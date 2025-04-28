import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import { createEmbedding } from '../utils/embedding.util';
import { cosineSimilarity } from '../utils/cosine-similarity.util';

@Injectable()
export class KnowledgeBaseService {
  private databasePath = './src/database/embeddings.json';

  async getRelevantContext(prompt: string, topN = 5): Promise<string> {
    const database = JSON.parse(fs.readFileSync(this.databasePath, 'utf8'));
    const promptEmbedding = await createEmbedding(prompt);

    const scored = database.map((item: any) => ({
      ...item,
      score: cosineSimilarity(promptEmbedding, item.embedding)
    }));

    const topChunks = scored.sort((a: any, b: any) => b.score - a.score).slice(0, topN);

    return topChunks
      .map((chunk: any) => `From File: ${chunk.file}\n\n${chunk.chunk}`)
      .join('\n\n');
  }
}
