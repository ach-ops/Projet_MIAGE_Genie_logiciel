// En dev : VITE_API_URL est vide → les appels restent sur '/api' → proxy Vite vers localhost:3000
// En production (Vercel) : VITE_API_URL=http://34.155.20.78:3000 → appels directs vers la VM GCP
export const API_BASE = import.meta.env.VITE_API_URL ?? ''
