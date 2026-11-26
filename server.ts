import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { investigationRepository } from './server/repository/investigationRepository';
import {
  addCustomHypothesis,
  createInvestigationRecord,
  handleFollowUpMessage,
  removeHypothesis,
  runFullInvestigation,
  toFriendlyError,
  type StreamEvent,
} from './server/services/investigationService';
import { resolveSearchProvider } from './server/search/searchProvider';
import { checkGeminiHealth, getConfiguredModel } from './server/ai/geminiService';

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

const ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

function isValidId(id: string): boolean {
  return ID_PATTERN.test(id);
}

// Lightweight sliding-window rate limiter for API mutations
const rateBuckets = new Map<string, number[]>();
function rateLimit(maxPerMinute: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'local';
    const now = Date.now();
    const windowStart = now - 60_000;
    const timestamps = (rateBuckets.get(ip) || []).filter((t) => t > windowStart);
    if (timestamps.length >= maxPerMinute) {
      res.status(429).json({
        error: 'Too many requests in a short window. Please wait a moment and try again.',
      });
      return;
    }
    timestamps.push(now);
    rateBuckets.set(ip, timestamps);
    next();
  };
}

function initSse(res: Response): (event: StreamEvent) => void {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  let closed = false;
  res.on('close', () => {
    closed = true;
  });

  return (event: StreamEvent) => {
    if (closed || res.writableEnded) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
}

async function createServer() {
  await investigationRepository.init();
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));

  // Basic security headers & strict CORS (same-origin or explicit ALLOWED_ORIGIN)
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    const allowedOrigin = process.env.ALLOWED_ORIGIN;
    if (allowedOrigin && req.headers.origin === allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // Health & capability status
  app.get('/api/health', (_req, res) => {
    const provider = resolveSearchProvider();
    const geminiConfigured = Boolean((process.env.GEMINI_API_KEY || '').trim());
    res.json({
      backend: 'ok',
      gemini: geminiConfigured ? 'ok' : 'not_configured',
      research: provider.isAvailable() ? 'available' : 'unavailable',
      status: 'ok',
      model: getConfiguredModel(),
      searchProvider: provider.name,
      liveResearchAvailable: provider.isAvailable(),
      aiConfigured: geminiConfigured,
    });
  });

  // Safe development diagnostics for Gemini API + Google Search grounding
  app.get('/api/health/gemini', async (_req, res) => {
    const report = await checkGeminiHealth();
    const statusCode = report.gemini === 'ok' ? 200 : 503;
    res.status(statusCode).json(report);
  });

  // GET /api/investigations
  app.get('/api/investigations', async (_req, res) => {
    try {
      const summaries = await investigationRepository.listSummaries();
      res.json({ investigations: summaries });
    } catch {
      res.status(500).json({ error: 'Unable to load investigations right now.' });
    }
  });

  // POST /api/investigations
  app.post('/api/investigations', rateLimit(30), async (req, res) => {
    const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
    if (question.length < 3 || question.length > 1000) {
      res.status(400).json({
        error: 'Please enter an investigation question between 3 and 1,000 characters.',
      });
      return;
    }

    try {
      const created = await createInvestigationRecord(question);
      res.status(201).json({ investigation: created });
    } catch {
      res.status(500).json({ error: 'Could not start a new investigation right now.' });
    }
  });

  // GET /api/investigations/:id
  app.get('/api/investigations/:id', async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) {
      res.status(400).json({ error: 'Invalid investigation identifier.' });
      return;
    }
    const found = await investigationRepository.getById(id);
    if (!found) {
      res.status(404).json({ error: 'Investigation not found.' });
      return;
    }
    res.json({ investigation: found });
  });

  // PATCH /api/investigations/:id (save/unsave or update title)
  app.patch('/api/investigations/:id', rateLimit(60), async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) {
      res.status(400).json({ error: 'Invalid investigation identifier.' });
      return;
    }
    const found = await investigationRepository.getById(id);
    if (!found) {
      res.status(404).json({ error: 'Investigation not found.' });
      return;
    }
    const nextIsSaved =
      typeof req.body?.isSaved === 'boolean' ? req.body.isSaved : found.isSaved;
    const nextTitle =
      typeof req.body?.title === 'string' && req.body.title.trim().length > 0
        ? req.body.title.trim().slice(0, 140)
        : found.title;

    const updated = await investigationRepository.save({
      ...found,
      isSaved: nextIsSaved,
      title: nextTitle,
    });
    res.json({ investigation: updated });
  });

  // DELETE /api/investigations/:id
  app.delete('/api/investigations/:id', rateLimit(30), async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) {
      res.status(400).json({ error: 'Invalid investigation identifier.' });
      return;
    }
    const deleted = await investigationRepository.delete(id);
    if (!deleted) {
      res.status(404).json({ error: 'Investigation not found.' });
      return;
    }
    res.json({ deleted: true, id });
  });

  // POST /api/investigations/:id/research (SSE streaming full investigation or regenerate)
  app.post('/api/investigations/:id/research', rateLimit(20), async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) {
      res.status(400).json({ error: 'Invalid investigation identifier.' });
      return;
    }
    const emit = initSse(res);
    const directive = typeof req.body?.directive === 'string' ? req.body.directive.slice(0, 500) : undefined;
    const regenerateOnly = Boolean(req.body?.regenerateOnly);

    try {
      await runFullInvestigation(id, emit, { directive, regenerateOnly });
    } catch (err) {
      const { code, message } = toFriendlyError(err);
      emit({ type: 'error', code, message });
    } finally {
      if (!res.writableEnded) res.end();
    }
  });

  // POST /api/investigations/:id/message (SSE conversational follow-up)
  app.post('/api/investigations/:id/message', rateLimit(30), async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) {
      res.status(400).json({ error: 'Invalid investigation identifier.' });
      return;
    }
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const actionType = typeof req.body?.actionType === 'string' ? req.body.actionType.slice(0, 40) : undefined;
    if (message.length < 1 || message.length > 1500) {
      res.status(400).json({ error: 'Please enter a message between 1 and 1,500 characters.' });
      return;
    }

    const emit = initSse(res);
    try {
      await handleFollowUpMessage(id, message, emit, actionType);
    } catch (err) {
      const { code, message: friendlyMsg } = toFriendlyError(err);
      emit({ type: 'error', code, message: friendlyMsg });
    } finally {
      if (!res.writableEnded) res.end();
    }
  });

  // POST /api/investigations/:id/challenge (SSE human control: challenge a claim)
  app.post('/api/investigations/:id/challenge', rateLimit(20), async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) {
      res.status(400).json({ error: 'Invalid investigation identifier.' });
      return;
    }
    const claimId = typeof req.body?.claimId === 'string' ? req.body.claimId.trim() : '';
    const claimText = typeof req.body?.claimText === 'string' ? req.body.claimText.trim().slice(0, 400) : '';
    const prompt = claimText
      ? `Challenge this claim and actively search for opposing evidence, methodological caveats, or counter-studies: "${claimText}" (${claimId || 'selected claim'})`
      : 'Challenge the strongest claim in this investigation and find the best opposing evidence.';

    const emit = initSse(res);
    try {
      await handleFollowUpMessage(id, prompt, emit, 'challenge');
    } catch (err) {
      const { code, message } = toFriendlyError(err);
      emit({ type: 'error', code, message });
    } finally {
      if (!res.writableEnded) res.end();
    }
  });

  // POST /api/investigations/:id/deeper (SSE human control: investigate deeper on hypothesis/topic)
  app.post('/api/investigations/:id/deeper', rateLimit(20), async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) {
      res.status(400).json({ error: 'Invalid investigation identifier.' });
      return;
    }
    const target = typeof req.body?.target === 'string' ? req.body.target.trim().slice(0, 300) : '';
    const mode = typeof req.body?.mode === 'string' ? req.body.mode.trim() : 'deeper';
    const prompt =
      mode === 'primary'
        ? `Find primary sources, official datasets, or peer-reviewed studies specifically addressing: ${target || 'the core question'}.`
        : mode === 'opposing'
        ? `Find the strongest opposing evidence and counter-explanations challenging: ${target || 'the leading hypothesis'}.`
        : `Investigate deeper into "${target || 'the leading hypothesis'}" — examine underlying mechanisms, primary data, and unresolved edge cases.`;

    const emit = initSse(res);
    try {
      await handleFollowUpMessage(id, prompt, emit, mode);
    } catch (err) {
      const { code, message } = toFriendlyError(err);
      emit({ type: 'error', code, message });
    } finally {
      if (!res.writableEnded) res.end();
    }
  });

  // POST /api/investigations/:id/hypotheses (human control: add hypothesis)
  app.post('/api/investigations/:id/hypotheses', rateLimit(40), async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) {
      res.status(400).json({ error: 'Invalid investigation identifier.' });
      return;
    }
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const summary = typeof req.body?.summary === 'string' ? req.body.summary.trim() : '';
    if (title.length < 3 || title.length > 160) {
      res.status(400).json({ error: 'Hypothesis title must be between 3 and 160 characters.' });
      return;
    }
    const updated = await addCustomHypothesis(id, title, summary.slice(0, 500));
    if (!updated) {
      res.status(404).json({ error: 'Investigation not found.' });
      return;
    }
    res.status(201).json({ investigation: updated });
  });

  // DELETE /api/investigations/:id/hypotheses/:hypothesisId (human control: remove hypothesis)
  app.delete('/api/investigations/:id/hypotheses/:hypothesisId', rateLimit(40), async (req, res) => {
    const { id, hypothesisId } = req.params;
    if (!isValidId(id) || !isValidId(hypothesisId)) {
      res.status(400).json({ error: 'Invalid identifier.' });
      return;
    }
    const updated = await removeHypothesis(id, hypothesisId);
    if (!updated) {
      res.status(404).json({ error: 'Investigation not found.' });
      return;
    }
    res.json({ investigation: updated });
  });

  // GET /api/investigations/:id/graph
  app.get('/api/investigations/:id/graph', async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) {
      res.status(400).json({ error: 'Invalid investigation identifier.' });
      return;
    }
    const found = await investigationRepository.getById(id);
    if (!found) {
      res.status(404).json({ error: 'Investigation not found.' });
      return;
    }
    res.json({
      question: found.question,
      hypotheses: found.hypotheses,
      claims: found.claims,
      sources: found.sources,
      relationships: found.relationships,
    });
  });

  // GET /api/investigations/:id/sources
  app.get('/api/investigations/:id/sources', async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) {
      res.status(400).json({ error: 'Invalid investigation identifier.' });
      return;
    }
    const found = await investigationRepository.getById(id);
    if (!found) {
      res.status(404).json({ error: 'Investigation not found.' });
      return;
    }
    res.json({ sources: found.sources, searchMode: found.searchMode });
  });

  // GET /api/investigations/:id/claims
  app.get('/api/investigations/:id/claims', async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) {
      res.status(400).json({ error: 'Invalid investigation identifier.' });
      return;
    }
    const found = await investigationRepository.getById(id);
    if (!found) {
      res.status(404).json({ error: 'Investigation not found.' });
      return;
    }
    res.json({ claims: found.claims, contradictions: found.contradictions });
  });

  // Serve frontend (Vite middleware in dev, dist/ static files in production)
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  // Fallback JSON error handler (never leaks raw stack traces)
  app.use((_err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Something went wrong while processing your request.' });
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HYPOTHESIS server listening on http://localhost:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start HYPOTHESIS server:', err);
  process.exit(1);
});
