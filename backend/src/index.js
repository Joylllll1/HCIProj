import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import verifyRoutes from './routes/verifyRoutes.js';
import passwordRoutes from './routes/passwordRoutes.js';
import postRoutes from './routes/postRoutes.js';
import commentRoutes from './routes/commentRoutes.js';
import likeRoutes from './routes/likeRoutes.js';
import fortuneRoutes from './routes/fortuneRoutes.js';
import draftRoutes from './routes/draftRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import sseRoutes from './routes/sseRoutes.js';
import bookmarkRoutes from './routes/bookmarkRoutes.js';
import errorHandler from './middlewares/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '15mb' }));

// ─── Routes ───
app.use('/api/auth', authRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/password', passwordRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/likes', likeRoutes);
app.use('/api/fortune', fortuneRoutes);
app.use('/api/drafts', draftRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/stream', sseRoutes);
app.use('/api/bookmarks', bookmarkRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Error handler (must be last) ───
app.use(errorHandler);

// ─── Start ───
const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

start();
