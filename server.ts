import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http, { type IncomingMessage, type ServerResponse } from 'http';
import { attachBackendMiddlewares } from './backendMiddlewares.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const port = Number(process.env.PORT) || 3000;

  // Health check endpoint for Cloud Run readiness/liveness probes
  app.get('/healthz', (_req, res) => {
    res.status(200).send('OK');
  });

  // Attach backend API middlewares (/__api/*)
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

  const distPath = path.resolve(__dirname, 'dist');
  const distIndexFile = path.resolve(distPath, 'index.html');
  const isCloudRunProduction =
    process.env.NODE_ENV === 'production' && Boolean(process.env.K_SERVICE);

  if (!isCloudRunProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          server,
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const publicPath = path.resolve(__dirname, 'public');

    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath, { index: false }));
    }
    if (fs.existsSync(publicPath)) {
      app.use(express.static(publicPath, { index: false }));
    }

    // SPA fallback to dist/index.html
    app.get('*', (_req, res) => {
      if (fs.existsSync(distIndexFile)) {
        res.sendFile(distIndexFile);
      } else {
        res.status(200).send('Server is running.');
      }
    });
  }

  server.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
