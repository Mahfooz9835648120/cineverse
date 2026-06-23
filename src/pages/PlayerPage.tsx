// src/pages/PlayerPage.tsx
// Cineverse — Player Page
// Route: /player/:type/:tmdbId   (type = 'movie' | 'show' | 'anime')

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ChevronDown, ChevronLeft, ChevronRight,
  Film, Tv, Star, Calendar, RefreshCw,
  SkipForward, Languages, ChevronUp,
} from 'lucide-react';

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  bg:        '#0F1115',
  surface:   '#181C22',
  elevated:  '#20252D',
  text:      '#F8F9FB',
  textSub:   '#A0A7B4',
  border:    'rgba(248,249,251,0.08)',
  borderHov: 'rgba(248,249,251,0.15)',
} as const;

// ─── TYPES ────────────────────────────────────────────────────────────────────
export interface CineItem {
  type:           'movie' | 'show' | 'anime';
  title:          string;
  year:           number;
  overview:       string;
  rating:         number;
  genres:         string[];
  tmdb_id:        number;
  imdb_id:        string;
  poster:         string;
  backdrop:       string;
  isAnime?:       boolean;
  anilistId?:     number;
  totalEpisodes?: number;
}

// ─── CONTINUE WATCHING ────────────────────────────────────────────────────────
export interface ContinueWatchingEntry {
  item:      CineItem;
  season:    number;
  episode:   number;
  updatedAt: number; // timestamp
}

const CW_KEY = 'sv_continue_watching';
const CW_MAX = 20;

export function getContinueWatching(): ContinueWatchingEntry[] {
  try {
    return JSON.parse(localStorage.getItem(CW_KEY) || '[]');
  } catch { return []; }
}

export function saveContinueWatching(entry: ContinueWatchingEntry) {
  try {
    const list = getContinueWatching().filter(
      e => !(e.item.tmdb_id === entry.item.tmdb_id && e.item.type === entry.item.type)
    );
    list.unshift(entry);
    localStorage.setItem(CW_KEY, JSON.stringify(list.slice(0, CW_MAX)));
  } catch {}
}

// ─── SERVER PREFERENCE CACHE ──────────────────────────────────────────────────
// Per-show: sv_server_show_{tmdbId}  → providerId
// Per-type fallback: sv_server_{movie|tv|anime} → providerId
function getServerPref(tmdbId: number, contentType: string): string | null {
  return (
    localStorage.getItem(`sv_server_show_${tmdbId}`) ||
    localStorage.getItem(`sv_server_${contentType}`) ||
    null
  );
}

function saveServerPref(tmdbId: number, contentType: string, providerId: string) {
  localStorage.setItem(`sv_server_show_${tmdbId}`, providerId);
  localStorage.setItem(`sv_server_${contentType}`, providerId);
}

// ─── AUDIO VARIANT ────────────────────────────────────────────────────────────
interface AudioVariant { key: string; label: string; }

// ─── PROVIDER DEFINITIONS ─────────────────────────────────────────────────────
type SearchType  = 'tmdb' | 'anilist';
type ContentType = 'movie' | 'tv' | 'anime';

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

// ─── TMDB API ─────────────────────────────────────────────────────────────────
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG  = 'https://image.tmdb.org/t/p';
const TMDB_KEY  = import.meta.env.VITE_TMDB_API_KEY as string;

interface TMDBDetails {
  id:                  number;
  title?:              string;
  name?:               string;
  overview:            string;
  poster_path:         string | null;
  backdrop_path:       string | null;
  vote_average:        number;
  release_date?:       string;
  first_air_date?:     string;
  genres:              { id: number; name: string }[];
  origin_country?:     string[];
  original_language?:  string;
  number_of_episodes?: number;
  seasons?:            any[];
}

interface TMDBSeason  { season_number: number; name: string; episode_count: number; }
interface TMDBEpisode { episode_number: number; name: string; overview: string; runtime: number | null; air_date: string | null; }

async function fetchTMDBDetails(tmdbId: number, type: 'movie' | 'show'): Promise<TMDBDetails | null> {
  try {
    const res = await fetch(`${TMDB_BASE}/${type === 'movie' ? 'movie' : 'tv'}/${tmdbId}?api_key=${TMDB_KEY}&language=en-US`);
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

async function fetchTMDBSeasons(tmdbId: number): Promise<TMDBSeason[]> {
  try {
    const res = await fetch(`${TMDB_BASE}/tv/${tmdbId}?api_key=${TMDB_KEY}&language=en-US`);
    if (!res.ok) return [];
    const d = await res.json();
    return (d.seasons || []).filter((s: any) => s.season_number > 0);
  } catch { return []; }
}

async function fetchTMDBEpisodes(tmdbId: number, season: number): Promise<TMDBEpisode[]> {
  try {
    const res = await fetch(`${TMDB_BASE}/tv/${tmdbId}/season/${season}?api_key=${TMDB_KEY}&language=en-US`);
    if (!res.ok) return [];
    return (await res.json()).episodes || [];
  } catch { return []; }
}

// ─── ANILIST ──────────────────────────────────────────────────────────────────
const ANILIST_GQL = 'https://graphql.anilist.co';

async function fetchAniListId(title: string, year?: number): Promise<number | null> {
  const query = `query ($s: String, $y: Int) { Media(search: $s, seasonYear: $y, type: ANIME, isAdult: false) { id } }`;
  try {
    const res = await fetch(ANILIST_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables: { s: title, y: year || undefined } }),
    });
    return (await res.json())?.data?.Media?.id || null;
  } catch { return null; }
}

async function fetchAniListIdFallback(title: string): Promise<number | null> {
  const query = `query ($s: String) { Media(search: $s, type: ANIME, isAdult: false) { id } }`;
  try {
    const res = await fetch(ANILIST_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables: { s: title } }),
    });
    return (await res.json())?.data?.Media?.id || null;
  } catch { return null; }
}

function detectIsAnime(d: TMDBDetails): boolean {
  return d.genres.some(g => g.name === 'Animation') &&
    !!(d.origin_country?.includes('JP') || d.original_language === 'ja');
}

// ─── PROVIDER HELPERS ─────────────────────────────────────────────────────────
function getProviders(ct: ContentType): ProviderDef[] {
  return PROVIDER_DEFS.filter(p => p.contentTypes.includes(ct)).sort((a, b) => a.priority - b.priority);
}

function buildUrl(p: ProviderDef, tmdbId: number, anilistId: number | null, ct: ContentType, s: number, e: number, lang?: string): string {
  const id = p.searchType === 'anilist' ? (anilistId ?? tmdbId) : tmdbId;
  if (ct === 'movie' && p.movieUrl)  return p.movieUrl(id, lang);
  if (ct === 'anime' && p.animeUrl)  return p.animeUrl(id, e, lang);
  if (ct === 'tv'    && p.tvUrl)     return p.tvUrl(id, s, e, lang);
  if (p.tvUrl)    return p.tvUrl(id, s, e, lang);
  if (p.movieUrl) return p.movieUrl(id, lang);
  return '';
}

// ─── AUDIO DROPDOWN ───────────────────────────────────────────────────────────
function AudioDropdown({ variants, active, onChange }: {
  variants: AudioVariant[];
  active:   string;
  onChange: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeLabel = variants.find(v => v.key === active)?.label ?? active.toUpperCase();

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Audio language"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '6px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
          border: `1px solid ${open ? C.borderHov : C.border}`,
          background: open ? C.elevated : 'transparent',
          color: C.text, cursor: 'pointer', transition: 'all 0.15s',
        }}
      >
        <Languages size={12} />
        {activeLabel}
        <ChevronDown size={11} style={{ opacity: 0.6 }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50,
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 8, padding: 4, minWidth: 110,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          {variants.map(v => {
            const isActive = v.key === active;
            return (
              <button
                key={v.key}
                onClick={() => { onChange(v.key); setOpen(false); }}
                style={{
                  display: 'block', width: '100%', padding: '7px 12px',
                  borderRadius: 5, border: 'none', textAlign: 'left',
                  fontSize: 12, fontWeight: isActive ? 700 : 500,
                  background: isActive ? C.elevated : 'transparent',
                  color: isActive ? C.text : C.textSub,
                  cursor: 'pointer', transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = C.elevated; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                {v.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── EPISODE PANEL ────────────────────────────────────────────────────────────
function EpisodePanel({
  seasons, episodes, curSeason, curEp, loadingEps, isAnime,
  onSelectSeason, onSelectEp,
}: {
  seasons:        TMDBSeason[];
  episodes:       TMDBEpisode[];
  curSeason:      number;
  curEp:          number;
  loadingEps:     boolean;
  isAnime:        boolean;
  onSelectSeason: (s: number) => void;
  onSelectEp:     (ep: number) => void;
}) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const [seasonDropOpen, setSeasonDropOpen] = useState(false);
  const seasonDropRef = useRef<HTMLDivElement>(null);

  // Close season dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (seasonDropRef.current && !seasonDropRef.current.contains(e.target as Node)) setSeasonDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [curEp]);

  // Arrow-key navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['ArrowLeft','ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const maxEp = episodes.length;
        if (e.key === 'ArrowRight') onSelectEp(Math.min(curEp + 1, maxEp));
        if (e.key === 'ArrowLeft')  onSelectEp(Math.max(curEp - 1, 1));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [curEp, episodes.length, onSelectEp]);

  const curSeasonObj = seasons.find(s => s.season_number === curSeason);

  return (
    <div style={{ marginTop: 12, borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, padding: 16 }}>

      {/* Season custom dropdown */}
      {!isAnime && seasons.length > 1 && (
        <div ref={seasonDropRef} style={{ position: 'relative', marginBottom: 14, display: 'inline-block' }}>
          <button
            onClick={() => setSeasonDropOpen(o => !o)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              border: `1px solid ${seasonDropOpen ? C.borderHov : C.border}`,
              background: C.elevated, color: C.text, cursor: 'pointer',
              transition: 'all 0.15s', minWidth: 160,
            }}
          >
            <span style={{ flex: 1, textAlign: 'left' }}>
              {curSeasonObj?.name || `Season ${curSeason}`}
              <span style={{ marginLeft: 6, fontSize: 11, color: C.textSub, fontWeight: 400 }}>
                {curSeasonObj ? `· ${curSeasonObj.episode_count} eps` : ''}
              </span>
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ opacity: 0.6, transform: seasonDropOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {seasonDropOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 60,
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 10, padding: 4, minWidth: 200, maxHeight: 260, overflowY: 'auto',
              boxShadow: '0 12px 36px rgba(0,0,0,0.6)', scrollbarWidth: 'none',
            }}>
              {seasons.map(s => {
                const isActive = s.season_number === curSeason;
                return (
                  <button
                    key={s.season_number}
                    onClick={() => { onSelectSeason(s.season_number); setSeasonDropOpen(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      width: '100%', padding: '8px 12px', borderRadius: 7, border: 'none',
                      background: isActive ? C.elevated : 'transparent',
                      color: isActive ? C.text : C.textSub,
                      fontSize: 13, fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer', transition: 'background 0.1s', textAlign: 'left', gap: 10,
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = C.elevated; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span>{s.name || `Season ${s.season_number}`}</span>
                    <span style={{ fontSize: 11, color: C.textSub, fontWeight: 400, flexShrink: 0 }}>{s.episode_count} eps</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Episode grid — row-wise wrap */}
      {loadingEps ? (
        <p style={{ color: C.textSub, fontSize: 13, margin: 0 }}>Loading episodes…</p>
      ) : episodes.length > 0 ? (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
        }}>
          {episodes.map(ep => {
            const active = ep.episode_number === curEp;
            return (
              <button
                key={ep.episode_number}
                ref={active ? activeRef : undefined}
                title={ep.name}
                onClick={() => onSelectEp(ep.episode_number)}
                style={{
                  width: 44, padding: '8px 4px', borderRadius: 6,
                  border: `1px solid ${active ? C.text : C.border}`,
                  background: active ? C.text : 'transparent',
                  color: active ? C.bg : C.textSub,
                  fontSize: 12, fontWeight: active ? 700 : 500,
                  cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = C.borderHov; e.currentTarget.style.color = C.text; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSub; } }}
              >{ep.episode_number}</button>
            );
          })}
        </div>
      ) : (
        <p style={{ color: C.textSub, fontSize: 13, margin: 0 }}>No episodes found.</p>
      )}

      {/* Current ep info */}
      {(() => {
        const ep = episodes.find(e => e.episode_number === curEp);
        if (!ep) return null;
        return (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
            <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: C.text }}>
              {isAnime ? `Ep ${ep.episode_number}` : `E${ep.episode_number}`}
              {ep.name ? ` — ${ep.name}` : ''}
            </p>
            {ep.overview && (
              <p style={{
                margin: 0, fontSize: 12, color: C.textSub, lineHeight: 1.55,
                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>{ep.overview}</p>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ─── RELATED CONTENT RAIL ─────────────────────────────────────────────────────
interface TMDBRelated { id: number; title?: string; name?: string; poster_path: string | null; vote_average: number; media_type?: string; }

function RelatedRail({ tmdbId, mediaType, navigate }: { tmdbId: number; mediaType: string; navigate: ReturnType<typeof useNavigate> }) {
  const [items, setItems] = useState<TMDBRelated[]>([]);

  useEffect(() => {
    const endpoint = mediaType === 'movie' ? 'movie' : 'tv';
    fetch(`${TMDB_BASE}/${endpoint}/${tmdbId}/recommendations?api_key=${TMDB_KEY}&language=en-US&page=1`)
      .then(r => r.json())
      .then(d => setItems((d.results || []).slice(0, 12)))
      .catch(() => {});
  }, [tmdbId, mediaType]);

  if (!items.length) return null;

  return (
    <div style={{ marginTop: 32 }}>
      <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: C.text }}>More Like This</h3>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none' }}>
        {items.map(r => {
          const title = r.title || r.name || '';
          const poster = r.poster_path ? `${TMDB_IMG}/w300${r.poster_path}` : null;
          const routeType = mediaType === 'movie' ? 'movie' : 'show';
          return (
            <div
              key={r.id}
              onClick={() => navigate(`/player/${routeType}/${r.id}`)}
              style={{
                flexShrink: 0, width: 110, cursor: 'pointer',
                borderRadius: 8, overflow: 'hidden',
                border: `1px solid ${C.border}`, background: C.surface,
                transition: 'transform 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.04)'; (e.currentTarget as HTMLDivElement).style.borderColor = C.borderHov; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLDivElement).style.borderColor = C.border; }}
            >
              {poster
                ? <img src={poster} alt={title} style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover', display: 'block' }} />
                : <div style={{ width: '100%', aspectRatio: '2/3', background: C.elevated, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Film size={24} color={C.textSub} />
                  </div>
              }
              <div style={{ padding: '7px 8px' }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: C.text, lineHeight: 1.3,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{title}</p>
                {r.vote_average > 0 && (
                  <p style={{ margin: '3px 0 0', fontSize: 10, color: C.textSub, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Star size={9} /> {r.vote_average.toFixed(1)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── PLAYER PAGE ──────────────────────────────────────────────────────────────
export default function PlayerPage() {
  const { type, tmdbId } = useParams<{ type: 'movie' | 'show' | 'anime'; tmdbId: string }>();
  const location  = useLocation();
  const navigate  = useNavigate();

  const stateItem         = location.state?.item as CineItem | undefined;
  const resumeSeason      = (location.state?.resumeSeason  as number | undefined) ?? 1;
  const resumeEpisode     = (location.state?.resumeEpisode as number | undefined) ?? 1;

  const [item,        setItem]       = useState<CineItem | null>(stateItem || null);
  const [loadingMeta, setLoadingMeta]= useState(!stateItem);
  const [anilistId,   setAnilistId]  = useState<number | null>(stateItem?.anilistId || null);
  const [loadingAL,   setLoadingAL]  = useState(false);
  const [isAnime,     setIsAnime]    = useState<boolean>(stateItem?.isAnime || false);

  const effectiveType: ContentType =
    isAnime ? 'anime' : type === 'movie' ? 'movie' : 'tv';

  const providers = getProviders(effectiveType);

  const tmdbIdNum = parseInt(tmdbId || '0', 10);
  const mediaType = type as 'movie' | 'show' | 'anime';

  // Server pref: initialise after we know effectiveType
  const [providerIdx, setProviderIdx] = useState(0);
  const [activeLang,  setActiveLang]  = useState<string>('en');
  const provider = providers[providerIdx] || providers[0];

  // Show/anime state
  const [seasons,     setSeasons]    = useState<TMDBSeason[]>([]);
  const [episodes,    setEpisodes]   = useState<TMDBEpisode[]>([]);
  const [curSeason,   setCurSeason]  = useState(resumeSeason);
  const [curEp,       setCurEp]      = useState(resumeEpisode);
  const [epPanelOpen,    setEpPanelOpen]   = useState(false);
  const [loadingEps,     setLoadingEps]    = useState(false);
  const [iframeKey,      setIframeKey]     = useState(0);
  const [iframeFullscreen, setIframeFullscreen] = useState(false);
  const iframeRef    = useRef<HTMLIFrameElement>(null);
  const iframeWrapRef = useRef<HTMLDivElement>(null);

  // Fullscreen: expand the iframe wrapper to cover the whole viewport
  const handleIframeFullscreen = useCallback(() => {
    if (iframeFullscreen) {
      setIframeFullscreen(false);
      try {
        if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
        (screen.orientation as any).unlock?.();
      } catch {}
    } else {
      setIframeFullscreen(true);
      // Try native fullscreen on the wrapper element first
      try {
        const el = iframeWrapRef.current as any;
        const req = el?.requestFullscreen || el?.webkitRequestFullscreen || el?.mozRequestFullScreen;
        if (req) req.call(el);
      } catch {}
      // Force landscape orientation — must be called after a user gesture
      const lockOrientation = async () => {
        try {
          await (screen.orientation as any).lock?.('landscape');
        } catch {
          // Fallback: try deprecated API
          try {
            const so = screen as any;
            (so.lockOrientation || so.mozLockOrientation || so.msLockOrientation)?.('landscape');
          } catch {}
        }
      };
      lockOrientation();
    }
  }, [iframeFullscreen]);

  // Back gesture / popstate → exit fullscreen instead of navigating
  useEffect(() => {
    if (!iframeFullscreen) return;
    const handler = (e: PopStateEvent) => {
      e.preventDefault();
      setIframeFullscreen(false);
      try { (screen.orientation as any).unlock?.(); } catch {}
      // Push a dummy state back so the page stays
      window.history.pushState(null, '', window.location.href);
    };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [iframeFullscreen]);

  // ── Fetch TMDB metadata ──────────────────────────────────────────────────────
  useEffect(() => {
    if (stateItem) return;
    (async () => {
      setLoadingMeta(true);
      try {
        const d = await fetchTMDBDetails(tmdbIdNum, mediaType === 'movie' ? 'movie' : 'show');
        if (!d) return;
        const anime   = detectIsAnime(d);
        const title   = d.title || d.name || '';
        const yearStr = d.release_date || d.first_air_date || '';
        const year    = yearStr ? parseInt(yearStr.slice(0, 4)) : 0;
        setIsAnime(anime);
        setItem({
          type: mediaType === 'movie' ? 'movie' : anime ? 'anime' : 'show',
          title, year,
          overview: d.overview || '',
          rating:   d.vote_average || 0,
          genres:   d.genres.map(g => g.name),
          tmdb_id: tmdbIdNum, imdb_id: '',
          poster:   d.poster_path   ? `${TMDB_IMG}/w500${d.poster_path}`   : '',
          backdrop: d.backdrop_path ? `${TMDB_IMG}/w1280${d.backdrop_path}` : '',
          isAnime: anime,
          totalEpisodes: d.number_of_episodes,
        });
        if (anime) {
          setLoadingAL(true);
          let alId = await fetchAniListId(title, year);
          if (!alId) alId = await fetchAniListIdFallback(title);
          setAnilistId(alId);
          setLoadingAL(false);
        }
      } finally { setLoadingMeta(false); }
    })();
  }, [tmdbIdNum, mediaType, stateItem]);

  // ── Resolve AniList for state items ─────────────────────────────────────────
  useEffect(() => {
    if (!stateItem?.isAnime || anilistId) return;
    (async () => {
      setLoadingAL(true);
      let alId = await fetchAniListId(stateItem.title, stateItem.year);
      if (!alId) alId = await fetchAniListIdFallback(stateItem.title);
      setAnilistId(alId);
      setIsAnime(true);
      setLoadingAL(false);
    })();
  }, [stateItem]);

  // ── Restore server preference once effectiveType is known ───────────────────
  useEffect(() => {
    if (!providers.length) return;
    const savedId = getServerPref(tmdbIdNum, effectiveType);
    if (savedId) {
      const idx = providers.findIndex(p => p.id === savedId);
      if (idx >= 0) { setProviderIdx(idx); return; }
    }
    setProviderIdx(0);
    setActiveLang('en');
  }, [effectiveType, tmdbIdNum]);

  // ── Fetch seasons ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mediaType === 'movie') return;
    fetchTMDBSeasons(tmdbIdNum).then(setSeasons);
  }, [tmdbIdNum, mediaType]);

  // ── Fetch episodes ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (mediaType === 'movie') return;
    setLoadingEps(true);
    fetchTMDBEpisodes(tmdbIdNum, curSeason)
      .then(eps => { setEpisodes(eps); setLoadingEps(false); });
  }, [tmdbIdNum, mediaType, curSeason]);

  // ── Save continue watching whenever ep/season changes ───────────────────────
  useEffect(() => {
    if (!item || loadingMeta) return;
    saveContinueWatching({ item, season: curSeason, episode: curEp, updatedAt: Date.now() });
  }, [item, curSeason, curEp, loadingMeta]);

  // ── Build embed URL ──────────────────────────────────────────────────────────
  const embedUrl = useCallback((): string => {
    if (!provider) return '';
    return buildUrl(provider, tmdbIdNum, anilistId, effectiveType, curSeason, curEp, activeLang);
  }, [provider, tmdbIdNum, anilistId, effectiveType, curSeason, curEp, activeLang]);

  const selectProvider = (idx: number) => {
    setProviderIdx(idx);
    setActiveLang('en');
    setIframeKey(k => k + 1);
    if (providers[idx]) saveServerPref(tmdbIdNum, effectiveType, providers[idx].id);
  };

  const handleNextEp = () => {
    if (curEp < episodes.length) {
      setCurEp(e => e + 1); setIframeKey(k => k + 1);
    } else if (curSeason < seasons.length) {
      setCurSeason(s => s + 1); setCurEp(1); setIframeKey(k => k + 1);
    }
  };

  const handleSelectEp = (ep: number) => {
    setCurEp(ep); setIframeKey(k => k + 1); setEpPanelOpen(false);
  };

  const currentEpisodeObj = episodes.find(e => e.episode_number === curEp);
  const [overviewExpanded, setOverviewExpanded] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'Inter, system-ui, sans-serif', color: C.text, animation: 'sv-fadein 0.3s ease' }}>

      {/* ── Top bar ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(15,17,21,0.97)', backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${C.border}`,
        padding: '0 4vw', height: 56,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.textSub, fontSize: 13, padding: '6px 10px',
            borderRadius: 6, transition: 'color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = C.text)}
          onMouseLeave={e => (e.currentTarget.style.color = C.textSub)}
        ><ArrowLeft size={15} /> Back</button>

        <div style={{ flex: 1, minWidth: 0 }}>
          {item && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.title}
              </span>
              {mediaType !== 'movie' && (
                <span style={{ fontSize: 12, color: C.textSub, flexShrink: 0 }}>
                  {isAnime ? `Ep ${curEp}` : `S${curSeason} · E${curEp}`}
                  {currentEpisodeObj?.name ? ` — ${currentEpisodeObj.name}` : ''}
                </span>
              )}
              {isAnime && (
                <span style={{
                  fontSize: 10, fontWeight: 700, color: '#f472b6',
                  padding: '2px 7px', borderRadius: 4,
                  border: '1px solid rgba(244,114,182,0.3)', background: 'rgba(244,114,182,0.08)',
                  letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0,
                }}>ANIME</span>
              )}
            </div>
          )}
        </div>

        {isAnime && (
          <div style={{ fontSize: 11, color: C.textSub, flexShrink: 0 }}>
            {loadingAL ? 'AniList…'
              : anilistId ? <span style={{ color: '#02a9ff' }}>AL:{anilistId}</span>
              : <span style={{ color: '#f59e0b' }}>AL:?</span>}
          </div>
        )}

        <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.04em', flexShrink: 0 }}>
          Cine<span style={{ color: C.textSub, fontWeight: 400 }}>verse</span>
        </span>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 4vw 80px', animation: 'sv-slideup 0.35s ease' }}>

        {/* ── PLAYER FRAME (with fullscreen overlay mode) ── */}
        <div
          ref={iframeWrapRef}
          style={iframeFullscreen ? {
            position: 'fixed', inset: 0, zIndex: 9999,
            background: '#000', width: '100vw', height: '100vh',
          } : {
            position: 'relative',
            width: '100%', aspectRatio: '16/9',
            background: '#000', borderRadius: 10, overflow: 'hidden',
            marginTop: 20, boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
            border: `1px solid ${C.border}`,
          }}
        >
          {loadingMeta ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.surface }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 40, height: 40, border: `2px solid ${C.border}`, borderTopColor: C.text, borderRadius: '50%', animation: 'sv-spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                <p style={{ color: C.textSub, fontSize: 13, margin: 0 }}>Loading…</p>
              </div>
            </div>
          ) : (
            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={embedUrl()}
              title={item?.title || 'Player'}
              allowFullScreen
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            />
          )}
          {/* Exit fullscreen button (only visible in fullscreen mode) */}
          {iframeFullscreen && (
            <button
              onClick={handleIframeFullscreen}
              style={{
                position: 'absolute', top: 12, right: 12, zIndex: 10000,
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(0,0,0,0.7)', border: `1px solid rgba(255,255,255,0.2)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#fff',
              }}
            ><ChevronDown size={16} /></button>
          )}
        </div>

        {/* ── BELOW-PLAYER BAR: ep info + fullscreen btn ── */}
        {!iframeFullscreen && (
          <div style={{
            marginTop: 10, display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: 10,
          }}>
            {/* Left: show name + ep counter (series only) */}
            <div style={{ minWidth: 0, flex: 1 }}>
              {mediaType !== 'movie' && item && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '55vw' }}>
                    {item.title}
                  </span>
                  <span style={{ fontSize: 12, color: C.textSub, flexShrink: 0 }}>
                    {isAnime
                      ? `Ep ${curEp}${episodes.length > 0 ? `/${episodes.length}` : ''}`
                      : `S${curSeason} · E${curEp}${episodes.length > 0 ? `/${episodes.length}` : ''}`}
                  </span>
                </div>
              )}
            </div>
            {/* Right: fullscreen button */}
            <button
              onClick={handleIframeFullscreen}
              title="Fullscreen"
              style={{
                flexShrink: 0, width: 36, height: 36, borderRadius: 8,
                border: `1px solid ${C.border}`, background: C.elevated,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: C.text, transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderHov; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; }}
            ><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 5V2a1 1 0 0 1 1-1h3M15 11v3a1 1 0 0 1-1 1h-3M11 1h3a1 1 0 0 1 1 1v3M5 15H2a1 1 0 0 1-1-1v-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg></button>
          </div>
        )}

        {/* ── CONTROLS ── */}
        {!iframeFullscreen && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Server row + audio dropdown inline */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {providers.map((p, idx) => {
              const active  = idx === providerIdx;
              const needsAL = p.searchType === 'anilist' && isAnime && !anilistId;
              return (
                <button
                  key={p.id}
                  onClick={() => selectProvider(idx)}
                  title={needsAL ? 'Resolving AniList ID…' : p.label}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    border: `1px solid ${active ? C.text : C.border}`,
                    background: active ? C.text : 'transparent',
                    color: active ? C.bg : needsAL ? C.textSub : C.text,
                    cursor: 'pointer', transition: 'all 0.15s',
                    opacity: needsAL ? 0.45 : 1,
                  }}
                  onMouseEnter={e => { if (!active && !needsAL) e.currentTarget.style.borderColor = C.borderHov; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = C.border; }}
                >
                  {p.label}
                </button>
              );
            })}

            {/* Audio dropdown — only when active provider has variants */}
            {provider?.audioVariants && provider.audioVariants.length > 0 && (
              <AudioDropdown
                variants={provider.audioVariants}
                active={activeLang}
                onChange={(lang) => { setActiveLang(lang); setIframeKey(k => k + 1); }}
              />
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => setIframeKey(k => k + 1)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 6, fontSize: 12,
                border: `1px solid ${C.border}`, background: 'transparent',
                color: C.textSub, cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderHov; e.currentTarget.style.color = C.text; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border;    e.currentTarget.style.color = C.textSub; }}
            ><RefreshCw size={13} /> Reload</button>

            {mediaType !== 'movie' && (
              <button
                onClick={handleNextEp}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  border: `1px solid ${C.border}`, background: C.elevated,
                  color: C.text, cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = C.borderHov)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
              ><SkipForward size={13} /> {isAnime ? 'Next Ep' : 'Next Episode'}</button>
            )}

            {mediaType !== 'movie' && (
              <button
                onClick={() => setEpPanelOpen(o => !o)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  border: `1px solid ${epPanelOpen ? C.text : C.border}`,
                  background: epPanelOpen ? C.text : C.elevated,
                  color: epPanelOpen ? C.bg : C.text,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >Episodes {epPanelOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</button>
            )}
          </div>
        </div>
        )}

        {/* ── EPISODE PANEL (inline below controls) ── */}
        {!iframeFullscreen && mediaType !== 'movie' && epPanelOpen && (
          <EpisodePanel
            seasons={seasons} episodes={episodes}
            curSeason={curSeason} curEp={curEp}
            loadingEps={loadingEps} isAnime={isAnime}
            onSelectSeason={(s) => { setCurSeason(s); setCurEp(1); setIframeKey(k => k + 1); }}
            onSelectEp={handleSelectEp}
          />
        )}

        {/* ── METADATA ── */}
        {item && !loadingMeta && (
          <>
          <div style={{ marginTop: 28, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 20, alignItems: 'start' }}>
            {item.poster && (
              <img src={item.poster} alt={item.title}
                style={{ width: 110, borderRadius: 8, objectFit: 'cover', border: `1px solid ${C.border}`, display: 'block' }} />
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-0.025em' }}>{item.title}</h1>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 4, border: `1px solid ${C.border}`, background: C.surface }}>
                  {item.type === 'movie' ? <Film size={11} color={C.textSub} /> : <Tv size={11} color={C.textSub} />}
                  <span style={{ fontSize: 11, color: C.textSub, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {item.type === 'movie' ? 'Movie' : isAnime ? 'Anime' : 'TV Series'}
                  </span>
                </div>
                {isAnime && anilistId && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 4, border: '1px solid rgba(2,169,255,0.3)', background: 'rgba(2,169,255,0.08)' }}>
                    <span style={{ fontSize: 11, color: '#02a9ff', fontWeight: 600 }}>AniList #{anilistId}</span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
                {item.year > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Calendar size={12} color={C.textSub} />
                    <span style={{ fontSize: 13, color: C.textSub }}>{item.year}</span>
                  </div>
                )}
                {item.rating > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Star size={12} color={C.textSub} />
                    <span style={{ fontSize: 13, color: C.textSub }}>{item.rating.toFixed(1)} / 10</span>
                  </div>
                )}
              </div>
              {item.genres.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  {item.genres.slice(0, 5).map(g => (
                    <span key={g} style={{ fontSize: 11, fontWeight: 600, color: C.textSub, letterSpacing: '0.04em', padding: '3px 10px', borderRadius: 20, border: `1px solid ${C.border}`, background: C.elevated }}>{g}</span>
                  ))}
                </div>
              )}
              {item.overview && (() => {
                const LIMIT = 180;
                const isLong = item.overview.length > LIMIT;
                const shown  = overviewExpanded || !isLong ? item.overview : item.overview.slice(0, LIMIT) + '…';
                return (
                  <div>
                    <p style={{ margin: 0, fontSize: 13, color: C.textSub, lineHeight: 1.7 }}>{shown}</p>
                    {isLong && (
                      <button
                        onClick={() => setOverviewExpanded(o => !o)}
                        style={{
                          marginTop: 6, background: 'none', border: 'none', padding: 0,
                          fontSize: 12, fontWeight: 600, color: C.text, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 4, opacity: 0.75,
                        }}
                      >
                        {overviewExpanded ? <>Show less <ChevronUp size={12} /></> : <>Show more <ChevronDown size={12} /></>}
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ── RELATED CONTENT ── */}
          <RelatedRail tmdbId={tmdbIdNum} mediaType={mediaType} navigate={navigate} />
          </>
        )}
      </div>

      <style>{`
        @keyframes sv-spin    { to { transform: rotate(360deg); } }
        @keyframes sv-fadein  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes sv-slideup { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        *::-webkit-scrollbar { display: none; }
        * { -ms-overflow-style: none; scrollbar-width: none; box-sizing: border-box; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
}