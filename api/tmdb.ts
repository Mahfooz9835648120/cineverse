// api/tmdb/[...path].ts  ← place this at project root: /api/tmdb/[...path].ts

import type { VercelRequest, VercelResponse } from '@vercel/node';

const TMDB_BASE = 'https://api.themoviedb.org/3';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // path is the catch-all: e.g. ['trending', 'movie', 'day']
  const pathSegments = req.query.path;
  if (!pathSegments) return res.status(400).json({ error: 'Missing path' });

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  // Rebuild query params, injecting the server-side API key
  const { path: _, ...rest } = req.query;
  const params = new URLSearchParams({ api_key: apiKey });
  Object.entries(rest).forEach(([k, v]) => {
    if (v) params.set(k, String(v));
  });

  const tmdbPath = Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments;
  const tmdbUrl = `${TMDB_BASE}/${tmdbPath}?${params.toString()}`;

  try {
    const upstream = await fetch(tmdbUrl, {
      headers: { 'Accept': 'application/json' },
    });

    const data = await upstream.json();

    // Cache at Vercel edge: 1h fresh, 24h stale-while-revalidate
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Proxy fetch failed' });
  }
}