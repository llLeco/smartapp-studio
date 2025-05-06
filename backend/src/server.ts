// Fix imports using dynamic import with CommonJS compatibility
const express = await import('express').then(m => m.default || m);
const cors = await import('cors').then(m => m.default || m);
import dotenv from 'dotenv';
import routes from './routes/index.js';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', routes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Initialize services - safer dynamic import to avoid ESM issues
let chatServiceInitialized = false;
(async () => {
  try {
    // Use a more defensive import approach
    const chatService = await import('./services/chatService.js').catch(error => {
      console.error('❌ Failed to import chat service:', error);
      return { initChatService: null };
    });
    
    if (chatService && typeof chatService.initChatService === 'function') {
      await chatService.initChatService();
      chatServiceInitialized = true;
      console.log('✅ Chat service initialized successfully');
    } else {
      console.warn('⚠️ Chat service initialization function not found');
    }
    
    console.log('✅ Services initialization completed');
  } catch (error) {
    console.error('❌ Error initializing services:', error);
  }
})();

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Chat service initialized: ${chatServiceInitialized ? 'Yes' : 'No'}`);
});

export default app; 