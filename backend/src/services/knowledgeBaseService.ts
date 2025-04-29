import { Injectable } from '@nestjs/common';
import fs from 'fs';
import path from 'path';
import { createEmbedding } from '../utils/embedding.util';
import { cosineSimilarity } from '../utils/cosine-similarity.util';

interface EmbeddingItem {
  id: string;
  content: string;
  embedding: number[];
}

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
    
    console.log('DEBUG CHAT: KnowledgeBase - Searching for embeddings file in multiple locations');
    
    // Find the first path that exists
    for (const potentialPath of possiblePaths) {
      console.log(`DEBUG CHAT: KnowledgeBase - Checking path: ${potentialPath}`);
      if (fs.existsSync(potentialPath)) {
        this.embeddingsFilePath = potentialPath;
        console.log(`DEBUG CHAT: KnowledgeBase - Found embeddings at: ${potentialPath}`);
        this.isEmbeddingsAvailable = true;
        try {
          this.loadEmbeddings();
        } catch (err) {
          console.error('DEBUG CHAT: KnowledgeBase - Error loading embeddings:', err);
          this.isEmbeddingsAvailable = false;
        }
        break;
      }
    }
    
    if (!this.isEmbeddingsAvailable) {
      console.warn('DEBUG CHAT: KnowledgeBase - No embeddings file found in any location - will operate without knowledge base');
    }
  }

  private loadEmbeddings(): void {
    try {
      if (!this.embeddingsFilePath || !fs.existsSync(this.embeddingsFilePath)) {
        console.warn('DEBUG CHAT: KnowledgeBase - Embeddings file not found during load');
        return;
      }
      
      console.log('DEBUG CHAT: KnowledgeBase - Loading embeddings from:', this.embeddingsFilePath);
      const data = fs.readFileSync(this.embeddingsFilePath, 'utf8');
      this.embeddings = JSON.parse(data);
      console.log(`DEBUG CHAT: KnowledgeBase - Loaded ${this.embeddings.length} embeddings`);
    } catch (error) {
      console.error('DEBUG CHAT: KnowledgeBase - Error loading embeddings:', error);
      this.embeddings = [];
      this.isEmbeddingsAvailable = false;
    }
  }

  async getRelevantContext(prompt: string, topN = 5): Promise<string> {
    try {
      // If embeddings aren't available, return empty string immediately
      if (!this.isEmbeddingsAvailable) {
        console.log('DEBUG CHAT: KnowledgeBase - No embeddings available, skipping context retrieval');
        return '';
      }
      
      console.log('DEBUG CHAT: KnowledgeBase - Getting context for prompt:', prompt.substring(0, 50) + '...');
      
      // Double-check file exists
      if (!this.embeddingsFilePath || !fs.existsSync(this.embeddingsFilePath)) {
        console.warn('DEBUG CHAT: KnowledgeBase - Embeddings file not available');
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
        console.error('DEBUG CHAT: KnowledgeBase - Error reading embeddings file:', readError);
        return '';
      }
      
      if (!database || database.length === 0) {
        console.warn('DEBUG CHAT: KnowledgeBase - Empty database');
        return '';
      }
      
      console.log(`DEBUG CHAT: KnowledgeBase - Database has ${database.length} entries`);
      
      let promptEmbedding;
      try {
        promptEmbedding = await createEmbedding(prompt);
      } catch (embeddingError) {
        console.error('DEBUG CHAT: KnowledgeBase - Error creating embedding:', embeddingError);
        return '';
      }
      
      if (!promptEmbedding) {
        console.warn('DEBUG CHAT: KnowledgeBase - Failed to create embedding for prompt');
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
      console.log('DEBUG CHAT: KnowledgeBase - Found relevant context');
      
      return context;
    } catch (error) {
      console.error('DEBUG CHAT: KnowledgeBase - Error in getRelevantContext:', error);
      // Return empty string instead of throwing to avoid breaking the chat flow
      return '';
    }
  }
}
