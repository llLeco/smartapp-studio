import * as fs from 'fs';
import * as path from 'path';
import { createEmbedding } from './utils/embedding.util';
import { splitTextIntoChunks } from './utils/split-text.util';

async function readFiles(dir: string) {
  let files = fs.readdirSync(dir);
  let contents: { file: string; content: string }[] = [];

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      contents = contents.concat(await readFiles(filePath));
    } else if (file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.md')) {
      const text = fs.readFileSync(filePath, 'utf8');
      contents.push({ file: filePath, content: text });
    }
  }

  return contents;
}

async function embedRepo() {
  const files = await readFiles('./uploads/smart-app-master');
  const embeddings: any[] = [];

  for (const file of files) {
    const chunks = splitTextIntoChunks(file.content, 500);
    for (const chunk of chunks) {
      const embedding = await createEmbedding(chunk);
      embeddings.push({ file: file.file, chunk, embedding });
    }
  }

  fs.writeFileSync('./src/database/embeddings.json', JSON.stringify(embeddings, null, 2));
  console.log('✅ Embeddings created successfully.');
}

embedRepo();
