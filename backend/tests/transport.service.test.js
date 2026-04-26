import { describe, it, expect, vi } from 'vitest';

const mockRes = () => {
  const res = {};
  res.json = vi.fn().mockReturnValue(res);
  res.status = vi.fn().mockReturnValue(res);
  return res;
};

vi.mock('../services/gtfs.service.js', () => ({
  getAllStops: vi.fn(() => [{ stop_id: '1', stop_name: 'Gare' }]),
  getRoutesByStop: vi.fn(() => [{ route_id: 'A' }]),
  getDirections: vi.fn(() => [{ direction_id: 0 }]),
  getStopName: vi.fn(() => 'Gare'),
  getTheoreticalArrivals: vi.fn(() => []),
  getDirectionName: vi.fn(() => 'Direction A'),
  getAllRoutes: vi.fn(() => [{ route_id: 'A', route_name: 'Ligne A' }]),
  getDirectionsForRoute: vi.fn(() => [{ directionId: '0', label: 'Direction A' }]),
}));

vi.mock('../services/realtime.service.js', () => ({
  getRealtimeArrivals: vi.fn(async () => [{ tripId: 'T1', delay: 120 }]),
}));

const {
  listStops, listRoutes, listDirections,
  listArrivals, listAllArrivals, listAllRoutes, listDirectionsForRoute,
} = await import('../services/transport.service.js');

describe('Transport service', () => {
  it('listStops retourne une liste de stops', () => {
    const req = {};
    const res = mockRes();
    listStops(req, res);
    expect(res.json).toHaveBeenCalledWith([{ stop_id: '1', stop_name: 'Gare' }]);
  });

  it("listRoutes retourne les routes d'un stop", () => {
    const req = { params: { stopId: '1' } };
    const res = mockRes();
    listRoutes(req, res);
    expect(res.json).toHaveBeenCalledWith([{ route_id: 'A' }]);
  });

  it("listDirections retourne les directions d'un stop", () => {
    const req = { params: { stopId: '1', routeId: 'A' } };
    const res = mockRes();
    listDirections(req, res);
    expect(res.json).toHaveBeenCalledWith([{ direction_id: 0 }]);
  });

  it('listAllRoutes retourne toutes les routes', () => {
    const req = {};
    const res = mockRes();
    listAllRoutes(req, res);
    expect(res.json).toHaveBeenCalledWith([{ route_id: 'A', route_name: 'Ligne A' }]);
  });

  it("listDirectionsForRoute retourne les directions d'une route", () => {
    const req = { params: { routeId: 'A' } };
    const res = mockRes();
    listDirectionsForRoute(req, res);
    expect(res.json).toHaveBeenCalledWith([{ directionId: '0', label: 'Direction A' }]);
  });

  it('listArrivals retourne stopName, direction et arrivées', async () => {
    const req = { params: { stopId: '1', routeId: 'A', directionId: '0' } };
    const res = mockRes();
    await listArrivals(req, res);
    expect(res.json).toHaveBeenCalledWith({
      stopName: 'Gare',
      direction: null,
      arrivals: [{ tripId: 'T1', delay: 120 }],
    });
  });

  it("listArrivals renvoie 500 en cas d'erreur", async () => {
    const { getRealtimeArrivals } = await import('../services/realtime.service.js');
    getRealtimeArrivals.mockRejectedValueOnce(new Error('API error'));
    const req = { params: { stopId: '1', routeId: 'A', directionId: '0' } };
    const res = mockRes();
    await listArrivals(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Erreur temps réel' });
  });

  it('listAllArrivals retourne les arrivées combinées', async () => {
    const req = { params: { stopId: '1', routeId: 'A', directionId: '0' } };
    const res = mockRes();
    await listAllArrivals(req, res);
    expect(res.json).toHaveBeenCalledWith({
      stopName: 'Gare',
      directionName: 'Direction A',
      realtime: [{ tripId: 'T1', delay: 120 }],
      theoretical: [],
    });
  });

  it("listAllArrivals renvoie 500 en cas d'erreur", async () => {
    const { getRealtimeArrivals } = await import('../services/realtime.service.js');
    getRealtimeArrivals.mockRejectedValueOnce(new Error('API error'));
    const req = { params: { stopId: '1', routeId: 'A', directionId: '0' } };
    const res = mockRes();
    await listAllArrivals(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Erreur lors de la récupération des arrivées" });
  });
});
