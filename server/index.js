import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import diagnosisRoutes from './routes/diagnosis.js';
import competitorRoutes from './routes/competitor.js';
import trackingRoutes from './routes/tracking.js';
import actionPlanRoutes from './routes/actionPlan.js';
import settingsRoutes from './routes/settings.js';
import csvImportRoutes from './routes/csvImport.js';
import outreachRoutes from './routes/outreach.js';

// Inizializza data stores
import './services/dataStore.js';
import './services/outreachStore.js';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS - permetti tutto su Vercel (stessa origin) e localhost in dev
app.use(cors({
  origin: true,
  credentials: true
}));

// JSON body parser
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/diagnosis', diagnosisRoutes);
app.use('/api/competitors', competitorRoutes);
app.use('/api/tracking-health', trackingRoutes);
app.use('/api/action-plan', actionPlanRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/csv-import', csvImportRoutes);
app.use('/api/outreach', outreachRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  const status = err.status || 500;
  res.status(status).json({
    error: true,
    message: err.message || 'Errore interno del server',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`MIA Diagnosi server running on http://localhost:${PORT}`);
  });
}

export default app;
