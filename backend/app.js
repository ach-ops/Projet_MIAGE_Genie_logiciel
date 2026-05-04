import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './config/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import transportRoutes from './routes/transport.routes.js';
import weatherRoutes from './routes/weather.routes.js';
import travauxRoutes from './routes/travaux.routes.js';
import itineraryRoutes from './routes/itinerary.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Réessayez dans une minute.' },
});

const itineraryLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Limite d\'itinéraires atteinte. Réessayez dans une minute.' },
});


export function createApp() {
  const app = express();

  const swaggerSpec = swaggerJsdoc({
    definition: {
      openapi: '3.0.0',
      info: { title: 'API STAN Nancy', version: '1.0.0' },
    },
    apis: [],
  });

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins, methods: ['GET', 'OPTIONS'] }));
  app.use(express.json({ limit: '50kb' }));
  app.use(globalLimiter);
  app.use(requestLogger);

  app.get('/health', (_req, res) =>
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  );

    // ─── Routes ─────────────────────────────────────────────────────────────────

  app.use('/api', transportRoutes);
  app.use('/api/weather', weatherRoutes);
  app.use('/api/travaux', travauxRoutes);
  app.use('/api/itinerary', itineraryLimiter, itineraryRoutes);
  app.use(errorHandler);

  return app;
}
