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

/** Limite globale : 200 req/min par IP */
const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Réessayez dans une minute.' },
});

/** Limite stricte sur le calcul d'itinéraire */
const itineraryLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Limite d\'itinéraires atteinte. Réessayez dans une minute.' },
});

/**
 * Crée et configure l'application Express sans la démarrer.
 */
export function createApp() {
  const app = express();

  // ─── Swagger (monté AVANT helmet afin d'éviter les problèmes de navigateur) ────────────────────────────────────

  const swaggerSpec = swaggerJsdoc({
    definition: {
      openapi: '3.0.0',
      info: { title: 'API STAN Nancy', version: '1.0.0', description: 'API horaires bus Nancy' },
      components: {
        schemas: {
          Stop: {
            type: 'object',
            properties: {
              stop_id:   { type: 'string', example: 'NANCY_001' },
              stop_name: { type: 'string', example: 'Stanislas' },
              stop_lat:  { type: 'string', example: '48.6936' },
              stop_lon:  { type: 'string', example: '6.1846' },
            },
          },
          Route: {
            type: 'object',
            properties: {
              route_id:         { type: 'string', example: 'STAN_1' },
              route_short_name: { type: 'string', example: '1' },
              route_color:      { type: 'string', example: 'E2001A' },
            },
          },
          Direction: {
            type: 'object',
            properties: {
              directionId: { type: 'string', example: '0' },
              label:       { type: 'string', example: 'Terminus Laxou Provinces' },
            },
          },
          Arrival: {
            type: 'object',
            properties: {
              arrivalInMin: { type: 'number', example: 5 },
              arrivalTime:  { type: 'string', example: '14:32:00' },
              source: {
                type: 'string',
                enum: ['realtime', 'realtime_estimated', 'theoretical'],
                example: 'realtime',
              },
            },
          },
          AllArrivals: {
            type: 'object',
            properties: {
              stopId:         { type: 'string' },
              stopName:       { type: 'string' },
              routeId:        { type: 'string' },
              directionId:    { type: 'string' },
              directionName:  { type: 'string' },
              realtime:       { type: 'array', items: { $ref: '#/components/schemas/Arrival' } },
              theoretical:    { type: 'array', items: { $ref: '#/components/schemas/Arrival' } },
              realtimeStatus: { type: 'string', enum: ['ok', 'empty', 'error'] },
              realtimeError:  { type: 'string', nullable: true },
              useTheoretical: { type: 'boolean' },
            },
          },
          ArrivalsFallback: {
            type: 'object',
            properties: {
              stopName:  { type: 'string' },
              direction: { type: 'string' },
              arrivals:  { type: 'array', items: { $ref: '#/components/schemas/Arrival' } },
              source: {
                type: 'string',
                enum: ['realtime', 'theoretical_fallback'],
                example: 'realtime',
              },
              realtimeError: { type: 'string', nullable: true },
            },
          },
          VelibStation: {
            type: 'object',
            properties: {
              stationId:      { type: 'string' },
              name:           { type: 'string', example: 'Stanislas - Opéra' },
              address:        { type: 'string' },
              lat:            { type: 'number', example: 48.6936 },
              lon:            { type: 'number', example: 6.1846 },
              bikesAvailable: { type: 'integer', example: 4 },
              docksAvailable: { type: 'integer', example: 11 },
            },
          },
          ShapePoint: {
            type: 'array',
            items: { type: 'number' },
            minItems: 2,
            maxItems: 2,
            example: [48.6936, 6.1846],
          },
          RouteStop: {
            type: 'object',
            properties: {
              stopId:   { type: 'string' },
              stopName: { type: 'string' },
              sequence: { type: 'integer' },
            },
          },
          DelayByRoute: {
            type: 'object',
            properties: {
              routeId:         { type: 'string', example: 'STAN_1' },
              routeName:       { type: 'string', example: '1' },
              color:           { type: 'string', example: '#E2001A' },
              averageDelayMin: { type: 'number', example: 2.5 },
            },
          },
          Suggestion: {
            type: 'object',
            properties: {
              label:       { type: 'string', example: '1 Place Stanislas, Nancy' },
              displayName: { type: 'string' },
              lat:         { type: 'number', example: 48.6936 },
              lon:         { type: 'number', example: 6.1846 },
            },
          },
          WalkingOnly: {
            type: 'object',
            properties: {
              type:        { type: 'string', enum: ['walking'] },
              distanceKm:  { type: 'number', example: 1.3 },
              durationMin: { type: 'integer', example: 16 },
            },
          },
          ItineraryOption: {
            type: 'object',
            properties: {
              totalDurationMin: { type: 'integer', example: 14 },
              legs: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type:        { type: 'string', enum: ['walk', 'bus'] },
                    distanceKm:  { type: 'number' },
                    durationMin: { type: 'integer' },
                    stopCount:   { type: 'integer' },
                    route: {
                      type: 'object',
                      properties: {
                        routeId:        { type: 'string' },
                        routeShortName: { type: 'string' },
                        color:          { type: 'string' },
                        direction:      { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          Error: {
            type: 'object',
            properties: {
              error: { type: 'string', example: 'Paramètre invalide.' },
            },
          },
        },
        responses: {
          BadRequest: {
            description: 'Paramètre invalide ou manquant',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          NotFound: {
            description: 'Ressource introuvable',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          InternalError: {
            description: 'Erreur serveur interne',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    apis: [
      path.join(__dirname, 'routes', 'transport.routes.js'),
      path.join(__dirname, 'routes', 'travaux.routes.js'),
      path.join(__dirname, 'routes', 'weather.routes.js'),
      path.join(__dirname, 'routes', 'itinerary.routes.js'),
    ],
  });

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // ─── Sécurité ───────────────────────────────────────────────────────────────
  app.use(helmet());

  // CORS restreint aux origines autorisées
  app.use(cors({
    origin: config.corsOrigins,
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  }));

  // Limite la taille du body JSON
  app.use(express.json({ limit: '50kb' }));

  app.use(globalLimiter);

  // ─── Logging ────────────────────────────────────────────────────────────────

  app.use(requestLogger);

  // ─── Routes ─────────────────────────────────────────────────────────────────

  app.use('/api', transportRoutes);
  app.use('/api/travaux', travauxRoutes);
  app.use('/api/weather', weatherRoutes);
  // On met la limite de requete d'itinéraire 
  app.use('/api/itinerary', itineraryLimiter, itineraryRoutes);

  // ─── Healthcheck ────────────────────────────────────────────────────────────

  app.get('/health', (_req, res) =>
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  );

  // ─── Erreurs centralisées ───────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
  
}
