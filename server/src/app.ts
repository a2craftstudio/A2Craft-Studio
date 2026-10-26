import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import { razorpayConfigured, simulatorAllowed, type Config } from './config.js';
import type { Ctx } from './context.js';
import type { Db } from './db.js';
import { createLogger } from './log.js';
import { attachUser, requireAdmin } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { noStore, originCheck, requestId, requireJson } from './middleware/request.js';
import { adminRoutes } from './routes/admin.js';
import { authRoutes } from './routes/auth.js';
import { adminCatalogRoutes, catalogRoutes } from './routes/catalog.js';
import { engagementRoutes } from './routes/engagement.js';
import { adminEventRoutes, eventRoutes } from './routes/events.js';
import { adminOrderRoutes, orderRoutes } from './routes/orders.js';
import { paymentWebhookRoutes } from './routes/payments.js';
import { fileServingRoutes, uploadRoutes } from './routes/uploads.js';
import { ensureStorage } from './services/files.js';
import { createMailer, type Mailer } from './services/mail.js';

export interface AppOptions {
  /** An already opened AND migrated database (`openDb(config.database)` then `migrate(db)`). */
  db: Db;
  mail?: Mailer;
}

declare module 'express-serve-static-core' {
  interface Application {
    ctx: Ctx;
  }
}

/** Builds the Express app on an opened and migrated database. Tests pass a PGlite instance and a temp `uploadDir`. */
export function createApp(config: Config, opts: AppOptions): Express {
  const log = createLogger(config.logLevel);
  const db = opts.db;
  ensureStorage(config);
  const ctx: Ctx = { config, db, log, mail: opts.mail ?? createMailer(config, log) };

  const app = express();
  app.ctx = ctx;
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.set('etag', false);

  app.use(requestId);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
          scriptSrcAttr: ["'none'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          mediaSrc: ["'self'", 'blob:', 'https:'],
          connectSrc: ["'self'", 'https://api.razorpay.com', 'https://lumberjack.razorpay.com'],
          frameSrc: ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'", 'https://api.razorpay.com'],
          frameAncestors: ["'self'"],
          upgradeInsecureRequests: config.cookieSecure ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: config.cookieSecure ? undefined : false,
    }),
  );

  // The Razorpay webhook needs the RAW body for its HMAC, so it is mounted before the JSON parser.
  app.use('/api', paymentWebhookRoutes(ctx));

  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));

  // ---------------------------------------------------------------- API
  const api = express.Router();
  api.use(noStore);
  api.use(originCheck(config));
  api.use(requireJson);
  api.use(attachUser(ctx));

  api.get('/config', (_req, res) => {
    // Never silently fall back to a fake provider: without keys and without an allowed simulator we still say 'razorpay'
    // (and POST /api/orders answers 503 "Payments are not configured yet.").
    const configured = razorpayConfigured(config);
    res.json({
      paymentProvider: configured || !simulatorAllowed(config) ? 'razorpay' : 'simulator',
      ...(configured ? { razorpayKeyId: config.razorpay.keyId } : {}),
    });
  });

  api.use(authRoutes(ctx));
  api.use(catalogRoutes(ctx));
  api.use(uploadRoutes(ctx));
  api.use(orderRoutes(ctx));
  api.use(engagementRoutes(ctx));
  api.use(eventRoutes(ctx));

  // Everything under /api/admin sits behind ONE guard, so a route added later cannot forget it.
  const admin = express.Router();
  admin.use(requireAdmin);
  admin.use(adminCatalogRoutes(ctx));
  admin.use(adminOrderRoutes(ctx));
  admin.use(adminRoutes(ctx));
  admin.use(adminEventRoutes(ctx));
  api.use('/admin', admin);

  api.use((_req, res) => {
    res.status(404).json({ error: 'Not found.' });
  });
  app.use('/api', api);

  // ---------------------------------------------------------------- uploaded files
  app.use(fileServingRoutes(ctx));

  // ---------------------------------------------------------------- Angular build + SPA fallback
  if (config.clientDist && fs.existsSync(path.join(config.clientDist, 'index.html'))) {
    const dist = config.clientDist;
    const HASHED = /-[A-Za-z0-9_]{8,}\.(js|css|woff2?|png|jpe?g|webp|svg)$/;
    app.use(
      express.static(dist, {
        index: false,
        setHeaders: (res, file) => {
          const base = path.basename(file);
          if (base === 'index.html') res.setHeader('Cache-Control', 'no-cache');
          else if (HASHED.test(base)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          else res.setHeader('Cache-Control', 'public, max-age=3600');
        },
      }),
    );
    const sendIndex = (_req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(dist, 'index.html'));
    };
    app.get(/^\/(?!api(\/|$)|media(\/|$)|files(\/|$))[^.]*$/, sendIndex); // paths with a dot are real files, not routes
  }

  app.use((req: Request, res: Response, next: NextFunction) => notFoundHandler(req, res, next));
  app.use(errorHandler(ctx));
  return app;
}
