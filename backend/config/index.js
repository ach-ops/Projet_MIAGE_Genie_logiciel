export const config = {
  port: Number.parseInt(process.env.PORT, 10) || 3000,
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['http://localhost:5173', 'http://localhost:3000'],
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017',
  mongoDb:  process.env.MONGO_DB  || 'transport',
  realtimeUrl: process.env.REALTIME_URL || 'https://proxy.transport.data.gouv.fr/resource/stan-nancy-gtfs-rt',
  realtimeCacheDuration: Number.parseInt(process.env.REALTIME_CACHE_MS, 10) || 30_000,
  axiosTimeoutMs: Number.parseInt(process.env.AXIOS_TIMEOUT_MS, 10) || 10_000,
  maxArrivals: Number.parseInt(process.env.MAX_ARRIVALS, 10) || 8,
};
