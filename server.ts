import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { db, initDb } from './src/db/database';
import authRoutes from './src/routes/auth';
import testRoutes from './src/routes/test';
import adminRoutes from './src/routes/admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());
  app.use(cookieParser());
  
  // Security headers (configured to allow Vite scripts)
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disabled for dev/preview simplicity, would enable in strict prod
    })
  );

  // Initialize Database
  initDb();

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/test', testRoutes);
  app.use('/api/admin', adminRoutes);

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static file serving
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
