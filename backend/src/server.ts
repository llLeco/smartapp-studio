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

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export default app; 