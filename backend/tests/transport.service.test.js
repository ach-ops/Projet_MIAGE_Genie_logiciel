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
}));

vi.mock('../services/realtime.service.js', () => ({
  getRealtimeArrivals: vi.fn(async () => []),
}));

const { listStops, listRoutes, listDirections } = await import('../services/transport.service.js');

describe('Transport service', () => {
  it('listStops retourne une liste de stops', () => {
    const req = {};
    const res = mockRes();
    listStops(req, res);
    expect(res.json).toHaveBeenCalledWith([{ stop_id: '1', stop_name: 'Gare' }]);
  });

  it('listRoutes retourne les routes d\'un stop', () => {
    const req = { params: { stopId: '1' } };
    const res = mockRes();
    listRoutes(req, res);
    expect(res.json).toHaveBeenCalledWith([{ route_id: 'A' }]);
  });

  it('listDirections retourne les directions d\'un stop', () => {
    const req = { params: { stopId: '1', routeId: 'A' } };
    const res = mockRes();
    listDirections(req, res);
    expect(res.json).toHaveBeenCalledWith([{ direction_id: 0 }]);
  });

});
