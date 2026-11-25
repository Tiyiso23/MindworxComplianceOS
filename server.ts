import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  analyzeComplianceDocument,
  generateManagementSummaryWithGemini,
} from './server/geminiService.ts';
import type { ManagementSummaryMetrics } from './src/types/compliance.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT || 3000);

  app.use(express.json({ limit: '16mb' }));

  app.post('/api/gemini/document-check', async (req, res) => {
    try {
      const { base64Data, mimeType } = req.body ?? {};
      if (typeof base64Data !== 'string' || !base64Data.trim()) {
        res.status(400).json({ error: 'Uploaded file payload is missing.' });
        return;
      }
      if (typeof mimeType !== 'string' || !ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
        res.status(400).json({
          error: 'Unsupported file type. Upload a PDF or PNG/JPEG/WebP image.',
        });
        return;
      }

      const normalizedMime = mimeType.toLowerCase() === 'image/jpg' ? 'image/jpeg' : mimeType.toLowerCase();
      const cleanedBase64 = base64Data.replace(/^data:[^;]+;base64,/, '').trim();
      const byteLength = Buffer.byteLength(cleanedBase64, 'base64');

      if (byteLength === 0 || byteLength > MAX_FILE_BYTES) {
        res.status(400).json({
          error: 'File must be non-empty and no larger than 10 MB.',
        });
        return;
      }

      const extraction = await analyzeComplianceDocument({
        base64Data: cleanedBase64,
        mimeType: normalizedMime,
      });

      res.json({ extraction });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Document check service unavailable.';
      res.status(502).json({ error: message });
    }
  });

  app.post('/api/gemini/management-summary', async (req, res) => {
    try {
      const metrics = req.body?.metrics as ManagementSummaryMetrics | undefined;
      if (!metrics || typeof metrics !== 'object' || typeof metrics.total !== 'number') {
        res.status(400).json({ error: 'Valid dashboard metrics payload is required.' });
        return;
      }

      const result = await generateManagementSummaryWithGemini(metrics);
      res.json(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Management summary service unavailable.';
      res.status(502).json({ error: message });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Mindworx Compliance Dashboard server listening on port ${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
