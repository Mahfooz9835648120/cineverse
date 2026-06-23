// api/providers.ts
// Server-side provider registry + URL resolver.
// Provider domains/templates live ONLY here — never shipped in the client bundle.
import type { VercelRequest, VercelResponse } from '@vercel/node';

type SearchType  = 'tmdb' | 'anilist';
type ContentType = 'movie' | 'tv' | 'anime';

interface AudioVariant { key: string; label: string; }

interface ProviderDef {
  id:             string;
  label:          string;
  searchType:     SearchType;
  contentTypes:   ContentType[];
  priority:       number;
  audioVariants?: AudioVariant[];
  movieUrl?:      (id: number | string, lang?: string) => string;
  tvUrl?:         (id: number | string, s: number, e: number, lang?: string) => string;
  animeUrl?:      (id: number | string, ep: number, lang?: string) => string;
}

const PROVIDER_DEFS: ProviderDef[] = [
  // ── Multi-audio ─────────────────────────────────────────────────────────────
  {
    id: 'videasy', label: 'Videasy',
    searchType: 'tmdb', contentTypes: ['movie', 'tv'], priority: 1,
    audioVariants: [
      { key: 'en', label: 'EN' }, { key: 'hi', label: 'HI' },
      { key: 'fr', label: 'FR' }, { key: 'es', label: 'ES' },
      { key: 'de', label: 'DE' }, { key: 'ja', label: 'JA' },
    ],
    movieUrl: (id, lang = 'en') =>
      `https://player.videasy.net/movie/${id}?color=6366f1&overlay=true&lang=${lang}`,
    tvUrl: (id, s, e, lang = 'en') =>
      `https://player.videasy.net/tv/${id}/${s}/${e}?color=6366f1&overlay=true&nextEpisode=true&autoplayNextEpisode=true&lang=${lang}`,
  },
  {
    id: 'vidzee-hq', label: 'VidZee HQ',
    searchType: 'tmdb', contentTypes: ['movie', 'tv', 'anime'], priority: 2,
    audioVariants: [
      { key: 'en', label: 'EN' }, { key: 'hi', label: 'HI' },
      { key: 'fr', label: 'FR' }, { key: 'es', label: 'ES' }, { key: 'ja', label: 'JA' },
    ],
    movieUrl: (id, lang = 'en') => `https://player.vidzee.wtf/v2/embed/movie/${id}?lang=${lang}`,
    tvUrl:    (id, s, e, lang = 'en') => `https://player.vidzee.wtf/v2/embed/tv/${id}/${s}/${e}?lang=${lang}`,
    animeUrl: (id, ep, lang = 'en') => `https://player.vidzee.wtf/v2/embed/tv/${id}/1/${ep}?lang=${lang}`,
  },
  {
    id: 'vidzee', label: 'VidZee',
    searchType: 'tmdb', contentTypes: ['movie', 'tv', 'anime'], priority: 3,
    audioVariants: [
      { key: 'en', label: 'EN' }, { key: 'hi', label: 'HI' },
      { key: 'fr', label: 'FR' }, { key: 'es', label: 'ES' },
    ],
    movieUrl: (id, lang = 'en') => `https://player.vidzee.wtf/embed/movie/${id}?lang=${lang}`,
    tvUrl:    (id, s, e, lang = 'en') => `https://player.vidzee.wtf/embed/tv/${id}/${s}/${e}?lang=${lang}`,
    animeUrl: (id, ep, lang = 'en') => `https://player.vidzee.wtf/embed/tv/${id}/1/${ep}?lang=${lang}`,
  },
  // ── General ─────────────────────────────────────────────────────────────────
  {
    id: 'vidup', label: 'VidUp',
    searchType: 'tmdb', contentTypes: ['movie', 'tv'], priority: 4,
    movieUrl: (id) => `https://vidup.to/movie/${id}?server=zenith`,
    tvUrl:    (id, s, e) => `https://vidup.to/tv/${id}/${s}/${e}?server=zenith`,
  },
  {
    id: 'vidcore', label: 'VidCore',
    searchType: 'tmdb', contentTypes: ['movie', 'tv'], priority: 5,
    movieUrl: (id) => `https://vidcore.net/movie/${id}?server=Crystal&autoPlay=true`,
    tvUrl:    (id, s, e) => `https://vidcore.net/tv/${id}/${s}/${e}?server=Crystal&autoPlay=true`,
  },
  {
    id: 'vidsrc-ru', label: 'VidSrc',
    searchType: 'tmdb', contentTypes: ['movie', 'tv'], priority: 6,
    movieUrl: (id) => `https://vidsrcme.ru/embed/movie/${id}`,
    tvUrl:    (id, s, e) => `https://vidsrcme.ru/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: 'vidsrc-xyz', label: 'VidSrc Pro',
    searchType: 'tmdb', contentTypes: ['movie', 'tv', 'anime'], priority: 7,
    movieUrl: (id) => `https://vidsrc.xyz/embed/movie?tmdb=${id}&ds_lang=hi`,
    tvUrl:    (id, s, e) => `https://vidsrc.xyz/embed/tv?tmdb=${id}&season=${s}&episode=${e}&ds_lang=hi`,
    animeUrl: (id, ep) => `https://vidsrc.xyz/embed/tv?tmdb=${id}&season=1&episode=${ep}&ds_lang=hi`,
  },
  {
    id: '1embed', label: '1Embed',
    searchType: 'tmdb', contentTypes: ['movie', 'tv', 'anime'], priority: 8,
    movieUrl: (id) => `https://1embed.cc/embed/movie/${id}`,
    tvUrl:    (id, s, e) => `https://1embed.cc/embed/tv/${id}/${s}/${e}`,
    animeUrl: (id, ep) => `https://1embed.cc/embed/tv/${id}/1/${ep}`,
  },
  {
    id: 'cinesrc', label: 'CineSrc',
    searchType: 'tmdb', contentTypes: ['movie', 'tv'], priority: 9,
    movieUrl: (id) => `https://cinesrc.st/embed/movie/${id}`,
    tvUrl:    (id, s, e) => `https://cinesrc.st/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: 'primesrc', label: 'PrimeSrc',
    searchType: 'tmdb', contentTypes: ['movie', 'tv'], priority: 10,
    movieUrl: (id) => `https://primesrc.me/embed/movie?tmdb=${id}`,
    tvUrl:    (id, s, e) =>
      `https://primesrc.me/embed/tv?tmdb=${id}&season=${s}&episode=${e}&fallback=false&serverOrder=PrimeVid,Voe,Dood`,
  },
  {
    id: 'cinemaos', label: 'CinemaOS',
    searchType: 'tmdb', contentTypes: ['movie', 'tv', 'anime'], priority: 11,
    movieUrl: (id) => `https://cinemaos.tech/player/${id}`,
    tvUrl:    (id, s, e) => `https://cinemaos.tech/player/${id}/${s}/${e}`,
    animeUrl: (id, ep) => `https://cinemaos.tech/player/${id}/1/${ep}`,
  },
  {
    id: '111movies', label: '111Movies',
    searchType: 'tmdb', contentTypes: ['movie', 'tv', 'anime'], priority: 12,
    movieUrl: (id) => `https://111movies.net/movie/${id}`,
    tvUrl:    (id, s, e) => `https://111movies.net/tv/${id}/${s}/${e}`,
    animeUrl: (id, ep) => `https://111movies.net/tv/${id}/1/${ep}`,
  },
  {
    id: 'nontongo', label: 'NontonGo',
    searchType: 'tmdb', contentTypes: ['movie'], priority: 13,
    movieUrl: (id) => `https://www.NontonGo.win/embed/movie/${id}`,
  },
  {
    id: 'vidnest-tv', label: 'VidNest',
    searchType: 'tmdb', contentTypes: ['tv'], priority: 14,
    tvUrl: (id, s, e) => `https://vidnest.fun/tv/${id}/${s}/${e}`,
  },
  // ── Anime-only (AniList routing) ────────────────────────────────────────────
  {
    id: 'megaplay-dub', label: 'MegaPlay Dub',
    searchType: 'anilist', contentTypes: ['anime'], priority: 1,
    animeUrl: (id, ep) => `https://megaplay.buzz/stream/ani/${id}/${ep}/dub`,
  },
  {
    id: 'megaplay-sub', label: 'MegaPlay Sub',
    searchType: 'anilist', contentTypes: ['anime'], priority: 2,
    animeUrl: (id, ep) => `https://megaplay.buzz/stream/ani/${id}/${ep}/sub`,
  },
  {
    id: 'vidnest-sub', label: 'VidNest Sub',
    searchType: 'anilist', contentTypes: ['anime'], priority: 3,
    animeUrl: (id, ep) => `https://vidnest.fun/anime/${id}/${ep}/sub`,
  },
  {
    id: 'vidnest-dub', label: 'VidNest Dub',
    searchType: 'anilist', contentTypes: ['anime'], priority: 4,
    animeUrl: (id, ep) => `https://vidnest.fun/anime/${id}/${ep}/dub`,
  },
  {
    id: 'vidnest-hindi', label: 'VidNest Hindi',
    searchType: 'anilist', contentTypes: ['anime'], priority: 5,
    animeUrl: (id, ep) => `https://vidnest.fun/anime/${id}/${ep}/hindi`,
  },
  {
    id: 'vidnest-pahe-sub', label: 'AnimePahe Sub',
    searchType: 'anilist', contentTypes: ['anime'], priority: 6,
    animeUrl: (id, ep) => `https://vidnest.fun/animepahe/${id}/${ep}/sub`,
  },
  {
    id: 'vidnest-pahe-dub', label: 'AnimePahe Dub',
    searchType: 'anilist', contentTypes: ['anime'], priority: 7,
    animeUrl: (id, ep) => `https://vidnest.fun/animepahe/${id}/${ep}/dub`,
  },
];

function getProviders(ct: ContentType): ProviderDef[] {
  return PROVIDER_DEFS.filter(p => p.contentTypes.includes(ct)).sort((a, b) => a.priority - b.priority);
}

function buildUrl(
  p: ProviderDef,
  tmdbId: number,
  anilistId: number | null,
  ct: ContentType,
  s: number,
  e: number,
  lang?: string,
): string {
  const id = p.searchType === 'anilist' ? (anilistId ?? tmdbId) : tmdbId;
  if (ct === 'movie' && p.movieUrl) return p.movieUrl(id, lang);
  if (ct === 'anime' && p.animeUrl) return p.animeUrl(id, e, lang);
  if (ct === 'tv'    && p.tvUrl)    return p.tvUrl(id, s, e, lang);
  if (p.tvUrl)    return p.tvUrl(id, s, e, lang);
  if (p.movieUrl) return p.movieUrl(id, lang);
  return '';
}

// Public-safe shape — only what the UI needs to render provider buttons.
function publicMeta(p: ProviderDef) {
  return { id: p.id, label: p.label, audioVariants: p.audioVariants };
}

const VALID_CT: ContentType[] = ['movie', 'tv', 'anime'];

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const {
    action, contentType, providerId,
    tmdbId, anilistId, season, episode, lang,
  } = req.query;

  const ct: ContentType = VALID_CT.includes(contentType as ContentType)
    ? (contentType as ContentType)
    : 'movie';

  // ── Resolve a single provider's embed URL on demand ──────────────────────
  if (action === 'resolve') {
    const provider = PROVIDER_DEFS.find(p => p.id === String(providerId || ''));
    if (!provider) return res.status(404).json({ error: 'Unknown provider' });

    const tmdbIdNum    = parseInt(String(tmdbId || '0'), 10);
    const anilistIdNum = anilistId ? parseInt(String(anilistId), 10) : null;
    const seasonNum     = parseInt(String(season  || '1'), 10);
    const episodeNum    = parseInt(String(episode || '1'), 10);
    const langStr       = lang ? String(lang) : 'en';

    const url = buildUrl(provider, tmdbIdNum, anilistIdNum, ct, seasonNum, episodeNum, langStr);
    if (!url) return res.status(400).json({ error: 'Could not resolve URL for this provider/content type' });

    // Don't let this get cached/shared across users via CDN — it's per-request.
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ url });
  }

  // ── Default: list available providers for a content type (no URLs) ──────
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  const list = getProviders(ct).map(publicMeta);
  return res.status(200).json({ providers: list });
}
