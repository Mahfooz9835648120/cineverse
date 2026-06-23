// src/lib/tmdb.ts

const BASE_URL = '/api/tmdb'; // proxied through Vercel — avoids ISP blocks

interface CacheEntry {
  data: any;
  timestamp: number;
}

class TmdbClient {
  private cache: Map<string, CacheEntry> = new Map();
  private requestQueue: Array<{
    url: string;
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
  }> = [];
  private isProcessing = false;
  private lastRequestTime = 0;
  private MIN_DELAY = 350;
  private CACHE_EXPIRY = 48 * 60 * 60 * 1000; // 48 hours

  constructor() {
    this.loadCache();
  }

  public async getActiveApiKey(): Promise<string> {
    // Key is now server-side only — return a placeholder so callers don't break
    return 'proxied';
  }

  public resetApiKeyCache() {
    // no-op
  }

  private loadCache() {
    try {
      const saved = localStorage.getItem('tmdb_cache');
      if (saved) {
        const parsed = JSON.parse(saved);
        const now = Date.now();
        Object.keys(parsed).forEach(key => {
          if (now - parsed[key].timestamp < this.CACHE_EXPIRY) {
            this.cache.set(key, parsed[key]);
          }
        });
      }
    } catch (e) {
      console.error('Failed to load TMDB cache', e);
    }
  }

  private saveCache() {
    try {
      const obj: Record<string, CacheEntry> = {};
      this.cache.forEach((val, key) => { obj[key] = val; });
      localStorage.setItem('tmdb_cache', JSON.stringify(obj));
    } catch (e) {
      console.warn('Failed to save TMDB cache', e);
    }
  }

  private async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) return;
    this.isProcessing = true;

    while (this.requestQueue.length > 0) {
      const now = Date.now();
      const timeSinceLast = now - this.lastRequestTime;
      if (timeSinceLast < this.MIN_DELAY) {
        await new Promise(r => setTimeout(r, this.MIN_DELAY - timeSinceLast));
      }

      const request = this.requestQueue.shift();
      if (request) {
        try {
          const data = await this.performFetch(request.url);
          this.lastRequestTime = Date.now();
          request.resolve(data);
        } catch (error) {
          this.lastRequestTime = Date.now();
          request.reject(error);
        }
      }
    }

    this.isProcessing = false;
  }

  private async performFetch(url: string, retries = 2): Promise<any> {
    let response: Response;
    try {
      response = await fetch(url);
    } catch (networkErr) {
      throw networkErr;
    }

    if (response.status === 401 || response.status === 403) {
      const e: any = new Error(`TMDB_AUTH_ERROR:${response.status}`);
      e.status = response.status;
      throw e;
    }

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '5');
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      return this.performFetch(url, retries);
    }

    if (!response.ok) {
      if (retries > 0) {
        const delay = (3 - retries) * 2000;
        await new Promise(r => setTimeout(r, delay));
        return this.performFetch(url, retries - 1);
      }
      throw new Error(`TMDB API Error: ${response.status}`);
    }

    const data = await response.json();
    if (data && data.success !== false) {
      this.cache.set(url, { data, timestamp: Date.now() });
      this.saveCache();
    }
    return data;
  }

  public async fetch(endpoint: string, params: Record<string, string | number> = {}): Promise<any> {
    // Build proxy URL: /api/tmdb/trending/movie/day?page=1&...
    const queryParams = new URLSearchParams(
      Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
    );

    const url = `${BASE_URL}${endpoint}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

    const cached = this.cache.get(url);
    if (cached && (Date.now() - cached.timestamp < this.CACHE_EXPIRY)) {
      return cached.data;
    }

    return new Promise((resolve, reject) => {
      this.requestQueue.push({ url, resolve, reject });
      this.processQueue();
    });
  }
}

const client = new TmdbClient();

export const refreshTmdbKey = () => client.resetApiKeyCache();
export const getActiveTmdbKey = () => client.getActiveApiKey();

export type PingResult = 'ok' | 'network_error' | 'auth_error' | 'no_key';

export async function pingTmdb(timeoutMs = 10_000): Promise<PingResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('/api/tmdb/configuration', { signal: controller.signal });
    clearTimeout(timer);
    if (res.status === 401 || res.status === 403) return 'auth_error';
    if (res.ok) return 'ok';
    return 'network_error';
  } catch (err: any) {
    clearTimeout(timer);
    const msg = (err?.message || '').toLowerCase();
    if (err?.name === 'AbortError' || msg.includes('abort')) return 'network_error';
    if (err instanceof TypeError || msg.includes('failed to fetch')) return 'network_error';
    return 'network_error';
  }
}

export const classifyTmdbError = (err: any): 'auth_error' | 'network_error' | 'none' => {
  if (!err) return 'none';
  const msg = (err?.message || '').toLowerCase();
  const status = err?.status ?? err?.statusCode ?? err?.response?.status;

  if (
    status === 401 || status === 403 ||
    msg.includes('tmdb_auth_error') || msg.includes('tmdb_key_unavailable') ||
    msg.includes('api key') || msg.includes('unauthorized')
  ) return 'auth_error';

  if (
    err instanceof TypeError || msg.includes('failed to fetch') ||
    msg.includes('networkerror') || msg.includes('timeout') || msg.includes('aborted')
  ) return 'network_error';

  return 'network_error';
};

export const tmdb = {
  getTrending: (type: 'movie' | 'tv' = 'movie') =>
    client.fetch(`/trending/${type}/day`),

  getByGenre: (type: 'movie' | 'tv', genreId: number, page = 1) =>
    client.fetch(`/discover/${type}`, { with_genres: genreId, page, sort_by: 'popularity.desc' }),

  search: (query: string, page = 1) =>
    client.fetch('/search/multi', { query, page }),

  searchMovies: (query: string, page = 1) =>
    client.fetch('/search/movie', { query, page }),

  searchTV: (query: string, page = 1) =>
    client.fetch('/search/tv', { query, page }),

  getDetails: (type: 'movie' | 'tv', id: string | number) =>
    client.fetch(`/${type}/${id}`, { append_to_response: 'videos,credits,recommendations,external_ids' }),

  getPopular: (type: 'movie' | 'tv' = 'movie', page = 1) =>
    client.fetch(`/${type}/popular`, { page }),

  getTopRated: (type: 'movie' | 'tv' = 'movie', page = 1) =>
    client.fetch(`/${type}/top_rated`, { page }),

  getUpcoming: (page = 1) =>
    client.fetch('/movie/upcoming', { page }),

  getAnimeSeries: (page = 1, genreId?: number | null) => {
    const params: any = { with_genres: '16', with_original_language: 'ja', page, sort_by: 'popularity.desc' };
    if (genreId) params.with_genres = `16,${genreId}`;
    return client.fetch('/discover/tv', params);
  },

  getAnimeMovies: (page = 1, genreId?: number | null) => {
    const params: any = { with_genres: '16', with_original_language: 'ja', page, sort_by: 'popularity.desc' };
    if (genreId) params.with_genres = `16,${genreId}`;
    return client.fetch('/discover/movie', params);
  },

  getTrendingAnime: (page = 1) =>
    client.fetch('/discover/tv', { with_genres: '16', with_original_language: 'ja', page, sort_by: 'popularity.desc' }),

  getTopRatedAnime: (page = 1) =>
    client.fetch('/discover/tv', { with_genres: '16', with_original_language: 'ja', page, sort_by: 'vote_average.desc', 'vote_count.gte': 100 }),

  getTrailer: async (type: 'movie' | 'tv', id: string | number) => {
    const data = await client.fetch(`/${type}/${id}/videos`);
    const trailer = data.results?.find(
      (vid: any) => vid.type === 'Trailer' && vid.site === 'YouTube'
    );
    return trailer ? `https://www.youtube.com/embed/${trailer.key}?autoplay=1&modestbranding=1` : null;
  },

  getSeasonEpisodes: (tvId: string | number, seasonNumber: number) =>
    client.fetch(`/tv/${tvId}/season/${seasonNumber}`),
};

export const getTMDBImage = (
  path: string | null | undefined,
  size: 'poster' | 'backdrop' | 'w500' | 'w185' | 'w92' | 'original' = 'w500'
) => {
  if (!path) return '';
  const sizes = { poster: 'w500', backdrop: 'original', w500: 'w500', w185: 'w185', w92: 'w92', original: 'original' };
  return `https://image.tmdb.org/t/p/${sizes[size] || 'w500'}${path}`;
};