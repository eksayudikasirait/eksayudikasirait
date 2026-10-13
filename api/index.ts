import express from 'express';
import type { IncomingMessage, ServerResponse } from 'http';
import { attachBackendMiddlewares } from '../backendMiddlewares.ts';

const app = express();

// Normalisasi URL dari rewrite Vercel atau header forward
app.use((req, _res, next) => {
  const queryRoute = (req.query?.__route as string) || '';
  const matchedPath = (req.headers['x-matched-path'] as string) || '';

  if (queryRoute) {
    const route = queryRoute.startsWith('/') ? queryRoute : '/' + queryRoute;
    const rawUrl = req.url || '';
    try {
      const urlObj = new URL(rawUrl, 'http://localhost');
      urlObj.searchParams.delete('__route');
      const cleanSearch = urlObj.search;
      req.url = route + cleanSearch;
    } catch {
      req.url = route;
    }
  } else if (
    matchedPath &&
    (matchedPath.startsWith('/__api') ||
      matchedPath.startsWith('/api') ||
      matchedPath === '/healthz')
  ) {
    const rawUrl = req.url || '';
    const qIndex = rawUrl.indexOf('?');
    const query = qIndex !== -1 ? rawUrl.slice(qIndex) : '';
    req.url = matchedPath + query;
  }
  next();
});

// Endpoint status kesehatan (Health Check)
app.get('/healthz', (_req, res) => {
  res.status(200).send('OK');
});

// Adapter middleware untuk menghubungkan rute backend sistem ANBK
const middlewareAdapter = {
  use(
    routeOrHandler:
      | string
      | ((req: IncomingMessage, res: ServerResponse, next: () => void) => void),
    maybeHandler?: (req: IncomingMessage, res: ServerResponse, next: () => void) => void
  ) {
    if (typeof routeOrHandler === 'string' && maybeHandler) {
      app.use(routeOrHandler, (req, res, next) => {
        maybeHandler(req, res, next);
      });
    } else if (typeof routeOrHandler === 'function') {
      app.use((req, res, next) => {
        routeOrHandler(req, res, next);
      });
    }
    return app;
  },
};

attachBackendMiddlewares(middlewareAdapter);

// Handler Serverless untuk Vercel Function
export default function handler(req: any, res: any) {
  return app(req, res);
}
