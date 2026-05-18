/**
 * Tests unitaires du middleware errorHandler et du wrapper asyncHandler.
 *
 * On instancie des objets req/res/next factices pour tester les deux fonctions
 * indépendamment d'Express.
 *
 * errorHandler :
 * - utilise err.status / err.statusCode (par défaut 500)
 * - retourne { error: message } en JSON
 * - inclut stack uniquement en mode development
 * - logue l'erreur via logger.error
 *
 * asyncHandler :
 * - passe la requête au handler async
 * - appelle next(err) si le handler rejette
 * - ne double-wrap pas les erreurs
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

import { errorHandler, asyncHandler } from '../../middleware/errorHandler.js';
import { logger } from '../../utils/logger.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(overrides = {}) {
  return {
    method: 'GET',
    path: '/api/test',
    body: {},
    params: {},
    query: {},
    ...overrides,
  };
}

function makeRes() {
  const res = {
    statusCode: null,
    body: null,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
}

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  vi.clearAllMocks();
});

// ─── errorHandler ─────────────────────────────────────────────────────────────

describe('errorHandler', () => {
  it('répond 500 par défaut quand err n\'a pas de status', () => {
    const err = new Error('Problème interne');
    const req = makeReq();
    const res = makeRes();

    errorHandler(err, req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Problème interne' }));
  });

  it('utilise err.status si présent', () => {
    const err = Object.assign(new Error('Non trouvé'), { status: 404 });
    const res = makeRes();

    errorHandler(err, makeReq(), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('utilise err.statusCode si err.status est absent', () => {
    const err = Object.assign(new Error('Interdit'), { statusCode: 403 });
    const res = makeRes();

    errorHandler(err, makeReq(), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('utilise le message "Erreur interne du serveur" si err.message est vide', () => {
    const err = {};
    const res = makeRes();

    errorHandler(err, makeReq(), res, vi.fn());

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Erreur interne du serveur' })
    );
  });

  it('n\'inclut PAS stack en mode production', () => {
    process.env.NODE_ENV = 'production';
    const err = new Error('Crash');
    const res = makeRes();

    errorHandler(err, makeReq(), res, vi.fn());

    const body = res.json.mock.calls[0][0];
    expect(body.stack).toBeUndefined();
  });

  it('inclut stack en mode development', () => {
    process.env.NODE_ENV = 'development';
    const err = new Error('Crash dev');
    const res = makeRes();

    errorHandler(err, makeReq(), res, vi.fn());

    const body = res.json.mock.calls[0][0];
    expect(body.stack).toBeDefined();
    expect(typeof body.stack).toBe('string');
  });

  it('appelle logger.error avec la méthode, le path et le statut', () => {
    const err = Object.assign(new Error('Oops'), { status: 422 });
    const req = makeReq({ method: 'POST', path: '/api/stops' });
    const res = makeRes();

    errorHandler(err, req, res, vi.fn());

    expect(logger.error).toHaveBeenCalledOnce();
    const [message] = logger.error.mock.calls[0];
    expect(message).toContain('POST');
    expect(message).toContain('/api/stops');
    expect(message).toContain('422');
  });
});

// ─── asyncHandler ─────────────────────────────────────────────────────────────

describe('asyncHandler', () => {
  it('appelle le handler avec (req, res, next)', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = asyncHandler(handler);
    const req = makeReq();
    const res = makeRes();
    const next = vi.fn();

    await wrapped(req, res, next);

    expect(handler).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('appelle next(err) si le handler async rejette', async () => {
    const boom = new Error('Async crash');
    const handler = vi.fn().mockRejectedValue(boom);
    const wrapped = asyncHandler(handler);
    const next = vi.fn();

    await wrapped(makeReq(), makeRes(), next);

    expect(next).toHaveBeenCalledWith(boom);
  });

  it('ne swallow pas l\'erreur — next reçoit exactement l\'erreur lancée', async () => {
    const boom = Object.assign(new Error('Précis'), { status: 409 });
    const handler = vi.fn().mockRejectedValue(boom);
    const wrapped = asyncHandler(handler);
    const next = vi.fn();

    await wrapped(makeReq(), makeRes(), next);

    expect(next.mock.calls[0][0]).toBe(boom);
  });

  it('fonctionne avec un handler synchrone qui retourne une valeur', async () => {
    const handler = vi.fn().mockReturnValue('ok');
    const wrapped = asyncHandler(handler);
    const next = vi.fn();

    await wrapped(makeReq(), makeRes(), next);

    expect(next).not.toHaveBeenCalled();
  });
});
