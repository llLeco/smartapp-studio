import { Injectable } from '@nestjs/common';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createEmbedding } from '../utils/embedding.util.js';
import { cosineSimilarity } from '../utils/cosine-similarity.util.js';

interface EmbeddingItem {
  id: string;
  content: string;
  embedding: number[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

@Injectable()
export class KnowledgeBaseService {
  private embeddings: EmbeddingItem[] = [];
  private embeddingsFilePath: string = '';
  private isEmbeddingsAvailable: boolean = false;
  
  constructor() {
    // Try multiple possible locations for the embeddings file
    const possiblePaths = [
      path.resolve(__dirname, '../../src/database/embeddings.json'),
      path.resolve(process.cwd(), 'src/database/embeddings.json'),
      path.resolve(process.cwd(), 'database/embeddings.json'),
      path.resolve(process.cwd(), 'embeddings.json')
    ];
    
    
    // Find the first path that exists
    for (const potentialPath of possiblePaths) {
      if (fs.existsSync(potentialPath)) {
        this.embeddingsFilePath = potentialPath;
        this.isEmbeddingsAvailable = true;
        try {
          this.loadEmbeddings();
        } catch (err) {
          this.isEmbeddingsAvailable = false;
        }
        break;
      }
    }
  }

  private loadEmbeddings(): void {
    try {
      if (!this.embeddingsFilePath || !fs.existsSync(this.embeddingsFilePath)) {
        return;
      }
      
      const data = fs.readFileSync(this.embeddingsFilePath, 'utf8');
      this.embeddings = JSON.parse(data);
    } catch (error) {
      this.embeddings = [];
      this.isEmbeddingsAvailable = false;
    }
  }

  async getRelevantContext(prompt: string, topN = 5): Promise<string> {
    try {
      // If embeddings aren't available, return empty string immediately
      if (!this.isEmbeddingsAvailable) {
        return '';
      }
      
      // Double-check file exists
      if (!this.embeddingsFilePath || !fs.existsSync(this.embeddingsFilePath)) {
        return '';
      }
      
      let database;
      try {
        const rawData = fs.readFileSync(this.embeddingsFilePath, 'utf8');
        database = JSON.parse(rawData) as Array<{
          file: string;
          chunk: string;
          embedding: number[];
        }>;
      } catch (readError) {
        return '';
      }
      
      if (!database || database.length === 0) {
        return '';
      }
      
      
      let promptEmbedding;
      try {
        promptEmbedding = await createEmbedding(prompt);
      } catch (embeddingError) {
        return '';
      }
      
      if (!promptEmbedding) {
        return '';
      }

      // Calculate similarity scores
      const scored = database.map((entry) => ({
        ...entry,
        score: cosineSimilarity(promptEmbedding, entry.embedding),
      }));

      // Sort by similarity score and take top N
      const topContext = scored
        .sort((a, b) => b.score - a.score)
        .slice(0, topN);

      // Extract and join content
      const context = topContext.map((entry) => `From File: ${entry.file}\n\n${entry.chunk}`).join('\n\n');
      
      return context;
    } catch (error) {
      // Return empty string instead of throwing to avoid breaking the chat flow
      return '';
    }
  }
}
