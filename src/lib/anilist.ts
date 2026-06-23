// src/lib/anilist.ts

// ─── In-memory cache — keyed by "tmdbType:tmdbId" ───────────────────────────
const anilistIdCache = new Map<string, number>();

// ─────────────────────────────────────────────────────────────────────────────
// Strip common suffixes that break AniList title matching
// e.g. "Attack on Titan Season 4 Part 2 (2022)" → "Attack on Titan"
// ─────────────────────────────────────────────────────────────────────────────
function cleanTitle(title: string): string {
  return title
    .replace(/\s*\(\d{4}\)\s*$/, '')           // remove (2023)
    .replace(/\s*Season\s+\d+\s*$/i, '')        // remove Season 4
    .replace(/\s*:\s*Part\s+\d+\s*$/i, '')      // remove : Part 2
    .replace(/\s*Part\s+\d+\s*$/i, '')          // remove Part 2
    .replace(/\s*Cour\s+\d+\s*$/i, '')          // remove Cour 2
    .replace(/\s*[-–]\s*Season\s+\d+\s*$/i, '') // remove - Season 2
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Core AniList GraphQL search — returns ID only
// ─────────────────────────────────────────────────────────────────────────────
async function searchAniListByTitle(title: string): Promise<number | null> {
  if (!title?.trim()) return null;

  const query = `
    query ($search: String) {
      Media (search: $search, type: ANIME, sort: SEARCH_MATCH) {
        id
        title { romaji english native }
      }
    }
  `;

  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query, variables: { search: title } }),
    });

    if (!res.ok) return null;
    const result = await res.json();
    return result.data?.Media?.id ?? null;
  } catch (e) {
    console.warn('[AniList] Search failed for title:', title, e);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch original_name from TMDB (romaji/Japanese title — much better
// for AniList matching than the localized English title)
// ─────────────────────────────────────────────────────────────────────────────
async function getTmdbOriginalName(
  tmdbId: string | number,
  tmdbType: 'tv' | 'movie'
): Promise<string | null> {
  try {
    const { getActiveTmdbKey } = await import('./tmdb');
    const key = await getActiveTmdbKey();
    if (!key) return null;

    const res = await fetch(
      `https://api.themoviedb.org/3/${tmdbType}/${tmdbId}?api_key=${key}`
    );
    if (!res.ok) return null;

    const data = await res.json();
    // original_name for TV (e.g. "進撃の巨人"), original_title for movies
    return data.original_name || data.original_title || null;
  } catch (e) {
    console.warn('[AniList] TMDB original name fetch failed:', e);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIMARY export — resolves AniList ID from tmdbId + title
//
// Strategy (two attempts, cached after first success):
//   1. Search AniList with cleaned English title (fast, no extra API call)
//   2. If that fails → fetch original_name from TMDB (romaji/Japanese)
//      and search AniList with that (covers localized title mismatches)
// ─────────────────────────────────────────────────────────────────────────────
export async function resolveAniListId(
  tmdbId: string | number,
  title: string,
  tmdbType: 'tv' | 'movie' = 'tv'
): Promise<number | null> {
  const cacheKey = `${tmdbType}:${tmdbId}`;

  // Return cached result immediately — no API calls needed
  if (anilistIdCache.has(cacheKey)) {
    return anilistIdCache.get(cacheKey)!;
  }

  const cleaned = cleanTitle(title);

  // ── Attempt 1: cleaned English title ──────────────────────────────────────
  let id = await searchAniListByTitle(cleaned);
  if (id) {
    console.log(`[AniList] Resolved "${cleaned}" → ID ${id} (English title)`);
    anilistIdCache.set(cacheKey, id);
    return id;
  }

  // ── Attempt 2: TMDB original_name (romaji/Japanese) ───────────────────────
  const originalName = await getTmdbOriginalName(tmdbId, tmdbType);
  if (originalName && originalName !== title) {
    id = await searchAniListByTitle(originalName);
    if (id) {
      console.log(`[AniList] Resolved "${originalName}" → ID ${id} (original name)`);
      anilistIdCache.set(cacheKey, id);
      return id;
    }
  }

  console.warn(`[AniList] Could not resolve ID for: "${title}" (tmdbId: ${tmdbId})`);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy export — keeps ServerSelector + any other callers working unchanged.
// Accepts optional tmdbId for cache-backed resolution.
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchAniListMetadata(
  title: string,
  tmdbId?: string | number,
  tmdbType: 'tv' | 'movie' = 'tv'
) {
  const fullMetaQuery = (variables: { search?: string; id?: number }) => ({
    query: variables.id
      ? `query ($id: Int) {
          Media (id: $id, type: ANIME) {
            id
            title { romaji english native }
            description
            coverImage { large }
            bannerImage
            averageScore
            episodes
            status
          }
        }`
      : `query ($search: String) {
          Media (search: $search, type: ANIME, sort: SEARCH_MATCH) {
            id
            title { romaji english native }
            description
            coverImage { large }
            bannerImage
            averageScore
            episodes
            status
          }
        }`,
    variables,
  });

  try {
    // If tmdbId provided, use the reliable two-attempt bridge
    if (tmdbId) {
      const resolvedId = await resolveAniListId(tmdbId, title, tmdbType);
      if (resolvedId) {
        const res = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(fullMetaQuery({ id: resolvedId })),
        });
        if (res.ok) {
          const result = await res.json();
          if (result.data?.Media) return result.data.Media;
        }
      }
    }

    // Fallback: plain title search (original behaviour, always works)
    const cleaned = cleanTitle(title);
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(fullMetaQuery({ search: cleaned })),
    });
    const result = await res.json();
    return result.data?.Media || null;

  } catch (error) {
    console.error('[AniList] fetchAniListMetadata error:', error);
    return null;
  }
}