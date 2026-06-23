// api/tmdb.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

const TMDB_BASE = 'https://api.themoviedb.org/3';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const apiKey = process.env.TMDB_API_KEY?.trim();
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  // Extract the TMDB path from the URL
  // e.g. /api/tmdb/trending/movie/day → /trending/movie/day
  const fullPath = req.url || '';
  const tmdbPath = fullPath.replace(/^\/api\/tmdb/, '').split('?')[0];

  if (!tmdbPath) return res.status(400).json({ error: 'Missing path' });

  // Forward all query params + inject api_key
  const { ...rest } = req.query;
  const params = new URLSearchParams({ api_key: apiKey });
  Object.entries(rest).forEach(([k, v]) => {
    if (v) params.set(k, String(v));
  });

  const tmdbUrl = `${TMDB_BASE}${tmdbPath}?${params.toString()}`;

  try {
    const upstream = await fetch(tmdbUrl, {
      headers: { Accept: 'application/json' },
    });

    const data = await upstream.json();

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Proxy fetch failed' });
  }
}
