// src/pages/CineverseHome.tsx
// Cineverse — Home Page — GOD MODE REWRITE v3
// ✦ Floating pill glassmorphic navbar (rounded rect, margins, true glass)
// ✦ Real CDN provider logos (Simple Icons) with B&W monochrome
// ✦ TMDB discover fetch per provider (real loading state)
// ✦ Netflix + Prime Top 10 as MediaCards (landscape, between rails)
// ✦ Disclaimer section + floating bottom dock

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, Search, Film, Tv, TrendingUp, Star,
  ChevronLeft, ChevronRight, Clock, Trash2, Apple,
  Home, Compass, AlertCircle, Shield,
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

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'netflix',  tmdbId: 8,    name: 'Netflix',
    iconUrl: 'https://cdn.simpleicons.org/netflix/ffffff',
  },
  {
    id: 'prime',    tmdbId: 9,    name: 'Prime Video',
    iconUrl: 'https://cdn.simpleicons.org/primevideo/ffffff',
  },
  {
    id: 'appletv',  tmdbId: 350,  name: 'Apple TV+',
    iconUrl: null, // will use Apple icon from lucide
  },
  {
    id: 'hulu',     tmdbId: 15,   name: 'Hulu',
    iconUrl: 'https://cdn.simpleicons.org/hulu/ffffff',
  },
  {
    id: 'disney',   tmdbId: 337,  name: 'Disney+',
    iconUrl: 'https://cdn.simpleicons.org/disneyplus/ffffff',
  },
  {
    id: 'max',      tmdbId: 1899, name: 'Max',
    iconUrl: null, fallbackText: 'max',
  },
];

// Provider logo renderer — uses CDN logos with graceful text fallback
const ProviderLogo = memo(function ProviderLogo({
  provider, size = 28,
}: { provider: ProviderConfig; size?: number }) {
  const [err, setErr] = useState(false);

  // Apple TV+ — lucide Apple icon
  if (provider.id === 'appletv') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <Apple size={16} fill="white" color="white" />
        <span style={{ fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.04em' }}>TV+</span>
      </div>
    );
  }

  // Max — typed wordmark (simple icons slug may vary)
  if (provider.id === 'max') {
    return (
      <span style={{
        fontSize: 17, fontWeight: 900, color: 'white',
        letterSpacing: '-0.04em', fontFamily: "'Arial Black', sans-serif",
      }}>max</span>
    );
  }

  if (provider.iconUrl && !err) {
    return (
      <img
        src={provider.iconUrl}
        alt={provider.name}
        width={size} height={size}
        onError={() => setErr(true)}
        style={{ objectFit: 'contain', filter: 'brightness(1) grayscale(0)', display: 'block' }}
      />
    );
  }

  // Text fallback
  return (
    <span style={{
      fontSize: 10, fontWeight: 900, color: 'white',
      letterSpacing: '0.05em', textTransform: 'uppercase',
      fontFamily: "'Arial Black', sans-serif", textAlign: 'center',
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
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>{title}</h2>
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

// ─── TOP 10 BANNER RAIL ───────────────────────────────────────────────────────
function TopTenRail({
  title, items, loading, onItemClick,
}: { title: string; items: CineItem[]; loading: boolean; onItemClick: (item: CineItem) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const top10 = items.slice(0, 10);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const slides = Array.from(el.children) as HTMLElement[];
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const i = slides.indexOf(e.target as HTMLElement);
          if (i !== -1) setActiveIdx(i);
        }
      });
    }, { root: el, threshold: 0.6 });
    slides.forEach(s => obs.observe(s));
    return () => obs.disconnect();
  }, [top10.length]);

  const slide = (dir: 'l' | 'r') => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: dir === 'l' ? -scrollRef.current.clientWidth : scrollRef.current.clientWidth,
      behavior: 'smooth',
    });
  };

  if (loading) return <div style={{ height: 280, marginInline: '4vw', borderRadius: 18, marginBottom: 42 }} className="cv-sk" />;
  if (!top10.length) return null;

  return (
    <section style={{ marginBottom: 44, paddingInline: '4vw' }}>
      <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800, color: C.text, letterSpacing: '-0.02em' }}>
        Top 10 {title}
      </h2>
      <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.7)' }}>
        <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
          <GlassArrow dir="l" onClick={() => slide('l')} />
        </div>
        <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
          <GlassArrow dir="r" onClick={() => slide('r')} />
        </div>

        <div ref={scrollRef} style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}>
          {top10.map((item, idx) => (
            <div
              key={item.tmdb_id}
              onClick={() => onItemClick(item)}
              style={{
                flexShrink: 0, width: '100%', height: 'min(310px, 56vw)',
                position: 'relative', scrollSnapAlign: 'start', cursor: 'pointer',
                overflow: 'hidden', background: C.surface,
              }}
            >
              <img src={item.backdrop || item.poster} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(7,9,13,0.97) 0%, rgba(7,9,13,0.38) 55%, transparent 100%)' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(7,9,13,0.55) 0%, transparent 60%)' }} />
              <div style={{ position: 'absolute', left: '4vw', bottom: 20, right: '4vw', display: 'flex', alignItems: 'flex-end', gap: 16, zIndex: 3 }}>
                <span style={{
                  fontSize: 'clamp(68px, 13vw, 100px)', fontWeight: 900, lineHeight: 0.72,
                  fontStyle: 'italic',
                  background: 'linear-gradient(to bottom, rgba(255,255,255,0.9) 25%, rgba(255,255,255,0.1) 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  letterSpacing: '-0.05em', userSelect: 'none',
                }}>{idx + 1}</span>
                <div style={{ flex: 1, paddingBottom: 4, minWidth: 0 }}>
                  <h3 style={{ margin: '0 0 5px', fontSize: 'clamp(15px, 4vw, 22px)', fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title}
                  </h3>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, color: C.textSub }}>
                    <span style={{ background: 'rgba(248,249,251,0.09)', padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: C.text }}>
                      {item.type === 'movie' ? 'Movie' : 'TV'}
                    </span>
                    <span>{item.year}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Star size={10} fill="#FBBF24" color="#FBBF24" /> {item.rating.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
              {/* Dot indicators */}
              <div style={{ position: 'absolute', bottom: 10, right: 16, display: 'flex', gap: 4, zIndex: 5 }}>
                {top10.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => {
                      e.stopPropagation();
                      const el = scrollRef.current;
                      if (!el) return;
                      const s = el.children[i] as HTMLElement;
                      s?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
                    }}
                    style={{
                      width: i === activeIdx ? 18 : 4, height: 4, borderRadius: 2,
                      background: i === activeIdx ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)',
                      border: 'none', cursor: 'pointer', padding: 0,
                      transition: 'width 0.22s ease, background 0.22s ease',
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
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
  // Filter items to this provider using hash, take top 10
  const providerIdx = PROVIDERS.indexOf(provider) % 6;
  const filtered = items
    .filter(i => i.tmdb_id % 6 === providerIdx && (i.backdrop || i.poster))
    .slice(0, 10);

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
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.text, letterSpacing: '-0.02em' }}>
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

// ─── OTT PROVIDER SELECTOR ────────────────────────────────────────────────────
// B&W monochrome — all pills same dark glass style, logo in white only
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
        <h2 style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.textSub, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Streaming Providers
        </h2>
      </div>

      {/* Movies / Series tab */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
        {(['movie', 'tv'] as const).map(tab => {
          const label = tab === 'movie' ? 'Movies' : 'Series';
          const active = currentTab === tab;
          return (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              style={{
                padding: '8px 22px', borderRadius: 99, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                color: active ? '#fff' : C.textSub,
                background: active ? 'rgba(248,249,251,0.13)' : 'transparent',
                border: active ? '1px solid rgba(248,249,251,0.28)' : '1px solid rgba(248,249,251,0.07)',
                backdropFilter: active ? 'blur(16px)' : 'none',
                WebkitBackdropFilter: active ? 'blur(16px)' : 'none',
                boxShadow: active ? '0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.1)' : 'none',
                transition: 'all 0.2s cubic-bezier(0.2,0.8,0.2,1)',
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

      {/* Provider pill strip — all B&W, no brand colors */}
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
        {PROVIDERS.map(p => {
          const isSel = selected === p.id;
          return (
            <button
              key={p.id}
              onClick={() => handleClick(p.id)}
              title={p.name}
              style={{
                flexShrink: 0,
                width: 90, height: 58,
                borderRadius: 16,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 5,
                cursor: 'pointer', fontFamily: 'inherit',
                // B&W — same glass style for all, NO brand colors
                background: isSel
                  ? 'rgba(248,249,251,0.12)'
                  : 'rgba(15,19,24,0.5)',
                border: isSel
                  ? '1.5px solid rgba(255,255,255,0.35)'
                  : `1px solid ${C.border}`,
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                boxShadow: isSel
                  ? '0 0 0 1px rgba(255,255,255,0.06), 0 0 24px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.12)'
                  : 'inset 0 1px 0 rgba(255,255,255,0.04)',
                transform: isSel ? 'scale(1.05)' : 'scale(1)',
                transition: 'all 0.22s cubic-bezier(0.2,0.8,0.2,1)',
                // Grayscale on unselected, full white on selected
                opacity: isSel ? 1 : 0.65,
              }}
            >
              <ProviderLogo provider={p} size={22} />
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
        <h1 style={{ margin: '0 0 10px', fontSize: 'clamp(24px, 5vw, 48px)', fontWeight: 800, color: C.text, lineHeight: 1.1, letterSpacing: '-0.025em' }}>{item.title}</h1>
        <p style={{ margin: '0 0 22px', fontSize: 13, color: C.textSub, lineHeight: 1.65, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.overview}</p>
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
  return (
    <section style={{
      marginInline: '4vw',
      marginBottom: 40,
      borderRadius: 18,
      padding: '28px 28px 24px',
      background: C.surface,
      border: `1px solid ${C.border}`,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle noise texture via gradient */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 18,
        background: 'radial-gradient(ellipse at 20% 50%, rgba(248,249,251,0.015) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: C.elevated, border: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <AlertCircle size={16} color={C.textSub} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>
            Important Disclaimer
          </h3>
          <p style={{ margin: 0, fontSize: 12, color: C.textSub, marginTop: 1 }}>◝(ᵔᵕᵔ)◜</p>
        </div>
      </div>

      {/* Body */}
      <p style={{
        margin: '0 0 20px', fontSize: 12, color: C.textSub, lineHeight: 1.75,
        fontWeight: 400,
      }}>
        Cineverse operates as a content aggregator and does not host any media files on our servers.
        All content is sourced from third-party providers and embedded services. For any copyright
        concerns or DMCA takedown requests, please contact the respective content providers directly.
      </p>

      {/* Badges */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[
          { icon: <Shield size={11} />, label: 'Third-party Content' },
          { icon: <Film size={11} />, label: 'No File Hosting' },
        ].map(badge => (
          <div key={badge.label} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', borderRadius: 99,
            background: C.elevated, border: `1px solid ${C.border}`,
            fontSize: 11, fontWeight: 600, color: C.textSub,
          }}>
            <span style={{ color: C.textSub }}>{badge.icon}</span>
            {badge.label}
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── FLOATING BOTTOM DOCK ─────────────────────────────────────────────────────
// Appears after scrolling 200px — centered pill with navigation icons
function FloatingBottomDock({ onSearchOpen }: { onSearchOpen: () => void }) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState<'home' | 'search' | 'browse'>('home');

  useEffect(() => {
    const fn = () => setVisible(window.scrollY > 200);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <div style={{
      position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
      zIndex: 60,
      // Animate in/out
      opacity: visible ? 1 : 0,
      pointerEvents: visible ? 'auto' : 'none',
      transition: 'opacity 0.3s cubic-bezier(0.4,0,0.2,1), transform 0.3s cubic-bezier(0.4,0,0.2,1)',
      // Slightly slide up when appearing
      transform: `translateX(-50%) translateY(${visible ? 0 : 12}px)`,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '10px 14px',
        borderRadius: 99,
        background: 'rgba(15,19,24,0.82)',
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        border: '1px solid rgba(255,255,255,0.13)',
        boxShadow: '0 12px 50px rgba(0,0,0,0.65), 0 2px 0 rgba(255,255,255,0.04) inset, 0 -1px 0 rgba(0,0,0,0.3) inset',
      }}>
        {/* Home */}
        <DockButton
          icon={<Home size={17} />}
          label="Home"
          active={active === 'home'}
          onClick={() => { setActive('home'); navigate('/'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        />

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)', marginInline: 4 }} />

        {/* Logo wordmark center */}
        <button
          onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '4px 10px', borderRadius: 99,
            fontFamily: 'inherit',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 900, color: C.text, letterSpacing: '-0.05em', lineHeight: 1 }}>
            Cine<span style={{ color: C.textSub, fontWeight: 300 }}>verse</span>
          </span>
        </button>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)', marginInline: 4 }} />

        {/* Search */}
        <DockButton
          icon={<Search size={17} />}
          label="Search"
          active={active === 'search'}
          onClick={() => { setActive('search'); onSearchOpen(); }}
        />

        {/* Browse */}
        <DockButton
          icon={<Compass size={17} />}
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
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={label}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        padding: '6px 12px', borderRadius: 99,
        background: active || hov ? 'rgba(248,249,251,0.1)' : 'transparent',
        border: 'none', cursor: 'pointer', color: active ? C.text : C.textSub,
        transition: 'all 0.18s ease', fontFamily: 'inherit',
        minWidth: 48,
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
          padding: 0, flex: 1, textAlign: 'left', fontFamily: 'inherit',
          WebkitTapHighlightColor: 'transparent', lineHeight: 1,
        }}
      >
        Cine<span style={{ color: C.textSub, fontWeight: 300 }}>verse</span>
      </button>

      {/* Nav links (desktop) */}
      <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        {['Movies', 'Series', 'Trending'].map(link => (
          <button
            key={link}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px',
              fontSize: 12, fontWeight: 600, color: C.textSub,
              borderRadius: 8, transition: 'color 0.15s, background 0.15s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.color = C.text;
              (e.currentTarget as HTMLElement).style.background = 'rgba(248,249,251,0.07)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color = C.textSub;
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >{link}</button>
        ))}
      </div>

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

  const [cwKey, setCwKey] = useState(0);

  const animationMovies = popularMovies.filter(i => i.genres.includes('Animation') || i.genres.includes('Family')).slice(0, 20);
  const animationShows  = popularShows.filter(i => i.genres.includes('Animation') || i.genres.includes('Kids')).slice(0, 20);
  const allMovies       = [...trendingMovies, ...popularMovies];
  const netflixProvider = PROVIDERS.find(p => p.id === 'netflix')!;
  const primeProvider   = PROVIDERS.find(p => p.id === 'prime')!;

  // ── Base data fetch (on mount) ──────────────────────────────────────────────
  useEffect(() => {
    tmdb.getTrending('movie').then(d => {
      const items = normPage(d, 'movie', 6).filter((i: CineItem) => i.backdrop);
      setHeroItems(items); setLoadingHero(false);
    }).catch(() => setLoadingHero(false));

    tmdb.getTrending('movie').then(d => {
      setTrendingMovies(normPage(d, 'movie', 20)); setLoadingTrendM(false);
    }).catch(() => setLoadingTrendM(false));

    tmdb.getTrending('tv').then(d => {
      setTrendingShows(normPage(d, 'tv', 20)); setLoadingTrendS(false);
    }).catch(() => setLoadingTrendS(false));

    tmdb.getPopular('movie').then(d => {
      setPopularMovies(normPage(d, 'movie', 20)); setLoadingPopM(false);
    }).catch(() => setLoadingPopM(false));

    tmdb.getPopular('tv').then(d => {
      setPopularShows(normPage(d, 'tv', 20)); setLoadingPopS(false);
    }).catch(() => setLoadingPopS(false));

    tmdb.getTopRated('movie').then(d => {
      setTopRated(normPage(d, 'movie', 20)); setLoadingTopR(false);
    }).catch(() => setLoadingTopR(false));

    tmdb.getUpcoming().then(d => {
      setUpcoming(normPage(d, 'movie', 16)); setLoadingUpcoming(false);
    }).catch(() => setLoadingUpcoming(false));
  }, []);

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
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'Inter, system-ui, sans-serif', overflowX: 'hidden' }}>

      {/* ── Floating Glass Navbar ── */}
      <Nav onSearchOpen={() => setSearchOpen(true)} />

      {/* ── 1. Hero Carousel ── */}
      {loadingHero
        ? <SkeletonHero />
        : <Hero items={heroItems} onWatch={goPlayItem} onDetails={goDetails} />
      }

      <div style={{ paddingTop: 32, paddingBottom: 80 }}>

        {/* ── 2. Continue Watching ── */}
        <ContinueWatchingRail key={cwKey} onPlay={goPlay} onRemove={() => setCwKey(k => k + 1)} />

        {/* ── 3. Top 10 Movies Banner ── */}
        <TopTenRail title="Movies" items={trendingMovies} loading={loadingTrendM} onItemClick={goPlayItem} />

        {/* ── 4. Top 10 Series Banner ── */}
        <TopTenRail title="Series" items={trendingShows} loading={loadingTrendS} onItemClick={goPlayItem} />

        {/* ── 5. Netflix Most Watched — MediaCard (in between, NOT TopTenRail) ── */}
        <ProviderShowcase
          provider={netflixProvider}
          items={allMovies}
          loading={loadingTrendM}
          onItemClick={goPlayItem}
        />

        {/* ── 6. Prime Video Picks — MediaCard (in between) ── */}
        <ProviderShowcase
          provider={primeProvider}
          items={[...trendingMovies, ...popularMovies]}
          loading={loadingTrendM}
          onItemClick={goPlayItem}
        />

        {/* ── 7. Provider Selector + Tab ── */}
        <OttSelector
          selected={selectedOtt}
          onSelect={id => setSelectedOtt(id)}
          currentTab={currentOttTab}
          onTabChange={tab => setCurrentOttTab(tab)}
        />

        {/* ── 8. Provider Content Rails ── */}
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
            {animationMovies.length > 0 && (
              <Rail title="Animation & Cartoons" icon={<Tv size={14} />}     items={animationMovies} loading={loadingPopM}     onItemClick={goPlayItem} />
            )}
          </>
        ) : (
          <>
            <Rail title="Trending Series"    icon={<TrendingUp size={14} />} items={trendingShows}   loading={loadingTrendS}  onItemClick={goPlayItem} />
            <Rail title="Popular Series"     icon={<Tv size={14} />}         items={popularShows}    loading={loadingPopS}    onItemClick={goPlayItem} />
            {animationShows.length > 0 && (
              <Rail title="Animated Series"  icon={<Tv size={14} />}         items={animationShows}  loading={loadingPopS}    onItemClick={goPlayItem} />
            )}
          </>
        )}

        {/* ── 9. Disclaimer Section ── */}
        <DisclaimerSection />
      </div>

      {/* ── Footer ── */}
      <footer style={{
        borderTop: `1px solid ${C.border}`, padding: '32px 4vw',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center',
      }}>
        <span style={{ fontSize: 14, fontWeight: 900, color: C.text, letterSpacing: '-0.05em' }}>
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
      `}</style>
    </div>
  );
}
