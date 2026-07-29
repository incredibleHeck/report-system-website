import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import healthRoutes from './server/routes/health.routes.js';
import geminiRoutes from './server/routes/gemini.routes.js';
import broadcastRoutes from './server/routes/broadcast.routes.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '25mb' }));

const PORT = Number(process.env.PORT || 3001);

// Mount routes
app.use('/api', healthRoutes);
app.use('/api', geminiRoutes);
app.use('/api', broadcastRoutes);

if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, 'dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`SAIS API proxy listening on http://localhost:${PORT}`);
});
