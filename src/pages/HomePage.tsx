// src/pages/CineverseHome.tsx
// Cineverse — Home Page — GOD MODE REWRITE v4
// ✦ Floating pill glassmorphic navbar (rounded rect, margins, true glass)
// ✦ Real TMDB provider logos — B&W grayscale monochrome
// ✦ TMDB discover fetch per provider (real loading state)
// ✦ Netflix + Prime Top 10 as MediaCards (landscape, between rails)
// ✦ 3D rounded-rect TopTen cards with blur-on-swipe + shadow glow
// ✦ Browse by Genre section below Browse by Provider
// ✦ Premium typography: Outfit display + Inter body
// ✦ Disclaimer section + floating bottom dock

import { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, Search, Film, Tv, TrendingUp, Star,
  ChevronLeft, ChevronRight, Clock, Trash2,
  Home, Compass, AlertCircle, Shield,
  Flame, Laugh, Ghost, Rocket, Heart, Drama, Sparkles,
} from 'lucide-react';
import { tmdb, getTMDBImage } from '@/lib/tmdb';

// ─── CONTINUE WATCHING HELPERS ────────────────────────────────────────────────
const CW_KEY = 'sv_continue_watching';
interface ContinueWatchingEntry {
  item:      CineItem & { isAnime?: boolean };
  season:    number;
  episode:   number;
  updatedAt: number;
}
function getContinueWatching(): ContinueWatchingEntry[] {
  try {
    const raw: ContinueWatchingEntry[] = JSON.parse(localStorage.getItem(CW_KEY) || '[]');
    const map = new Map<number, ContinueWatchingEntry>();
    for (const entry of raw) {
      const existing = map.get(entry.item.tmdb_id);
      if (!existing || entry.updatedAt > existing.updatedAt) map.set(entry.item.tmdb_id, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch { return []; }
}
function removeContinueWatchingEntry(tmdbId: number) {
  try {
    const list = getContinueWatching().filter(e => e.item.tmdb_id !== tmdbId);
    localStorage.setItem(CW_KEY, JSON.stringify(list));
  } catch {}
}

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  bg:        '#07090D',
  surface:   '#0F1318',
  elevated:  '#181D24',
  text:      '#F8F9FB',
  textSub:   '#8792A0',
  accent:    '#CDD1D8',
  border:    'rgba(248,249,251,0.055)',
  borderHov: 'rgba(248,249,251,0.13)',
  overlay:   'rgba(7,9,13,0.9)',
} as const;

const G = {
  light: {
    background:          'rgba(15,19,24,0.45)',
    backdropFilter:      'blur(20px)',
    WebkitBackdropFilter:'blur(20px)',
    border:              '1px solid rgba(248,249,251,0.07)',
  },
  strong: {
    background:          'rgba(7,9,13,0.62)',
    backdropFilter:      'blur(28px)',
    WebkitBackdropFilter:'blur(28px)',
    border:              '1px solid rgba(255,255,255,0.13)',
    boxShadow:           '0 6px 28px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)',
  },
} as const;

// ─── TYPES ────────────────────────────────────────────────────────────────────
export interface CineItem {
  type:     'movie' | 'tv';
  title:    string;
  year:     number;
  overview: string;
  rating:   number;
  genres:   string[];
  tmdb_id:  number;
  poster:   string;
  backdrop: string;
}

// ─── PROVIDER CONFIG ──────────────────────────────────────────────────────────
// Using Simple Icons CDN for exact brand SVG logos rendered in white
// All presented in B&W monochrome to match the dark theme
interface ProviderConfig {
  id: string;
  tmdbId: number;
  name: string;
  iconUrl: string | null;
  fallbackText?: string;
}

// Brand accent colours — used for the 3D button glow on selection
const PROVIDER_COLORS: Record<string, string> = {
  netflix:     '#E50914',
  prime:       '#00A8E0',
  appletv:     '#555555',
  hulu:        '#1CE783',
  disney:      '#113CCF',
  max:         '#0031B4',
  crunchyroll: '#F47521',
};

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'netflix',
    tmdbId: 8,
    name: 'Netflix',
    // TMDB official provider logo
    iconUrl: 'https://image.tmdb.org/t/p/original/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg',
  },
  {
    id: 'prime',
    tmdbId: 9,
    name: 'Prime Video',
    iconUrl: 'https://image.tmdb.org/t/p/original/emthp39XA2YScoYL1p0sdbAH2WA.jpg',
  },
  {
    id: 'appletv',
    tmdbId: 350,
    name: 'Apple TV+',
    iconUrl: 'https://image.tmdb.org/t/p/original/peURlLlr8jggOwK53fJ5wdQl05y.jpg',
  },
  {
    id: 'hulu',
    tmdbId: 15,
    name: 'Hulu',
    iconUrl: 'https://image.tmdb.org/t/p/original/zxrVdFjIjLqkfnwyghnfywTn3Lh.jpg',
  },
  {
    id: 'disney',
    tmdbId: 337,
    name: 'Disney+',
    iconUrl: 'https://image.tmdb.org/t/p/original/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg',
  },
  {
    id: 'max',
    tmdbId: 1899,
    name: 'Max',
    iconUrl: 'https://image.tmdb.org/t/p/original/Ajqyt5aNxNx9jp9MukZMVjMEzik.jpg',
  },
  {
    id: 'crunchyroll',
    tmdbId: 283,
    name: 'Crunchyroll',
    iconUrl: 'https://image.tmdb.org/t/p/original/8Gt1iClBlzTeQs8WQm8UrCoIxnQ.jpg',
  },
];

// Provider logo renderer — square rounded logo image from TMDB CDN — always B&W
const ProviderLogo = memo(function ProviderLogo({
  provider, size = 44,
}: { provider: ProviderConfig; size?: number }) {
  const [err, setErr] = useState(false);

  if (provider.iconUrl && !err) {
    return (
      <img
        src={provider.iconUrl}
        alt={provider.name}
        width={size}
        height={size}
        onError={() => setErr(true)}
        style={{
          objectFit: 'cover',
          display: 'block',
          borderRadius: Math.round(size * 0.22),
          width: size,
          height: size,
          filter: 'grayscale(1) brightness(1.05)',
        }}
      />
    );
  }

  // Text fallback
  return (
    <span style={{
      fontSize: 9, fontWeight: 900, color: 'white',
      letterSpacing: '0.05em', textTransform: 'uppercase',
      fontFamily: '"Inter", "Arial Black", sans-serif', textAlign: 'center',
      lineHeight: 1.1,
    }}>{provider.name}</span>
  );
});

// ─── TMDB GENRE MAP ───────────────────────────────────────────────────────────
const GENRE_MAP: Record<number, string> = {
  28:'Action', 12:'Adventure', 16:'Animation', 35:'Comedy', 80:'Crime',
  99:'Documentary', 18:'Drama', 10751:'Family', 14:'Fantasy', 36:'History',
  27:'Horror', 10402:'Music', 9648:'Mystery', 10749:'Romance', 878:'Sci-Fi',
  10770:'TV Movie', 53:'Thriller', 10752:'War', 37:'Western',
  10759:'Action & Adventure', 10762:'Kids', 10763:'News', 10764:'Reality',
  10765:'Sci-Fi & Fantasy', 10766:'Soap', 10767:'Talk', 10768:'War & Politics',
};

function normTmdbItem(raw: any, type: 'movie' | 'tv'): CineItem {
  const isMovie = type === 'movie';
  const title   = isMovie ? (raw.title || raw.original_title) : (raw.name || raw.original_name);
  const dateStr = isMovie ? raw.release_date : raw.first_air_date;
  return {
    type,
    title:    title || 'Unknown',
    year:     dateStr ? parseInt(dateStr.slice(0, 4)) : 0,
    overview: raw.overview || '',
    rating:   raw.vote_average ?? 0,
    genres:   (raw.genre_ids || []).slice(0, 4).map((id: number) => GENRE_MAP[id]).filter(Boolean),
    tmdb_id:  raw.id,
    poster:   getTMDBImage(raw.poster_path, 'w500'),
    backdrop: getTMDBImage(raw.backdrop_path, 'backdrop'),
  };
}
function normPage(data: any, type: 'movie' | 'tv', limit = 20): CineItem[] {
  if (!data?.results) return [];
  return data.results.slice(0, limit)
    .map((r: any) => normTmdbItem(r, type))
    .filter((i: CineItem) => i.tmdb_id && i.poster);
}

// Hash-based fallback for provider filtering (when discover fails)
const filterItemsByOtt = (items: CineItem[], ottId: string, tab: 'movie' | 'tv') => {
  const list = items.filter(i => i.type === tab);
  if (ottId === 'all') return list;
  const provider = PROVIDERS.find(p => p.id === ottId);
  if (!provider) return list;
  const idx = PROVIDERS.indexOf(provider) % 6;
  return list.filter(i => i.tmdb_id % 6 === idx);
};

// ─── TMDB DISCOVER BY WATCH PROVIDER ─────────────────────────────────────────
// Tries multiple auth strategies for maximum compatibility
async function tmdbDiscover(type: 'movie' | 'tv', providerId: number): Promise<any> {
  const base = 'https://api.themoviedb.org/3';
  const params = `with_watch_providers=${providerId}&watch_region=US&sort_by=popularity.desc&page=1`;

  // Strategy 1: tmdb lib may expose discover
  try {
    if (typeof (tmdb as any).discover === 'function') {
      return await (tmdb as any).discover(type, providerId);
    }
  } catch {}

  // Strategy 2: Bearer token (modern TMDB apps)
  const token = (import.meta as any).env?.VITE_TMDB_TOKEN
    || (import.meta as any).env?.VITE_TMDB_READ_ACCESS_TOKEN
    || '';
  if (token) {
    try {
      const r = await fetch(`${base}/discover/${type}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) return r.json();
    } catch {}
  }

  // Strategy 3: API key
  const key = (import.meta as any).env?.VITE_TMDB_API_KEY
    || (import.meta as any).env?.VITE_TMDB_KEY
    || '';
  if (key) {
    try {
      const r = await fetch(`${base}/discover/${type}?${params}&api_key=${key}`);
      if (r.ok) return r.json();
    } catch {}
  }

  return null; // Fallback to hash filtering
}

// Fetches a clean top-10 list for a provider showcase — interleaves movies
// and shows from real TMDB discover results so Netflix/Prime rows always
// get a full 10 items instead of a sparse hash-filtered subset.
async function fetchProviderTop10(providerTmdbId: number): Promise<CineItem[]> {
  try {
    const [m, t] = await Promise.all([
      tmdbDiscover('movie', providerTmdbId),
      tmdbDiscover('tv', providerTmdbId),
    ]);
    const movies = m ? normPage(m, 'movie', 10) : [];
    const shows  = t ? normPage(t, 'tv', 10) : [];
    const combined: CineItem[] = [];
    let mi = 0, si = 0;
    while (combined.length < 10 && (mi < movies.length || si < shows.length)) {
      if (mi < movies.length) combined.push(movies[mi++]);
      if (combined.length < 10 && si < shows.length) combined.push(shows[si++]);
    }
    return combined.slice(0, 10);
  } catch {
    return [];
  }
}

// ─── SKELETONS ────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{
      flexShrink: 0, width: 'calc((100vw - 8vw - 24px) / 3)', maxWidth: 280,
      borderRadius: 14, overflow: 'hidden', background: C.surface,
    }}>
      <div style={{ width: '100%', paddingTop: '140%' }} className="cv-sk" />
    </div>
  );
}
function SkeletonHero() {
  return <div style={{ width: '100%', height: '85vh', background: C.surface }} className="cv-sk" />;
}
function SkeletonLandscape({ count = 5 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', gap: 10, overflow: 'hidden' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ flexShrink: 0, width: 260, height: 160, borderRadius: 14, background: C.surface }} className="cv-sk" />
      ))}
    </div>
  );
}

// ─── POSTER CARD ──────────────────────────────────────────────────────────────
const PosterCard = memo(function PosterCard({
  item, onClick,
}: { item: CineItem; onClick: (item: CineItem) => void }) {
  const [hov, setHov] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  return (
    <button
      onClick={() => onClick(item)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flexShrink: 0, width: 'calc((100vw - 8vw - 24px) / 3)', maxWidth: 280,
        borderRadius: 14, overflow: 'hidden', background: 'transparent',
        border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left',
        transform: hov ? 'scale(1.04)' : 'scale(1)',
        transition: 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
        WebkitTapHighlightColor: 'transparent',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
    >
      <div style={{
        width: '100%', paddingTop: '142%', position: 'relative',
        overflow: 'hidden', borderRadius: 12, background: C.surface,
        boxShadow: hov ? '0 16px 40px rgba(0,0,0,0.6)' : '0 4px 14px rgba(0,0,0,0.25)',
        transition: 'box-shadow 0.25s ease',
      }}>
        {item.poster ? (
          <img
            src={item.poster} alt={item.title} loading="lazy"
            onLoad={() => setImgLoaded(true)}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.2s ease',
            }}
          />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Film size={24} color={C.textSub} style={{ opacity: 0.2 }} />
          </div>
        )}
        {item.rating > 0 && (
          <div style={{
            position: 'absolute', bottom: 8, right: 8,
            padding: '3px 6px', borderRadius: 6,
            ...G.strong, display: 'flex', alignItems: 'center', gap: 3,
          }}>
            <Star size={10} color="#FBBF24" fill="#FBBF24" />
            <span style={{ fontSize: 10, fontWeight: 700, color: C.text }}>{item.rating.toFixed(1)}</span>
          </div>
        )}
      </div>
      <div style={{ paddingInline: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <p style={{
          margin: 0, fontSize: 13, fontWeight: 600,
          color: hov ? C.text : C.accent, lineHeight: 1.3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{item.title}</p>
        <p style={{ margin: 0, fontSize: 11, color: C.textSub, fontWeight: 500 }}>{item.year || '—'}</p>
      </div>
    </button>
  );
});

// ─── GLASS ARROW ──────────────────────────────────────────────────────────────
function GlassArrow({ dir, onClick, style = {} }: { dir: 'l' | 'r'; onClick: () => void; style?: React.CSSProperties }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 38, height: 38, borderRadius: '50%', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: C.text,
        background: hov ? 'rgba(248,249,251,0.14)' : 'rgba(7,9,13,0.6)',
        backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
        border: `1px solid ${hov ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.11)'}`,
        boxShadow: hov
          ? '0 0 0 1px rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.6)'
          : '0 4px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
        transition: 'all 0.18s ease',
        ...style,
      }}
    >
      {dir === 'l' ? <ChevronLeft size={17} /> : <ChevronRight size={17} />}
    </button>
  );
}

// ─── HORIZONTAL RAIL ──────────────────────────────────────────────────────────
function Rail({
  title, icon, items, loading, onItemClick,
}: {
  title: string; icon?: React.ReactNode;
  items: CineItem[]; loading: boolean;
  onItemClick: (item: CineItem) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: 'l' | 'r') => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: dir === 'l' ? -scrollRef.current.clientWidth * 0.8 : scrollRef.current.clientWidth * 0.8,
      behavior: 'smooth',
    });
  };
  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingInline: '4vw', marginBottom: 14 }}>
        {icon && <span style={{ color: C.textSub }}>{icon}</span>}
        <h2 style={{
          margin: 0,
          fontSize: 'clamp(14px, 3.8vw, 17px)',
          fontWeight: 700,
          color: C.text,
          letterSpacing: '-0.02em',
          fontFamily: '"Outfit", "Inter", system-ui, sans-serif',
        }}>{title}</h2>
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', left: '1vw', top: '50%', transform: 'translateY(-50%)', zIndex: 4 }}>
          <GlassArrow dir="l" onClick={() => scroll('l')} />
        </div>
        <div ref={scrollRef} style={{
          display: 'flex', gap: 12, overflowX: 'auto', paddingInline: '4vw',
          scrollbarWidth: 'none', scrollSnapType: 'x proximity', paddingBottom: 4,
        }}>
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : items.map(item => <PosterCard key={`${item.type}-${item.tmdb_id}`} item={item} onClick={onItemClick} />)
          }
        </div>
        <div style={{ position: 'absolute', right: '1vw', top: '50%', transform: 'translateY(-50%)', zIndex: 4 }}>
          <GlassArrow dir="r" onClick={() => scroll('r')} />
        </div>
      </div>
    </section>
  );
}

// ─── TOP 10 BANNER RAIL — 3D ROUNDED RECT WITH SWIPE BLUR ───────────────────
// Cards are 3D raised rectangles. During swipe: card being exited blurs out,
// incoming card unblurs. Background glow follows active card.
function TopTenRail({
  title, items, loading, onItemClick,
}: { title: string; items: CineItem[]; loading: boolean; onItemClick: (item: CineItem) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const top10 = items.slice(0, 10);

  // Track scroll to detect active slide + swipe state
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let scrollTimer: ReturnType<typeof setTimeout>;

    const onScroll = () => {
      setIsSwiping(true);
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => setIsSwiping(false), 250);

      const cardW = el.clientWidth;
      const idx = Math.round(el.scrollLeft / cardW);
      setActiveIdx(Math.max(0, Math.min(idx, top10.length - 1)));
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); clearTimeout(scrollTimer); };
  }, [top10.length]);

  const slide = (dir: 'l' | 'r') => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: dir === 'l' ? -scrollRef.current.clientWidth : scrollRef.current.clientWidth,
      behavior: 'smooth',
    });
  };

  if (loading) return <div style={{ height: 280, marginInline: '4vw', borderRadius: 24, marginBottom: 48 }} className="cv-sk" />;
  if (!top10.length) return null;

  // Ambient glow colour from active item (subtle white since we don't know brand colour)
  const glowOpacity = isSwiping ? 0.18 : 0.1;

  return (
    <section style={{ marginBottom: 48, paddingInline: '4vw' }}>
      {/* Section heading — Outfit display font */}
      <h2 style={{
        margin: '0 0 16px',
        fontSize: 'clamp(17px, 4.5vw, 22px)',
        fontWeight: 800,
        color: C.text,
        letterSpacing: '-0.03em',
        fontFamily: '"Outfit", "Inter", system-ui, sans-serif',
      }}>
        Top 10 {title}
      </h2>

      {/* 3D card carousel wrapper */}
      <div style={{ position: 'relative' }}>
        {/* Ambient background glow that pulses on swipe */}
        <div style={{
          position: 'absolute',
          inset: '-24px -8px',
          borderRadius: 32,
          background: `radial-gradient(ellipse at 50% 40%, rgba(255,255,255,${glowOpacity}) 0%, transparent 70%)`,
          transition: 'opacity 0.4s ease',
          pointerEvents: 'none',
          zIndex: 0,
        }} />

        {/* Arrow buttons */}
        <div style={{ position: 'absolute', left: -14, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
          <GlassArrow dir="l" onClick={() => slide('l')} />
        </div>
        <div style={{ position: 'absolute', right: -14, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
          <GlassArrow dir="r" onClick={() => slide('r')} />
        </div>

        {/* Scrollable track */}
        <div
          ref={scrollRef}
          style={{
            display: 'flex',
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            scrollbarWidth: 'none',
            gap: 12,
            paddingBlock: 12,
            position: 'relative',
            zIndex: 1,
          }}
        >
          {top10.map((item, idx) => {
            const dist = Math.abs(idx - activeIdx);
            const isActive = idx === activeIdx;
            // Blur scales with distance from active during swipe
            const blurAmount = isSwiping && !isActive ? Math.min(dist * 4, 10) : 0;
            const scale = isActive ? 1 : isSwiping ? 0.94 - dist * 0.012 : 0.96;
            const shadowIntensity = isActive ? (isSwiping ? 0.9 : 0.7) : 0.3;

            return (
              <div
                key={item.tmdb_id}
                onClick={() => onItemClick(item)}
                style={{
                  flexShrink: 0,
                  width: '100%',
                  height: 'min(300px, 54vw)',
                  scrollSnapAlign: 'start',
                  scrollSnapStop: 'always',
                  position: 'relative',
                  cursor: 'pointer',
                  borderRadius: 22,
                  overflow: 'hidden',
                  background: C.surface,
                  // 3D raised shadow — glows more when active
                  boxShadow: isActive
                    ? `0 8px 0 rgba(0,0,0,0.5), 0 16px 48px rgba(0,0,0,${shadowIntensity}), 0 0 0 1px rgba(255,255,255,0.07), 0 -1px 0 rgba(255,255,255,0.04) inset`
                    : `0 4px 0 rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)`,
                  // Blur leaving cards, unblur entering
                  filter: blurAmount > 0 ? `blur(${blurAmount}px)` : 'none',
                  // 3D perspective tilt + scale
                  transform: `scale(${scale}) ${!isActive && isSwiping ? `perspective(800px) rotateY(${idx < activeIdx ? '4' : '-4'}deg)` : ''}`,
                  transition: isSwiping
                    ? 'filter 0.08s ease, transform 0.08s ease, box-shadow 0.15s ease'
                    : 'filter 0.35s cubic-bezier(0.2,0.8,0.2,1), transform 0.35s cubic-bezier(0.2,0.8,0.2,1), box-shadow 0.35s ease',
                  willChange: 'filter, transform',
                }}
              >
                <img
                  src={item.backdrop || item.poster}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }}
                />
                {/* Gradient overlays */}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(7,9,13,0.97) 0%, rgba(7,9,13,0.38) 55%, transparent 100%)' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(7,9,13,0.5) 0%, transparent 55%)' }} />

                {/* Bottom content */}
                <div style={{ position: 'absolute', left: '4vw', bottom: 18, right: '4vw', display: 'flex', alignItems: 'flex-end', gap: 14, zIndex: 3 }}>
                  {/* Big rank number */}
                  <span style={{
                    fontSize: 'clamp(64px, 13vw, 96px)',
                    fontWeight: 900,
                    lineHeight: 0.72,
                    fontStyle: 'italic',
                    fontFamily: '"Outfit", "Inter", system-ui, sans-serif',
                    background: 'linear-gradient(to bottom, rgba(255,255,255,0.92) 20%, rgba(255,255,255,0.06) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    letterSpacing: '-0.05em',
                    userSelect: 'none',
                    flexShrink: 0,
                  }}>{idx + 1}</span>

                  <div style={{ flex: 1, paddingBottom: 4, minWidth: 0 }}>
                    <h3 style={{
                      margin: '0 0 5px',
                      fontSize: 'clamp(14px, 3.8vw, 20px)',
                      fontWeight: 700,
                      color: C.text,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontFamily: '"Outfit", "Inter", system-ui, sans-serif',
                      letterSpacing: '-0.02em',
                    }}>
                      {item.title}
                    </h3>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, color: C.textSub }}>
                      <span style={{ background: 'rgba(248,249,251,0.09)', padding: '2px 7px', borderRadius: 5, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: C.text, letterSpacing: '0.04em' }}>
                        {item.type === 'movie' ? 'Movie' : 'TV'}
                      </span>
                      <span>{item.year}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Star size={10} fill="#FBBF24" color="#FBBF24" /> {item.rating.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dot indicators — bottom right */}
                <div style={{ position: 'absolute', bottom: 12, right: 14, display: 'flex', gap: 4, zIndex: 5 }}>
                  {top10.map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => {
                        e.stopPropagation();
                        const el = scrollRef.current;
                        if (!el) return;
                        el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
                      }}
                      style={{
                        width: i === activeIdx ? 20 : 4, height: 4, borderRadius: 2,
                        background: i === activeIdx ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.22)',
                        border: 'none', cursor: 'pointer', padding: 0,
                        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1), background 0.25s ease',
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── PROVIDER SHOWCASE (Netflix / Prime Top 10 — landscape MediaCards) ────────
// "in between" the rails, NOT the TopTenRail format
// Shows ranked landscape cards with provider logo badge + number
function ProviderShowcase({
  provider, items, loading, onItemClick,
}: {
  provider: ProviderConfig;
  items: CineItem[];
  loading: boolean;
  onItemClick: (item: CineItem) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Items are now real, provider-specific TMDB discover results (already
  // fetched and capped at 10 upstream) — no more hash-filtering needed.
  const filtered = items.filter(i => i.backdrop || i.poster).slice(0, 10);

  const slide = (dir: 'l' | 'r') => {
    scrollRef.current?.scrollBy({ left: dir === 'l' ? -290 : 290, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <section style={{ marginBottom: 48, paddingInline: '4vw' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: C.elevated }} className="cv-sk" />
          <div style={{ width: 140, height: 16, borderRadius: 4, background: C.elevated }} className="cv-sk" />
        </div>
        <SkeletonLandscape />
      </section>
    );
  }
  if (!filtered.length) return null;

  return (
    <section style={{ marginBottom: 48, paddingInline: '4vw' }}>
      {/* Header — B&W monochrome, no brand color */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        {/* Provider icon pill */}
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: C.elevated,
          border: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <ProviderLogo provider={provider} size={20} />
        </div>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.text, letterSpacing: '-0.025em', fontFamily: '"Outfit", "Inter", system-ui, sans-serif' }}>
          Most Watched on <span style={{ color: C.accent }}>{provider.name}</span>
        </h2>
      </div>

      {/* Landscape MediaCards with rank overlay */}
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', left: -10, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
          <GlassArrow dir="l" onClick={() => slide('l')} />
        </div>
        <div ref={scrollRef} style={{
          display: 'flex', gap: 10, overflowX: 'auto',
          scrollbarWidth: 'none', scrollSnapType: 'x proximity', paddingBottom: 2,
        }}>
          {filtered.map((item, idx) => (
            <div
              key={item.tmdb_id}
              onClick={() => onItemClick(item)}
              style={{
                flexShrink: 0, width: 260, height: 160, borderRadius: 14,
                overflow: 'hidden', position: 'relative', cursor: 'pointer',
                scrollSnapAlign: 'start', background: C.surface,
                boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1.03)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 40px rgba(0,0,0,0.7)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 24px rgba(0,0,0,0.5)';
              }}
            >
              <img
                src={item.backdrop || item.poster} alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              {/* Gradient overlays */}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(7,9,13,0.7) 0%, transparent 55%), linear-gradient(to top, rgba(7,9,13,0.9) 0%, transparent 50%)' }} />

              {/* Provider logo badge — top left, small, monochrome */}
              <div style={{
                position: 'absolute', top: 9, left: 9,
                width: 26, height: 26, borderRadius: 7,
                background: 'rgba(15,19,24,0.85)',
                backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                border: `1px solid ${C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <ProviderLogo provider={provider} size={14} />
              </div>

              {/* Rank number */}
              <div style={{
                position: 'absolute', bottom: 6, left: 10,
                fontSize: 48, fontWeight: 900, fontStyle: 'italic',
                background: 'linear-gradient(to bottom, rgba(255,255,255,0.88) 20%, rgba(255,255,255,0.08) 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                lineHeight: 1, userSelect: 'none', letterSpacing: '-0.04em',
              }}>{idx + 1}</div>

              {/* Title + meta */}
              <div style={{ position: 'absolute', bottom: 10, left: 58, right: 10 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{item.title}</p>
                <p style={{ margin: '2px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
                  {item.type === 'movie' ? 'Film' : 'Series'} · {item.year}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', right: -10, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
          <GlassArrow dir="r" onClick={() => slide('r')} />
        </div>
      </div>
    </section>
  );
}

// ─── OTT LOGO MARQUEE STRIP ───────────────────────────────────────────────────
// Animated left-to-right infinite scrolling strip of real OTT logos
// Placed between ProviderShowcase rails and the Disclaimer section

const MARQUEE_LOGOS: { name: string; url: string }[] = [
  { name: 'Netflix',      url: 'https://image.tmdb.org/t/p/original/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg' },
  { name: 'Prime Video',  url: 'https://image.tmdb.org/t/p/original/emthp39XA2YScoYL1p0sdbAH2WA.jpg' },
  { name: 'Disney+',      url: 'https://image.tmdb.org/t/p/original/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg' },
  { name: 'Hulu',         url: 'https://image.tmdb.org/t/p/original/zxrVdFjIjLqkfnwyghnfywTn3Lh.jpg' },
  { name: 'Crunchyroll',  url: 'https://image.tmdb.org/t/p/original/8Gt1iClBlzTeQs8WQm8UrCoIxnQ.jpg' },
  { name: 'Apple TV+',    url: 'https://image.tmdb.org/t/p/original/peURlLlr8jggOwK53fJ5wdQl05y.jpg' },
  { name: 'Max',          url: 'https://image.tmdb.org/t/p/original/Ajqyt5aNxNx9jp9MukZMVjMEzik.jpg' },
  { name: 'Paramount+',   url: 'https://image.tmdb.org/t/p/original/h5DcR0J2EESLitnhR8xLG1QymTE.jpg' },
  { name: 'Peacock',      url: 'https://image.tmdb.org/t/p/original/xTHltMrZPAJFLQ6qyCBjAnXSmZt.jpg' },
  { name: 'Zee5',         url: 'https://image.tmdb.org/t/p/original/czFpqdOBRSoN9mjjJDGswXFZWfC.jpg' },
  { name: 'JioCinema',    url: 'https://image.tmdb.org/t/p/original/dtFZOUOaB0RYrExAEKREF8lqg7Q.jpg' },
  { name: 'SonyLiv',      url: 'https://image.tmdb.org/t/p/original/mhseqKnkXqLpbDkmNbRRvtaJZPJ.jpg' },
];

function OTTMarquee() {
  return (
    <section style={{
      paddingBlock: '36px 30px',
      borderTop: `1px solid ${C.border}`,
      borderBottom: `1px solid ${C.border}`,
      marginBottom: 40,
      overflow: 'hidden',
      background: 'rgba(15,19,24,0.2)',
    }}>
      {/* Tagline */}
      <p style={{
        margin: '0 0 24px',
        textAlign: 'center',
        fontSize: 11,
        fontWeight: 700,
        color: C.textSub,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        fontFamily: '"Inter", system-ui, sans-serif',
      }}>
        All your streaming OTTs at one place
      </p>

      {/* Marquee wrapper */}
      <div style={{ position: 'relative', overflow: 'hidden', width: '100%' }}>
        {/* Left fade */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 72, zIndex: 2,
          background: `linear-gradient(to right, ${C.bg} 0%, transparent 100%)`,
          pointerEvents: 'none',
        }} />
        {/* Right fade */}
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 72, zIndex: 2,
          background: `linear-gradient(to left, ${C.bg} 0%, transparent 100%)`,
          pointerEvents: 'none',
        }} />

        {/* Scrolling track — doubled for seamless loop */}
        <div style={{
          display: 'flex',
          width: 'max-content',
          animation: 'ott-scroll 34s linear infinite',
        }}>
          {[...MARQUEE_LOGOS, ...MARQUEE_LOGOS].map((logo, i) => (
            <OTTLogoChip key={`${logo.name}-${i}`} logo={logo} />
          ))}
        </div>
      </div>
    </section>
  );
}

const OTTLogoChip = memo(function OTTLogoChip({ logo }: { logo: { name: string; url: string } }) {
  const [err, setErr] = useState(false);
  const [hov, setHov] = useState(false);
  return (
    <div
      title={logo.name}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flexShrink: 0,
        marginInline: 6,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        cursor: 'default',
      }}
    >
      {/* Square tile */}
      <div style={{
        width: 52,
        height: 52,
        borderRadius: 14,
        overflow: 'hidden',
        background: '#111418',
        boxShadow: hov
          ? '0 0 0 2px rgba(255,255,255,0.25), 0 8px 20px rgba(0,0,0,0.5)'
          : '0 3px 0 #090c12, 0 5px 14px rgba(0,0,0,0.55)',
        transform: hov ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'box-shadow 0.18s ease, transform 0.18s ease',
        position: 'relative',
      }}>
        {err ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{
              fontSize: 7, fontWeight: 800, color: 'rgba(248,249,251,0.6)',
              textTransform: 'uppercase', letterSpacing: '0.04em',
              textAlign: 'center', lineHeight: 1.2, padding: 4,
            }}>{logo.name}</span>
          </div>
        ) : (
          <img
            src={logo.url}
            alt={logo.name}
            loading="lazy"
            draggable={false}
            onError={() => setErr(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', userSelect: 'none', filter: 'grayscale(1) brightness(1.05)' }}
          />
        )}
        {/* Shine overlay */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '40%',
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.08) 0%, transparent 100%)',
          pointerEvents: 'none',
        }} />
      </div>
      {/* Name label */}
      <span style={{
        fontSize: 8, fontWeight: 500, color: hov ? C.accent : C.textSub,
        letterSpacing: '0.02em', textAlign: 'center', lineHeight: 1.1,
        maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        transition: 'color 0.18s',
      }}>{logo.name}</span>
    </div>
  );
});

// ─── OTT PROVIDER SELECTOR ────────────────────────────────────────────────────
function OttSelector({
  selected, onSelect, currentTab, onTabChange,
}: {
  selected: string; onSelect: (id: string) => void;
  currentTab: 'movie' | 'tv'; onTabChange: (tab: 'movie' | 'tv') => void;
}) {
  const handleClick = (id: string) => onSelect(selected === id ? 'all' : id);

  return (
    <div style={{ paddingInline: '4vw', marginBottom: 36 }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ width: 3, height: 16, borderRadius: 2, background: 'rgba(255,255,255,0.35)' }} />
        <h2 style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 700,
          color: C.textSub,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          fontFamily: '"Inter", system-ui, sans-serif',
        }}>
          Browse by Provider
        </h2>
      </div>

      {/* Movies / Series tab — solid 3D style */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        {(['movie', 'tv'] as const).map(tab => {
          const label = tab === 'movie' ? 'Movies' : 'Series';
          const active = currentTab === tab;
          return (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              style={{
                padding: '9px 24px', borderRadius: 99, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                color: active ? '#fff' : C.textSub,
                background: active ? '#1a1f2a' : 'transparent',
                border: 'none',
                boxShadow: active
                  ? '0 4px 0 #090c12, 0 2px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)'
                  : 'none',
                transform: active ? 'translateY(-1px)' : 'translateY(0)',
                transition: 'all 0.15s ease',
                WebkitTapHighlightColor: 'transparent',
              }}
            >{label}</button>
          );
        })}
        {selected !== 'all' && (
          <button
            onClick={() => onSelect('all')}
            style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              color: C.textSub, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 2, fontFamily: 'inherit',
            }}
          >
            All providers <ChevronRight size={11} />
          </button>
        )}
      </div>

      {/* Provider logo grid — 3D press buttons with brand colour glow on select */}
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 6 }}>
        {PROVIDERS.map(p => {
          const isSel = selected === p.id;
          const brandColor = PROVIDER_COLORS[p.id] || '#ffffff';
          return (
            <ProviderButton
              key={p.id}
              provider={p}
              selected={isSel}
              brandColor={brandColor}
              onClick={() => handleClick(p.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

// 3D press button for each provider — real logo, brand glow, solid raised feel
const ProviderButton = memo(function ProviderButton({
  provider, selected, brandColor, onClick,
}: {
  provider: ProviderConfig;
  selected: boolean;
  brandColor: string;
  onClick: () => void;
}) {
  const [pressed, setPressed] = useState(false);

  return (
    <button
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      title={provider.name}
      style={{
        flexShrink: 0,
        width: 76,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 7,
        cursor: 'pointer',
        background: 'none',
        border: 'none',
        padding: '2px 0 4px',
        fontFamily: 'inherit',
        WebkitTapHighlightColor: 'transparent',
        transform: pressed ? 'scale(0.93) translateY(2px)' : selected ? 'scale(1.06) translateY(-2px)' : 'scale(1)',
        transition: 'transform 0.12s ease',
      }}
    >
      {/* Logo tile — raised 3D card */}
      <div style={{
        width: 58,
        height: 58,
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
        // 3D raised look: top highlight + bottom shadow
        boxShadow: selected
          ? `0 0 0 2.5px ${brandColor}, 0 6px 0 ${adjustColor(brandColor, -40)}, 0 8px 24px ${brandColor}55`
          : '0 4px 0 #090c12, 0 6px 16px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)',
        transition: 'box-shadow 0.2s ease, transform 0.12s ease',
        background: '#111418',
      }}>
        <ProviderLogo provider={provider} size={58} />
        {/* Top shine */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '45%',
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.1) 0%, transparent 100%)',
          borderRadius: '16px 16px 0 0',
          pointerEvents: 'none',
        }} />
      </div>

      {/* Label below — highlighted when selected */}
      <span style={{
        fontSize: 9,
        fontWeight: selected ? 700 : 500,
        color: selected ? '#fff' : C.textSub,
        letterSpacing: '0.02em',
        textAlign: 'center',
        lineHeight: 1.2,
        maxWidth: 70,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        transition: 'color 0.2s',
      }}>{provider.name}</span>
    </button>
  );
});

// Helper to darken a hex color for the 3D bottom shadow
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amount));
  return `rgb(${r},${g},${b})`;
}

// ─── BROWSE BY GENRE SECTION ──────────────────────────────────────────────────
// Premium genre grid with icon + label tiles — dark minimal aesthetic
const GENRE_TILES: { id: number; label: string; icon: React.ReactNode; movieId?: number; tvId?: number }[] = [
  { id: 28,    label: 'Action',        icon: <Flame size={18} />,   movieId: 28 },
  { id: 35,    label: 'Comedy',        icon: <Laugh size={18} />,   movieId: 35 },
  { id: 27,    label: 'Horror',        icon: <Ghost size={18} />,   movieId: 27 },
  { id: 878,   label: 'Sci-Fi',        icon: <Rocket size={18} />,  movieId: 878 },
  { id: 10749, label: 'Romance',       icon: <Heart size={18} />,   movieId: 10749 },
  { id: 18,    label: 'Drama',         icon: <Drama size={18} />,   movieId: 18 },
  { id: 53,    label: 'Thriller',      icon: <Film size={18} />,    movieId: 53 },
  { id: 16,    label: 'Animation',     icon: <Sparkles size={18} />,movieId: 16 },
  { id: 80,    label: 'Crime',         icon: <Shield size={18} />,  movieId: 80 },
  { id: 14,    label: 'Fantasy',       icon: <Star size={18} />,    movieId: 14 },
  { id: 10751, label: 'Family',        icon: <Tv size={18} />,      movieId: 10751 },
  { id: 36,    label: 'History',       icon: <Film size={18} />,    movieId: 36 },
];

function BrowseByGenre({ onGenreSelect }: { onGenreSelect: (genreId: number, label: string) => void }) {
  const [activeGenre, setActiveGenre] = useState<number | null>(null);

  const handleSelect = (g: typeof GENRE_TILES[0]) => {
    setActiveGenre(g.id);
    onGenreSelect(g.id, g.label);
  };

  return (
    <div style={{ paddingInline: '4vw', marginBottom: 44 }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
        <div style={{ width: 3, height: 16, borderRadius: 2, background: 'rgba(255,255,255,0.35)' }} />
        <h2 style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 700,
          color: C.textSub,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          fontFamily: '"Inter", system-ui, sans-serif',
        }}>
          Browse by Genre
        </h2>
      </div>

      {/* Genre grid — 4 per row on mobile */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 10,
      }}>
        {GENRE_TILES.map(g => {
          const isActive = activeGenre === g.id;
          return (
            <button
              key={g.id}
              onClick={() => handleSelect(g)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '14px 8px',
                borderRadius: 16,
                cursor: 'pointer',
                border: `1px solid ${isActive ? 'rgba(255,255,255,0.2)' : C.border}`,
                background: isActive
                  ? 'rgba(248,249,251,0.1)'
                  : 'rgba(15,19,24,0.7)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                boxShadow: isActive
                  ? '0 4px 0 rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06) inset'
                  : '0 3px 0 rgba(0,0,0,0.4), 0 6px 16px rgba(0,0,0,0.35)',
                transform: isActive ? 'translateY(-2px) scale(1.03)' : 'translateY(0) scale(1)',
                transition: 'all 0.18s cubic-bezier(0.2,0.8,0.2,1)',
                color: isActive ? C.text : C.textSub,
                fontFamily: 'inherit',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: 10,
                background: isActive ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
                color: isActive ? C.text : C.textSub,
                transition: 'all 0.18s ease',
              }}>
                {g.icon}
              </span>
              <span style={{
                fontSize: 10,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? C.text : C.textSub,
                letterSpacing: '0.02em',
                textAlign: 'center',
                lineHeight: 1.2,
                transition: 'color 0.18s ease',
                fontFamily: '"Inter", system-ui, sans-serif',
              }}>
                {g.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── HERO SLIDE ───────────────────────────────────────────────────────────────
function HeroSlide({ item, onWatch }: { item: CineItem; onWatch: (item: CineItem) => void }) {
  const [imgOk, setImgOk] = useState(false);
  return (
    <div style={{
      flexShrink: 0, width: '100%', height: 'min(85vh, 640px)',
      position: 'relative', overflow: 'hidden', background: C.bg,
      scrollSnapAlign: 'start', scrollSnapStop: 'always',
    }}>
      {item.backdrop && (
        <img
          src={item.backdrop} alt=""
          onLoad={() => setImgOk(true)}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center top',
            opacity: imgOk ? 1 : 0, transition: 'opacity 0.35s ease',
          }}
        />
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(7,9,13,1) 0%, rgba(7,9,13,0.65) 40%, rgba(7,9,13,0.05) 100%)' }} />
      <div style={{ position: 'absolute', bottom: '14%', left: '5%', right: '5%', maxWidth: 540, zIndex: 2 }}>
        <h1 style={{ margin: '0 0 10px', fontSize: 'clamp(24px, 5vw, 48px)', fontWeight: 800, color: C.text, lineHeight: 1.1, letterSpacing: '-0.03em', fontFamily: '"Outfit", "Inter", system-ui, sans-serif' }}>{item.title}</h1>
        <p style={{ margin: '0 0 22px', fontSize: 13, color: C.textSub, lineHeight: 1.65, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontFamily: '"Inter", system-ui, sans-serif' }}>{item.overview}</p>
        <button
          onClick={() => onWatch(item)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '11px 26px', borderRadius: 10,
            background: C.text, border: 'none', fontSize: 13, fontWeight: 700, color: C.bg,
            cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <Play size={14} fill={C.bg} color={C.bg} /> Watch Now
        </button>
      </div>
    </div>
  );
}

// ─── HERO CAROUSEL ────────────────────────────────────────────────────────────
function Hero({ items, onWatch }: { items: CineItem[]; onWatch: (item: CineItem) => void; onDetails: (item: CineItem) => void }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const slides = Array.from(container.children) as HTMLElement[];
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const i = slides.indexOf(e.target as HTMLElement);
          if (i !== -1) setActiveIdx(i);
        }
      });
    }, { root: container, threshold: 0.6 });
    slides.forEach(s => obs.observe(s));
    return () => obs.disconnect();
  }, [items.length]);

  const scrollTo = (i: number) => {
    const el = scrollRef.current?.children[i] as HTMLElement;
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
  };

  if (!items.length) return <SkeletonHero />;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div ref={scrollRef} style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}>
        {items.map(item => <HeroSlide key={item.tmdb_id} item={item} onWatch={onWatch} />)}
      </div>
      <div style={{
        position: 'absolute', bottom: '6%', left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 5, zIndex: 2,
        background: 'rgba(7,9,13,0.35)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        padding: '5px 10px', borderRadius: 99,
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        {items.map((_, i) => (
          <button
            key={i}
            onClick={() => scrollTo(i)}
            style={{
              width: i === activeIdx ? 22 : 5, height: 5, borderRadius: 3,
              background: i === activeIdx ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.22)',
              border: 'none', cursor: 'pointer', padding: 0,
              transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1), background 0.2s',
              WebkitTapHighlightColor: 'transparent',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── SEARCH LIST ROW ──────────────────────────────────────────────────────────
function SearchListRow({ item, rank, onClick }: { item: CineItem; rank: number; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '10px 12px', borderRadius: 8,
        width: '100%', textAlign: 'left',
        background: hov ? C.surface : 'transparent',
        border: `1px solid ${hov ? C.borderHov : 'transparent'}`,
        cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s', fontFamily: 'inherit',
      }}
    >
      <span style={{ fontSize: 12, color: C.textSub, width: 18, textAlign: 'center', flexShrink: 0 }}>{rank}</span>
      <div style={{ flexShrink: 0, width: 44, height: 64, borderRadius: 5, overflow: 'hidden', background: C.elevated, position: 'relative' }}>
        {item.poster && (
          <img src={item.poster} alt={item.title} loading="lazy" onLoad={() => setImgLoaded(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: imgLoaded ? 1 : 0 }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.text, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{item.title}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 12, color: C.textSub }}>{item.year || '—'}</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: C.textSub, padding: '1px 6px', borderRadius: 3, border: `1px solid ${C.border}` }}>
            {item.type === 'movie' ? 'Movie' : 'TV'}
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── SEARCH OVERLAY ───────────────────────────────────────────────────────────
function SearchOverlay({ onClose, onSelect }: { onClose: () => void; onSelect: (item: CineItem) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    window.history.pushState({ searchOverlay: true }, '');
    const handlePop = () => onClose();
    window.addEventListener('popstate', handlePop);
    return () => {
      window.removeEventListener('popstate', handlePop);
      if (window.history.state?.searchOverlay) window.history.replaceState(null, document.title);
    };
  }, [onClose]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await tmdb.search(query, 1);
        if (!data?.results) { setResults([]); return; }
        const items: CineItem[] = data.results
          .filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv')
          .slice(0, 12)
          .map((r: any) => normTmdbItem(r, r.media_type as 'movie' | 'tv'))
          .filter((i: CineItem) => i.tmdb_id && i.poster);
        setResults(items);
      } finally { setLoading(false); }
    }, 350);
    return () => clearTimeout(id);
  }, [query]);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(7,9,13,0.97)', backdropFilter: 'blur(16px)', display: 'flex', flexDirection: 'column' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ padding: '20px 6vw 20px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onClose} style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 8, ...G.light, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: C.text, border: `1px solid ${C.border}` }}>
            <ChevronLeft size={18} />
          </button>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={17} color={C.textSub} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search movies and TV shows…"
              style={{ width: '100%', padding: '12px 44px 12px 42px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 16, color: C.text, outline: 'none', fontFamily: 'inherit' }}
            />
          </div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 6vw' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {!loading && results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {results.map((item, idx) => (
                <SearchListRow key={`${item.type}-${item.tmdb_id}`} item={item} rank={idx + 1} onClick={() => { onSelect(item); onClose(); }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CONTINUE WATCHING RAIL ───────────────────────────────────────────────────
function ContinueWatchingRail({ onPlay, onRemove }: {
  onPlay:   (entry: ContinueWatchingEntry) => void;
  onRemove: (tmdbId: number) => void;
}) {
  const [entries, setEntries] = useState<ContinueWatchingEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: 'l' | 'r') => scrollRef.current?.scrollBy({ left: dir === 'l' ? -400 : 400, behavior: 'smooth' });

  useEffect(() => {
    setEntries(getContinueWatching());
    const handler = () => setEntries(getContinueWatching());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const handleRemove = (tmdbId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    removeContinueWatchingEntry(tmdbId);
    setEntries(getContinueWatching());
    onRemove(tmdbId);
  };

  if (!entries.length) return null;

  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingInline: '4vw', marginBottom: 14 }}>
        <span style={{ color: C.textSub }}><Clock size={14} /></span>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>Continue Watching</h2>
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', left: '1vw', top: '50%', transform: 'translateY(-50%)', zIndex: 4 }}>
          <GlassArrow dir="l" onClick={() => scroll('l')} />
        </div>
        <div ref={scrollRef} style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingInline: '4vw', scrollbarWidth: 'none', paddingBottom: 4 }}>
          {entries.map(entry => {
            const { item, season, episode } = entry;
            return (
              <div
                key={item.tmdb_id}
                style={{ flexShrink: 0, width: 190, borderRadius: 12, overflow: 'hidden', ...G.light, position: 'relative', cursor: 'pointer' }}
                onClick={() => onPlay(entry)}
              >
                <div style={{ width: '100%', aspectRatio: '16/9', position: 'relative', overflow: 'hidden', background: C.elevated }}>
                  {item.backdrop && <img src={item.backdrop} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(7,9,13,0.8) 0%, transparent 60%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Play size={12} fill={C.bg} color={C.bg} style={{ marginLeft: 1 }} />
                    </div>
                  </div>
                  <div style={{ position: 'absolute', bottom: 6, left: 8, fontSize: 9, fontWeight: 700, color: C.text, background: 'rgba(7,9,13,0.8)', padding: '2px 6px', borderRadius: 4 }}>
                    {item.type === 'movie' ? 'Movie' : item.isAnime ? `Ep ${episode}` : `S${season}·E${episode}`}
                  </div>
                  <button onClick={e => handleRemove(item.tmdb_id, e)}
                    style={{ position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: '50%', background: 'rgba(7,9,13,0.7)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: C.textSub }}>
                    <Trash2 size={10} />
                  </button>
                </div>
                <div style={{ padding: '8px 10px' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ position: 'absolute', right: '1vw', top: '50%', transform: 'translateY(-50%)', zIndex: 4 }}>
          <GlassArrow dir="r" onClick={() => scroll('r')} />
        </div>
      </div>
    </section>
  );
}

// ─── DISCLAIMER SECTION ───────────────────────────────────────────────────────
function DisclaimerSection() {
  const badges = [
    { icon: <Shield size={13} />,      label: 'Third-party Content' },
    { icon: <Film size={13} />,        label: 'No File Hosting' },
    { icon: <AlertCircle size={13} />, label: 'DMCA Compliant' },
  ];

  return (
    <section style={{
      marginInline: '4vw',
      marginBottom: 40,
      borderRadius: 20,
      padding: '0',
      position: 'relative',
      overflow: 'hidden',
      background: C.surface,
      border: `1px solid ${C.border}`,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      {/* Subtle neutral accent bar at top — no rainbow gradient */}
      <div style={{
        height: 2,
        background: 'rgba(248,249,251,0.14)',
        width: '100%',
      }} />

      <div style={{ padding: '22px 22px 20px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: C.elevated,
            border: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <AlertCircle size={17} color={C.text} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>
              Important Disclaimer
            </h3>
            <p style={{ margin: 0, fontSize: 11, color: C.textSub, marginTop: 2, fontWeight: 500 }}>
              Content Aggregator · Not a Host
            </p>
          </div>
        </div>

        {/* Body */}
        <p style={{
          margin: '0 0 18px', fontSize: 12, color: 'rgba(135,145,160,0.9)', lineHeight: 1.8,
          fontWeight: 400,
        }}>
          Cineverse operates as a content aggregator and does not host any media files on our servers.
          All content is sourced from third-party providers and embedded services. For copyright
          concerns or DMCA takedown requests, contact the respective content providers directly.
        </p>

        {/* Monochrome badges — consistent glass style, no rainbow colours */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {badges.map(b => (
            <div key={b.label} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 13px', borderRadius: 99,
              background: C.elevated,
              border: `1px solid ${C.border}`,
              fontSize: 11, fontWeight: 600, color: C.textSub,
            }}>
              <span style={{ color: C.textSub, display: 'flex' }}>{b.icon}</span>
              {b.label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── BOTTOM NAV BAR ───────────────────────────────────────────────────────────
// Fixed to bottom of screen — sits below all content with safe-area inset
function FloatingBottomDock({ onSearchOpen }: { onSearchOpen: () => void }) {
  const navigate = useNavigate();
  const [active, setActive] = useState<'home' | 'search' | 'browse'>('home');

  return (
    <div style={{
      position: 'fixed',
      bottom: 0, left: 0, right: 0,
      zIndex: 60,
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      background: 'rgba(7,9,13,0.92)',
      backdropFilter: 'blur(32px)',
      WebkitBackdropFilter: 'blur(32px)',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.45)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        height: 60, paddingInline: 8,
      }}>
        {/* Home */}
        <DockButton
          icon={<Home size={20} />}
          label="Home"
          active={active === 'home'}
          onClick={() => { setActive('home'); navigate('/'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        />

        {/* Logo wordmark center */}
        <button
          onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '6px 14px', borderRadius: 99,
            fontFamily: 'inherit',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 900, color: C.text, letterSpacing: '-0.05em', lineHeight: 1, fontFamily: '"Outfit", "Inter", system-ui, sans-serif' }}>
            Cine<span style={{ color: C.textSub, fontWeight: 300 }}>verse</span>
          </span>
        </button>

        {/* Search */}
        <DockButton
          icon={<Search size={20} />}
          label="Search"
          active={active === 'search'}
          onClick={() => { setActive('search'); onSearchOpen(); }}
        />

        {/* Browse */}
        <DockButton
          icon={<Compass size={20} />}
          label="Browse"
          active={active === 'browse'}
          onClick={() => { setActive('browse'); navigate('/browse'); }}
        />
      </div>
    </div>
  );
}

function DockButton({
  icon, label, active, onClick,
}: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        padding: '6px 16px', borderRadius: 12,
        background: 'transparent',
        border: 'none', cursor: 'pointer',
        color: active ? C.text : C.textSub,
        transition: 'color 0.18s ease', fontFamily: 'inherit',
        minWidth: 56,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {icon}
      <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.04em', lineHeight: 1 }}>{label}</span>
    </button>
  );
}

// ─── FLOATING GLASS NAVBAR ────────────────────────────────────────────────────
// True floating — margin from all edges, rounded rectangle, glassmorphism
function Nav({ onSearchOpen }: { onSearchOpen: () => void }) {
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const fn = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const atTop = scrollY < 20;

  return (
    <nav style={{
      // FLOATING — not full width, margins on all sides
      position: 'fixed',
      top: atTop ? 14 : 10,
      left: atTop ? '4vw' : '3vw',
      right: atTop ? '4vw' : '3vw',
      zIndex: 50,

      // Rounded rectangle
      borderRadius: 18,

      height: atTop ? 58 : 52,
      padding: '0 16px',

      // Glassmorphism
      background: atTop
        ? 'rgba(15,19,24,0.55)'
        : 'rgba(7,9,13,0.82)',
      backdropFilter: 'blur(32px)',
      WebkitBackdropFilter: 'blur(32px)',
      border: `1px solid ${atTop ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.1)'}`,
      boxShadow: atTop
        ? '0 4px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)'
        : '0 8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)',

      transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      {/* Logo */}
      <button
        onClick={() => navigate('/')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 17, fontWeight: 900, color: C.text, letterSpacing: '-0.05em',
          padding: 0, flex: 1, textAlign: 'left', fontFamily: '"Outfit", "Inter", system-ui, sans-serif',
          WebkitTapHighlightColor: 'transparent', lineHeight: 1,
        }}
      >
        Cine<span style={{ color: C.textSub, fontWeight: 300 }}>verse</span>
      </button>

      {/* Search button */}
      <button
        onClick={onSearchOpen}
        aria-label="Search"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 10,
          background: 'rgba(248,249,251,0.07)',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          color: C.text, cursor: 'pointer',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
          transition: 'background 0.15s, border-color 0.15s',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <Search size={15} />
      </button>
    </nav>
  );
}

// ─── HOME PAGE ────────────────────────────────────────────────────────────────
export default function CineverseHome() {
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedOtt, setSelectedOtt] = useState('all');
  const [currentOttTab, setCurrentOttTab] = useState<'movie' | 'tv'>('movie');
  const [selectedGenre, setSelectedGenre] = useState<{ id: number; label: string } | null>(null);
  const [genreItems, setGenreItems] = useState<CineItem[]>([]);
  const [loadingGenre, setLoadingGenre] = useState(false);

  // Base content
  const [heroItems,      setHeroItems]      = useState<CineItem[]>([]);
  const [trendingMovies, setTrendingMovies] = useState<CineItem[]>([]);
  const [trendingShows,  setTrendingShows]  = useState<CineItem[]>([]);
  const [popularMovies,  setPopularMovies]  = useState<CineItem[]>([]);
  const [popularShows,   setPopularShows]   = useState<CineItem[]>([]);
  const [topRated,       setTopRated]       = useState<CineItem[]>([]);
  const [upcoming,       setUpcoming]       = useState<CineItem[]>([]);

  const [loadingHero,    setLoadingHero]    = useState(true);
  const [loadingTrendM,  setLoadingTrendM]  = useState(true);
  const [loadingTrendS,  setLoadingTrendS]  = useState(true);
  const [loadingPopM,    setLoadingPopM]    = useState(true);
  const [loadingPopS,    setLoadingPopS]    = useState(true);
  const [loadingTopR,    setLoadingTopR]    = useState(true);
  const [loadingUpcoming,setLoadingUpcoming]= useState(true);

  // Provider-specific fetched content (re-fetched on provider change)
  const [providerMovies, setProviderMovies] = useState<CineItem[]>([]);
  const [providerShows,  setProviderShows]  = useState<CineItem[]>([]);
  const [loadingProvider, setLoadingProvider] = useState(false);

  // Netflix / Prime showcase rows — real TMDB discover fetch, 10 items each
  const [netflixItems,   setNetflixItems]   = useState<CineItem[]>([]);
  const [primeItems,     setPrimeItems]     = useState<CineItem[]>([]);
  const [loadingNetflix, setLoadingNetflix] = useState(true);
  const [loadingPrime,   setLoadingPrime]   = useState(true);

  const [cwKey, setCwKey] = useState(0);

  // Deduped pools across all base movie/show fetches — used for genre rows
  const moviePool = useMemo(() => {
    const map = new Map<number, CineItem>();
    [...trendingMovies, ...popularMovies, ...topRated, ...upcoming].forEach(i => map.set(i.tmdb_id, i));
    return Array.from(map.values());
  }, [trendingMovies, popularMovies, topRated, upcoming]);

  const showPool = useMemo(() => {
    const map = new Map<number, CineItem>();
    [...trendingShows, ...popularShows].forEach(i => map.set(i.tmdb_id, i));
    return Array.from(map.values());
  }, [trendingShows, popularShows]);

  const byGenre = (pool: CineItem[], genre: string, limit = 20) =>
    pool.filter(i => i.genres.includes(genre)).slice(0, limit);

  // Movie genre rows
  const actionMovies    = byGenre(moviePool, 'Action', 20);
  const comedyMovies    = byGenre(moviePool, 'Comedy', 20);
  const horrorMovies    = byGenre(moviePool, 'Horror', 20);
  const scifiMovies     = byGenre(moviePool, 'Sci-Fi', 20);
  const thrillerMovies  = byGenre(moviePool, 'Thriller', 20);
  const romanceMovies   = byGenre(moviePool, 'Romance', 20);
  const dramaMovies     = byGenre(moviePool, 'Drama', 20);
  const animationMovies = moviePool.filter(i => i.genres.includes('Animation') || i.genres.includes('Family')).slice(0, 20);

  // TV genre rows
  const actionShows     = byGenre(showPool, 'Action & Adventure', 20);
  const comedyShows     = byGenre(showPool, 'Comedy', 20);
  const crimeShows      = byGenre(showPool, 'Crime', 20);
  const dramaShows      = byGenre(showPool, 'Drama', 20);
  const animationShows  = showPool.filter(i => i.genres.includes('Animation') || i.genres.includes('Kids')).slice(0, 20);

  const netflixProvider = PROVIDERS.find(p => p.id === 'netflix')!;
  const primeProvider   = PROVIDERS.find(p => p.id === 'prime')!;

  // ── Base data fetch (on mount) ──────────────────────────────────────────────
  useEffect(() => {
    tmdb.getTrending('movie').then(d => {
      const items = normPage(d, 'movie', 8).filter((i: CineItem) => i.backdrop);
      setHeroItems(items); setLoadingHero(false);
    }).catch(() => setLoadingHero(false));

    tmdb.getTrending('movie').then(d => {
      setTrendingMovies(normPage(d, 'movie', 30)); setLoadingTrendM(false);
    }).catch(() => setLoadingTrendM(false));

    tmdb.getTrending('tv').then(d => {
      setTrendingShows(normPage(d, 'tv', 30)); setLoadingTrendS(false);
    }).catch(() => setLoadingTrendS(false));

    tmdb.getPopular('movie').then(d => {
      setPopularMovies(normPage(d, 'movie', 30)); setLoadingPopM(false);
    }).catch(() => setLoadingPopM(false));

    tmdb.getPopular('tv').then(d => {
      setPopularShows(normPage(d, 'tv', 30)); setLoadingPopS(false);
    }).catch(() => setLoadingPopS(false));

    tmdb.getTopRated('movie').then(d => {
      setTopRated(normPage(d, 'movie', 30)); setLoadingTopR(false);
    }).catch(() => setLoadingTopR(false));

    tmdb.getUpcoming().then(d => {
      setUpcoming(normPage(d, 'movie', 20)); setLoadingUpcoming(false);
    }).catch(() => setLoadingUpcoming(false));
  }, []);

  // ── Netflix / Prime showcase fetch — real discover, 10 items each ──────────
  useEffect(() => {
    setLoadingNetflix(true);
    fetchProviderTop10(netflixProvider.tmdbId)
      .then(items => setNetflixItems(items))
      .finally(() => setLoadingNetflix(false));

    setLoadingPrime(true);
    fetchProviderTop10(primeProvider.tmdbId)
      .then(items => setPrimeItems(items))
      .finally(() => setLoadingPrime(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fallback for Netflix/Prime if the real discover call failed/returned empty ──
  useEffect(() => {
    if (loadingNetflix || netflixItems.length > 0) return;
    if (!moviePool.length && !showPool.length) return;
    const pool = [...filterItemsByOtt(moviePool, 'netflix', 'movie'), ...filterItemsByOtt(showPool, 'netflix', 'tv')];
    if (pool.length) setNetflixItems(pool.slice(0, 10));
  }, [loadingNetflix, netflixItems.length, moviePool, showPool]);

  useEffect(() => {
    if (loadingPrime || primeItems.length > 0) return;
    if (!moviePool.length && !showPool.length) return;
    const pool = [...filterItemsByOtt(moviePool, 'prime', 'movie'), ...filterItemsByOtt(showPool, 'prime', 'tv')];
    if (pool.length) setPrimeItems(pool.slice(0, 10));
  }, [loadingPrime, primeItems.length, moviePool, showPool]);

  // ── Provider fetch — real TMDB discover per provider ───────────────────────
  useEffect(() => {
    if (selectedOtt === 'all') {
      setProviderMovies([]);
      setProviderShows([]);
      return;
    }

    const provider = PROVIDERS.find(p => p.id === selectedOtt);
    if (!provider) return;

    setLoadingProvider(true);

    Promise.all([
      tmdbDiscover('movie', provider.tmdbId),
      tmdbDiscover('tv',    provider.tmdbId),
    ]).then(([moviesData, showsData]) => {
      // Use real discover data if available, else hash-filter fallback
      const movies = moviesData
        ? normPage(moviesData, 'movie', 20)
        : filterItemsByOtt([...trendingMovies, ...popularMovies], selectedOtt, 'movie');

      const shows = showsData
        ? normPage(showsData, 'tv', 20)
        : filterItemsByOtt([...trendingShows, ...popularShows], selectedOtt, 'tv');

      setProviderMovies(movies);
      setProviderShows(shows);
    }).finally(() => setLoadingProvider(false));
  }, [selectedOtt]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Genre fetch — real TMDB discover by genre id ────────────────────────────
  const handleGenreSelect = useCallback(async (genreId: number, label: string) => {
    setSelectedGenre(g => g?.id === genreId ? null : { id: genreId, label });
    if (selectedGenre?.id === genreId) { setGenreItems([]); return; }
    setLoadingGenre(true);
    try {
      const base = 'https://api.themoviedb.org/3';
      const params = `with_genres=${genreId}&sort_by=popularity.desc&page=1`;
      const token = (import.meta as any).env?.VITE_TMDB_TOKEN || (import.meta as any).env?.VITE_TMDB_READ_ACCESS_TOKEN || '';
      const key   = (import.meta as any).env?.VITE_TMDB_API_KEY || (import.meta as any).env?.VITE_TMDB_KEY || '';
      let data: any = null;
      if (token) {
        const r = await fetch(`${base}/discover/movie?${params}`, { headers: { Authorization: `Bearer ${token}` } });
        if (r.ok) data = await r.json();
      } else if (key) {
        const r = await fetch(`${base}/discover/movie?${params}&api_key=${key}`);
        if (r.ok) data = await r.json();
      }
      if (data) setGenreItems(normPage(data, 'movie', 20));
      else {
        // Fallback: filter from existing moviePool
        setGenreItems(moviePool.filter(i => i.genres.some(g => g.toLowerCase().includes(label.toLowerCase()))).slice(0, 20));
      }
    } catch {
      setGenreItems(moviePool.filter(i => i.genres.some(g => g.toLowerCase().includes(label.toLowerCase()))).slice(0, 20));
    } finally {
      setLoadingGenre(false);
    }
  }, [selectedGenre, moviePool]);

  const goPlay = useCallback((itemOrEntry: CineItem | ContinueWatchingEntry) => {
    const isCwEntry = 'item' in itemOrEntry && 'episode' in itemOrEntry;
    if (isCwEntry) {
      const entry = itemOrEntry as ContinueWatchingEntry;
      navigate(`/player/${entry.item.type === 'movie' ? 'movie' : entry.item.isAnime ? 'anime' : 'show'}/${entry.item.tmdb_id}`, {
        state: { item: entry.item, resumeSeason: entry.season, resumeEpisode: entry.episode },
      });
    } else {
      const item = itemOrEntry as CineItem;
      navigate(`/player/${item.type === 'movie' ? 'movie' : 'show'}/${item.tmdb_id}`, { state: { item } });
    }
  }, [navigate]);

  const goPlayItem = useCallback((item: CineItem) => goPlay(item), [goPlay]);
  const goDetails  = useCallback((item: CineItem) => {
    navigate(`/details/${item.type}/${item.tmdb_id}`, { state: { item } });
  }, [navigate]);

  // Provider display content — use fetched data or fallback
  const displayMovies = selectedOtt !== 'all' && providerMovies.length > 0
    ? providerMovies
    : currentOttTab === 'movie'
      ? trendingMovies
      : trendingShows;

  const displayShows = selectedOtt !== 'all' && providerShows.length > 0
    ? providerShows
    : popularShows;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: '"Inter", system-ui, sans-serif', overflowX: 'hidden' }}>

      {/* ── Floating Glass Navbar ── */}
      <Nav onSearchOpen={() => setSearchOpen(true)} />

      {/* ── 1. Hero Carousel ── */}
      {loadingHero
        ? <SkeletonHero />
        : <Hero items={heroItems} onWatch={goPlayItem} onDetails={goDetails} />
      }

      <div style={{ paddingTop: 32, paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>

        {/* ── 2. Continue Watching ── */}
        <ContinueWatchingRail key={cwKey} onPlay={goPlay} onRemove={() => setCwKey(k => k + 1)} />

        {/* ── 3. Top 10 Movies Banner ── */}
        <TopTenRail title="Movies" items={trendingMovies} loading={loadingTrendM} onItemClick={goPlayItem} />

        {/* ── 4. Top 10 Series Banner ── */}
        <TopTenRail title="Series" items={trendingShows} loading={loadingTrendS} onItemClick={goPlayItem} />

        {/* ── 5. Netflix Most Watched — MediaCard, real top-10 discover fetch ── */}
        <ProviderShowcase
          provider={netflixProvider}
          items={netflixItems}
          loading={loadingNetflix}
          onItemClick={goPlayItem}
        />

        {/* ── 6. Genre rows, spaced out between the provider showcases ── */}
        <Rail title="Action & Adventure" icon={<Flame size={14} />} items={actionMovies}   loading={loadingPopM} onItemClick={goPlayItem} />
        <Rail title="Comedy Picks"       icon={<Laugh size={14} />} items={comedyMovies}   loading={loadingPopM} onItemClick={goPlayItem} />

        {/* ── 7. Prime Video Picks — MediaCard, real top-10 discover fetch ── */}
        <ProviderShowcase
          provider={primeProvider}
          items={primeItems}
          loading={loadingPrime}
          onItemClick={goPlayItem}
        />

        <Rail title="Horror Nights"      icon={<Ghost size={14} />}  items={horrorMovies}  loading={loadingPopM} onItemClick={goPlayItem} />
        <Rail title="Sci-Fi & Fantasy"   icon={<Rocket size={14} />} items={scifiMovies}   loading={loadingPopM} onItemClick={goPlayItem} />

        {/* ── 8. Provider Selector + Tab ── */}
        <OttSelector
          selected={selectedOtt}
          onSelect={id => setSelectedOtt(id)}
          currentTab={currentOttTab}
          onTabChange={tab => setCurrentOttTab(tab)}
        />

        {/* ── 8b. Browse by Genre ── */}
        <BrowseByGenre onGenreSelect={handleGenreSelect} />

        {/* ── 8c. Genre Results Rail (appears when a genre is selected) ── */}
        {selectedGenre && (
          <Rail
            title={`${selectedGenre.label} Films`}
            icon={<Sparkles size={14} />}
            items={genreItems}
            loading={loadingGenre}
            onItemClick={goPlayItem}
          />
        )}

        {/* ── 9. Provider / Tab Content Rails ── */}
        {loadingProvider ? (
          /* Loading state when provider changes */
          <>
            <div style={{ height: 220, marginInline: '4vw', borderRadius: 14, marginBottom: 40 }} className="cv-sk" />
            <div style={{ height: 220, marginInline: '4vw', borderRadius: 14, marginBottom: 40 }} className="cv-sk" />
          </>
        ) : selectedOtt !== 'all' ? (
          /* Provider-specific content — real fetched data */
          <>
            <Rail
              title={`Trending on ${PROVIDERS.find(p => p.id === selectedOtt)?.name || selectedOtt}`}
              icon={<TrendingUp size={14} />}
              items={currentOttTab === 'movie' ? providerMovies : providerShows}
              loading={false}
              onItemClick={goPlayItem}
            />
            <Rail
              title="Top Rated Picks"
              icon={<Star size={14} />}
              items={filterItemsByOtt(topRated, selectedOtt, currentOttTab)}
              loading={loadingTopR}
              onItemClick={goPlayItem}
            />
            <Rail
              title="Popular Titles"
              icon={<Film size={14} />}
              items={currentOttTab === 'movie' ? providerMovies.slice(10) : providerShows.slice(10)}
              loading={false}
              onItemClick={goPlayItem}
            />
          </>
        ) : currentOttTab === 'movie' ? (
          <>
            <Rail title="Trending Movies"     icon={<TrendingUp size={14} />} items={trendingMovies}  loading={loadingTrendM}   onItemClick={goPlayItem} />
            <Rail title="Popular Movies"      icon={<Film size={14} />}       items={popularMovies}   loading={loadingPopM}     onItemClick={goPlayItem} />
            <Rail title="Top Rated"           icon={<Star size={14} />}       items={topRated}        loading={loadingTopR}     onItemClick={goPlayItem} />
            <Rail title="Coming Soon"         icon={<Film size={14} />}       items={upcoming}        loading={loadingUpcoming} onItemClick={goPlayItem} />
            {dramaMovies.length > 0 && (
              <Rail title="Drama"               icon={<Drama size={14} />}    items={dramaMovies}     loading={loadingPopM}     onItemClick={goPlayItem} />
            )}
            {thrillerMovies.length > 0 && (
              <Rail title="Thrillers"           icon={<Tv size={14} />}       items={thrillerMovies}  loading={loadingPopM}     onItemClick={goPlayItem} />
            )}
            {romanceMovies.length > 0 && (
              <Rail title="Romance"             icon={<Heart size={14} />}    items={romanceMovies}   loading={loadingPopM}     onItemClick={goPlayItem} />
            )}
            {animationMovies.length > 0 && (
              <Rail title="Animation & Cartoons" icon={<Tv size={14} />}     items={animationMovies} loading={loadingPopM}     onItemClick={goPlayItem} />
            )}
          </>
        ) : (
          <>
            <Rail title="Trending Series"    icon={<TrendingUp size={14} />} items={trendingShows}   loading={loadingTrendS}  onItemClick={goPlayItem} />
            <Rail title="Popular Series"     icon={<Tv size={14} />}         items={popularShows}    loading={loadingPopS}    onItemClick={goPlayItem} />
            {actionShows.length > 0 && (
              <Rail title="Action & Adventure" icon={<Flame size={14} />}   items={actionShows}     loading={loadingPopS}    onItemClick={goPlayItem} />
            )}
            {comedyShows.length > 0 && (
              <Rail title="Comedy Series"      icon={<Laugh size={14} />}   items={comedyShows}     loading={loadingPopS}    onItemClick={goPlayItem} />
            )}
            {crimeShows.length > 0 && (
              <Rail title="Crime Drama"        icon={<Drama size={14} />}   items={crimeShows}      loading={loadingPopS}    onItemClick={goPlayItem} />
            )}
            {dramaShows.length > 0 && (
              <Rail title="Drama Series"       icon={<Drama size={14} />}   items={dramaShows}      loading={loadingPopS}    onItemClick={goPlayItem} />
            )}
            {animationShows.length > 0 && (
              <Rail title="Animated Series"  icon={<Tv size={14} />}         items={animationShows}  loading={loadingPopS}    onItemClick={goPlayItem} />
            )}
          </>
        )}

        {/* ── 10. OTT Marquee Strip ── */}
        <OTTMarquee />

        {/* ── 11. Disclaimer Section ── */}
        <DisclaimerSection />
      </div>

      {/* ── Footer ── */}
      <footer style={{
        borderTop: `1px solid ${C.border}`, padding: '32px 4vw 96px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center',
      }}>
        <span style={{ fontSize: 14, fontWeight: 900, color: C.text, letterSpacing: '-0.05em', fontFamily: '"Outfit", "Inter", system-ui, sans-serif' }}>
          Cine<span style={{ color: C.textSub, fontWeight: 300 }}>verse</span>
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            {
              name: 'Telegram', href: 'https://t.me/Cineverseofc', fill: '#fff',
              path: 'M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.568 8.16-1.78 8.395c-.134.6-.485.748-.984.466l-2.72-2.004-1.312 1.264c-.145.145-.267.267-.546.267l.195-2.79 5.08-4.59c.221-.196-.048-.305-.34-.109l-6.276 3.95-2.704-.845c-.587-.183-.598-.587.122-.87l10.566-4.07c.49-.183.918.109.76.844z',
            },
            {
              name: 'Instagram', href: 'https://instagram.com/cineverseofc', fill: '#fff',
              path: 'M12 2c2.717 0 3.056.01 4.122.06 1.065.05 1.79.217 2.428.465.66.256 1.216.6 1.772 1.153.553.553.9 1.11 1.153 1.772.247.637.415 1.363.465 2.428.05 1.066.06 1.405.06 4.122s-.01 3.056-.06 4.122c-.05 1.065-.218 1.79-.465 2.428a4.9 4.9 0 0 1-1.153 1.772c-.553.553-1.11.9-1.772 1.153-.637.247-1.363.415-2.428.465-1.066.05-1.405.06-4.122.06s-3.056-.01-4.122-.06c-1.065-.05-1.79-.218-2.428-.465a4.9 4.9 0 0 1-1.772-1.153 4.9 4.9 0 0 1-1.153-1.772c-.247-.637-.415-1.363-.465-2.428C2.01 15.056 2 14.717 2 12s.01-3.056.06-4.122c.05-1.065.218-1.79.465-2.428a4.9 4.9 0 0 1 1.153-1.772A4.9 4.9 0 0 1 5.45 2.525c.637-.247 1.363-.415 2.428-.465C8.944 2.01 9.283 2 12 2zm0 5.838a4.162 4.162 0 1 0 0 8.324 4.162 4.162 0 0 0 0-8.324zm0 1.802a2.36 2.36 0 1 1 0 4.72 2.36 2.36 0 0 1 0-4.72zm4.406-3.44a.97.97 0 1 0 0 1.94.97.97 0 0 0 0-1.94z',
            },
          ].map(s => (
            <a key={s.name} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.name}
              style={{ width: 34, height: 34, borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="15" height="16" viewBox="0 0 24 24" fill={s.fill}><path d={s.path} /></svg>
            </a>
          ))}
        </div>
        <p style={{ fontSize: 10, color: C.textSub, margin: 0 }}>
          © {new Date().getFullYear()} Cineverse. All rights reserved.
        </p>
      </footer>

      {/* ── Floating Bottom Dock ── (appears on scroll) */}
      <FloatingBottomDock onSearchOpen={() => setSearchOpen(true)} />

      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} onSelect={goPlay} />}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Inter:wght@400;500;600;700;800;900&display=swap');
        *::-webkit-scrollbar { display: none; }
        * { -ms-overflow-style: none; scrollbar-width: none; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        *:focus { outline: none; }
        button, a, input { outline: none; }
        @keyframes cv-shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        .cv-sk {
          background: linear-gradient(90deg, #0F1318 25%, #181D24 50%, #0F1318 75%);
          background-size: 200% 100%;
          animation: cv-shimmer 1.6s ease-in-out infinite;
        }
        @keyframes ott-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes cv-glow-pulse {
          0%, 100% { opacity: 0.08; }
          50%       { opacity: 0.18; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="ott-scroll"] { animation: none !important; }
          [style*="cv-glow-pulse"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
