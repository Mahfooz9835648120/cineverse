// src/pages/CineverseHome.tsx
// Cineverse — Home Page — GOD MODE REWRITE
// Data: TMDB API — trending, popular, top rated, upcoming, search

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, Search, Film, Tv, TrendingUp, Star,
  ChevronLeft, ChevronRight, Clock, Trash2, Apple,
} from 'lucide-react';
import { tmdb, getTMDBImage } from '@/lib/tmdb';

// ─── CONTINUE WATCHING HELPERS ───────────────────────────────────────────────
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

// Glass presets
const G = {
  // light glass — used for cards / surfaces
  light: {
    background:          'rgba(15,19,24,0.45)',
    backdropFilter:      'blur(20px)',
    WebkitBackdropFilter:'blur(20px)',
    border:              '1px solid rgba(248,249,251,0.07)',
  },
  // strong glass — arrows, overlays
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

// ─── TMDB NORMALISATION ───────────────────────────────────────────────────────
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

// 6 providers — pseudo-deterministic by tmdb_id mod 6
const filterItemsByOtt = (items: CineItem[], ottId: string, tab: 'movie' | 'tv') => {
  const list = items.filter(i => i.type === tab);
  if (ottId === 'all') return list;
  const MAP: Record<string, number> = {
    netflix: 0, prime: 1, appletv: 2, hulu: 3, disney: 4, max: 5,
  };
  const idx = MAP[ottId];
  return idx !== undefined ? list.filter(i => i.tmdb_id % 6 === idx) : list;
};

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
  return (
    <div style={{ width: '100%', height: '85vh', background: C.surface }} className="cv-sk" />
  );
}

// ─── POSTER CARD ─────────────────────────────────────────────────────────────
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

// ─── GLASS ARROW BUTTON ───────────────────────────────────────────────────────
function GlassArrow({
  dir, onClick, style = {},
}: { dir: 'l' | 'r'; onClick: () => void; style?: React.CSSProperties }) {
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

// ─── HORIZONTAL RAIL ─────────────────────────────────────────────────────────
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
    scrollRef.current.scrollBy({ left: dir === 'l' ? -scrollRef.current.clientWidth * 0.8 : scrollRef.current.clientWidth * 0.8, behavior: 'smooth' });
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

// ─── TOP TEN BANNER RAIL ──────────────────────────────────────────────────────
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
    scrollRef.current.scrollBy({ left: dir === 'l' ? -scrollRef.current.clientWidth : scrollRef.current.clientWidth, behavior: 'smooth' });
  };

  if (loading) return <div style={{ height: 280, marginInline: '4vw', borderRadius: 18, marginBottom: 42 }} className="cv-sk" />;
  if (!top10.length) return null;

  return (
    <section style={{ marginBottom: 44, paddingInline: '4vw' }}>
      <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800, color: C.text, letterSpacing: '-0.02em' }}>
        Top 10 {title}
      </h2>
      <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.7)' }}>
        {/* Arrows overlaid */}
        <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
          <GlassArrow dir="l" onClick={() => slide('l')} />
        </div>
        <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
          <GlassArrow dir="r" onClick={() => slide('r')} />
        </div>

        {/* Slides */}
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
            </div>
          ))}
        </div>

        {/* Dot indicators */}
        <div style={{
          position: 'absolute', bottom: 10, right: 16,
          display: 'flex', gap: 4, zIndex: 5,
        }}>
          {top10.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                const el = scrollRef.current;
                if (!el) return;
                const slide = el.children[i] as HTMLElement;
                slide?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
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
    </section>
  );
}

// ─── NETFLIX SHOWCASE SECTION ─────────────────────────────────────────────────
function NetflixShowcase({
  items, loading, onItemClick,
}: { items: CineItem[]; loading: boolean; onItemClick: (item: CineItem) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const netflixItems = items.filter(i => i.tmdb_id % 6 === 0 && (i.backdrop || i.poster)).slice(0, 10);
  const slide = (dir: 'l' | 'r') => {
    scrollRef.current?.scrollBy({ left: dir === 'l' ? -290 : 290, behavior: 'smooth' });
  };

  if (loading || !netflixItems.length) return null;

  return (
    <section style={{ marginBottom: 48, paddingInline: '4vw' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: '#E50914',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 18px rgba(229,9,20,0.45)',
        }}>
          <span style={{ fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: '-0.05em', fontFamily: 'Arial Black, sans-serif' }}>N</span>
        </div>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.text, letterSpacing: '-0.02em' }}>
          Most Watched on <span style={{ color: '#E50914' }}>Netflix</span>
        </h2>
      </div>

      {/* Scrollable banner cards */}
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', left: -10, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
          <GlassArrow dir="l" onClick={() => slide('l')} />
        </div>
        <div ref={scrollRef} style={{
          display: 'flex', gap: 10, overflowX: 'auto',
          scrollbarWidth: 'none', scrollSnapType: 'x proximity', paddingBottom: 2,
        }}>
          {netflixItems.map((item, idx) => (
            <div
              key={item.tmdb_id}
              onClick={() => onItemClick(item)}
              style={{
                flexShrink: 0, width: 260, height: 160, borderRadius: 14,
                overflow: 'hidden', position: 'relative', cursor: 'pointer',
                scrollSnapAlign: 'start', background: C.surface,
                boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
                transition: 'transform 0.2s ease',
              }}
            >
              <img src={item.backdrop || item.poster} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(7,9,13,0.75) 0%, transparent 60%), linear-gradient(to top, rgba(7,9,13,0.92) 0%, transparent 55%)' }} />
              {/* N badge */}
              <div style={{ position: 'absolute', top: 9, left: 9, width: 22, height: 22, borderRadius: 5, background: '#E50914', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(229,9,20,0.5)' }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: '#fff', fontFamily: 'Arial Black, sans-serif' }}>N</span>
              </div>
              {/* Rank */}
              <div style={{
                position: 'absolute', bottom: 8, left: 10,
                fontSize: 48, fontWeight: 900, fontStyle: 'italic',
                background: 'linear-gradient(to bottom, rgba(255,255,255,0.88) 20%, rgba(255,255,255,0.08) 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                lineHeight: 1, userSelect: 'none', letterSpacing: '-0.04em',
              }}>{idx + 1}</div>
              {/* Title */}
              <div style={{ position: 'absolute', bottom: 10, left: 58, right: 10 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{item.title}</p>
                <p style={{ margin: '2px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>{item.type === 'movie' ? 'Film' : 'Series'} · {item.year}</p>
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

// ─── AMAZON PRIME SHOWCASE ────────────────────────────────────────────────────
function PrimeShowcase({
  items, loading, onItemClick,
}: { items: CineItem[]; loading: boolean; onItemClick: (item: CineItem) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const primeItems = items.filter(i => i.tmdb_id % 6 === 1 && (i.backdrop || i.poster)).slice(0, 10);
  const slide = (dir: 'l' | 'r') => {
    scrollRef.current?.scrollBy({ left: dir === 'l' ? -290 : 290, behavior: 'smooth' });
  };

  if (loading || !primeItems.length) return null;

  return (
    <section style={{ marginBottom: 44, paddingInline: '4vw' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: 'rgba(0,168,225,0.15)',
          border: '1px solid rgba(0,168,225,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 11, fontWeight: 900, color: '#00A8E1', fontStyle: 'italic', letterSpacing: '0.04em' }}>P</span>
        </div>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.text, letterSpacing: '-0.02em' }}>
          <span style={{ fontStyle: 'italic', color: '#00A8E1' }}>prime</span> Picks
        </h2>
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', left: -10, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
          <GlassArrow dir="l" onClick={() => slide('l')} />
        </div>
        <div ref={scrollRef} style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
          {primeItems.map(item => (
            <div
              key={item.tmdb_id}
              onClick={() => onItemClick(item)}
              style={{
                flexShrink: 0, width: 220, height: 140, borderRadius: 14,
                overflow: 'hidden', position: 'relative', cursor: 'pointer',
                background: C.surface, boxShadow: '0 4px 18px rgba(0,0,0,0.45)',
              }}
            >
              <img src={item.backdrop || item.poster} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(7,9,13,0.9) 0%, transparent 55%)' }} />
              <div style={{ position: 'absolute', bottom: 9, left: 10, right: 10 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#fff', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{item.title}</p>
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

// ─── STREAMING PROVIDERS SELECTOR (Glassmorphism Pill Strip) ─────────────────
function OttSelector({
  selected, onSelect, currentTab, onTabChange,
}: {
  selected: string; onSelect: (id: string) => void;
  currentTab: 'movie' | 'tv'; onTabChange: (tab: 'movie' | 'tv') => void;
}) {
  const providers = [
    {
      id: 'netflix',
      logo: (
        <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.06em', color: '#fff', fontFamily: 'Arial Black, Helvetica Neue, sans-serif', lineHeight: 1 }}>N</span>
      ),
    },
    {
      id: 'prime',
      logo: (
        <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', fontStyle: 'italic', letterSpacing: '0.06em', fontFamily: 'inherit' }}>prime</span>
      ),
    },
    {
      id: 'appletv',
      logo: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, color: '#fff' }}>
          <Apple size={15} fill="#fff" color="#fff" />
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.02em' }}>tv+</span>
        </div>
      ),
    },
    {
      id: 'hulu',
      logo: (
        <span style={{ fontSize: 13, fontWeight: 900, color: '#fff', letterSpacing: '-0.01em', fontFamily: 'inherit' }}>hulu</span>
      ),
    },
    {
      id: 'disney',
      logo: (
        <span style={{ fontSize: 11, fontWeight: 900, color: '#fff', letterSpacing: '-0.01em', fontFamily: 'inherit' }}>Disney+</span>
      ),
    },
    {
      id: 'max',
      logo: (
        <span style={{ fontSize: 15, fontWeight: 900, color: '#fff', letterSpacing: '-0.04em', fontFamily: 'inherit' }}>max</span>
      ),
    },
  ];

  const handleClick = (id: string) => onSelect(selected === id ? 'all' : id);

  return (
    <div style={{ paddingInline: '4vw', marginBottom: 36 }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ width: 3, height: 16, borderRadius: 2, background: 'rgba(255,255,255,0.6)' }} />
        <h2 style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.textSub, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Streaming Providers
        </h2>
      </div>

      {/* Movies / Series global tab — glass pills */}
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

      {/* Scrollable provider pill strip */}
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
        {providers.map(p => {
          const isSel = selected === p.id;
          return (
            <button
              key={p.id}
              onClick={() => handleClick(p.id)}
              style={{
                flexShrink: 0,
                width: 88, height: 56,
                borderRadius: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontFamily: 'inherit',
                background: isSel ? 'rgba(255,255,255,0.11)' : 'rgba(15,19,24,0.5)',
                border: isSel ? '1.5px solid rgba(255,255,255,0.45)' : '1px solid rgba(248,249,251,0.07)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                boxShadow: isSel
                  ? '0 0 0 1px rgba(255,255,255,0.06), 0 0 24px rgba(255,255,255,0.07), inset 0 1px 0 rgba(255,255,255,0.12)'
                  : 'inset 0 1px 0 rgba(255,255,255,0.04)',
                transform: isSel ? 'scale(1.04)' : 'scale(1)',
                transition: 'all 0.22s cubic-bezier(0.2,0.8,0.2,1)',
              }}
            >
              {p.logo}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── HERO CAROUSEL ────────────────────────────────────────────────────────────
function Hero({
  items, onWatch,
}: { items: CineItem[]; onWatch: (item: CineItem) => void; onDetails: (item: CineItem) => void }) {
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

      {/* Enhanced dot indicators */}
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
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', opacity: imgOk ? 1 : 0, transition: 'opacity 0.35s ease' }}
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

// ─── FLOATING GLASS NAV ───────────────────────────────────────────────────────
function Nav({ onSearchOpen }: { onSearchOpen: () => void }) {
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const fn = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  // opacity ramps from 0.28 → 0.88 over first 180px of scroll
  const bg = `rgba(7,9,13,${Math.min(0.28 + (scrollY / 180) * 0.6, 0.88)})`;
  const bdr = `rgba(248,249,251,${Math.min(0.03 + (scrollY / 180) * 0.07, 0.1)})`;

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
      padding: '0 4vw', height: 60,
      background: bg,
      borderBottom: `1px solid ${bdr}`,
      backdropFilter: 'blur(28px)',
      WebkitBackdropFilter: 'blur(28px)',
      transition: 'background 0.25s ease, border-color 0.25s ease',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: scrollY > 10 ? '0 2px 40px rgba(0,0,0,0.35)' : 'none',
    }}>
      {/* Logo */}
      <button
        onClick={() => navigate('/')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 18, fontWeight: 900, color: C.text, letterSpacing: '-0.05em',
          padding: 0, flex: 1, textAlign: 'left', fontFamily: 'inherit',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        Cine<span style={{ color: C.textSub, fontWeight: 300 }}>verse</span>
      </button>

      {/* Search — glass button */}
      <button
        onClick={onSearchOpen}
        aria-label="Search"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 40, height: 40, borderRadius: 12,
          background: 'rgba(248,249,251,0.07)',
          border: '1px solid rgba(255,255,255,0.11)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          color: C.text, cursor: 'pointer',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
          transition: 'background 0.15s, border-color 0.15s',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <Search size={16} />
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

  const [cwKey, setCwKey] = useState(0);

  // Computed animation/cartoon items from existing data
  const animationMovies = popularMovies.filter(i => i.genres.includes('Animation') || i.genres.includes('Family')).slice(0, 20);
  const animationShows  = popularShows.filter(i => i.genres.includes('Animation') || i.genres.includes('Kids')).slice(0, 20);
  const allMovies       = [...trendingMovies, ...popularMovies];

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

  useEffect(() => {
    tmdb.getTrending('movie').then(d => {
      const items = normPage(d, 'movie', 6).filter(i => i.backdrop);
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

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'Inter, system-ui, sans-serif', overflowX: 'hidden' }}>
      {/* ── Floating Glass Navbar ── */}
      <Nav onSearchOpen={() => setSearchOpen(true)} />

      {/* ── 1. Hero Carousel ── */}
      {loadingHero
        ? <SkeletonHero />
        : <Hero items={heroItems} onWatch={goPlayItem} onDetails={goDetails} />
      }

      <div style={{ paddingTop: 32, paddingBottom: 64 }}>
        {/* ── 2. Continue Watching ── */}
        <ContinueWatchingRail key={cwKey} onPlay={goPlay} onRemove={() => setCwKey(k => k + 1)} />

        {/* ── 3. Top 10 Movies Banner ── */}
        <TopTenRail title="Movies" items={trendingMovies} loading={loadingTrendM} onItemClick={goPlayItem} />

        {/* ── 4. Top 10 Series Banner ── */}
        <TopTenRail title="Series" items={trendingShows} loading={loadingTrendS} onItemClick={goPlayItem} />

        {/* ── 5. Netflix Most Watched Showcase ── (between trending & providers) */}
        <NetflixShowcase items={allMovies} loading={loadingTrendM} onItemClick={goPlayItem} />

        {/* ── 6. Amazon Prime Picks ── */}
        <PrimeShowcase items={[...trendingMovies, ...popularMovies]} loading={loadingTrendM} onItemClick={goPlayItem} />

        {/* ── 7. Provider Selector + Movies/Series Tab ── */}
        <OttSelector
          selected={selectedOtt}
          onSelect={id => setSelectedOtt(id)}
          currentTab={currentOttTab}
          onTabChange={tab => setCurrentOttTab(tab)}
        />

        {/* ── 8. Content Rails — Tab filter works even on "all" provider ── */}
        {selectedOtt !== 'all' ? (
          /* Provider-specific filtered content */
          <>
            <Rail
              title={`Trending on ${selectedOtt.charAt(0).toUpperCase() + selectedOtt.slice(1)}`}
              icon={<TrendingUp size={14} />}
              items={filterItemsByOtt(currentOttTab === 'movie' ? trendingMovies : trendingShows, selectedOtt, currentOttTab)}
              loading={currentOttTab === 'movie' ? loadingTrendM : loadingTrendS}
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
              items={filterItemsByOtt(currentOttTab === 'movie' ? popularMovies : popularShows, selectedOtt, currentOttTab)}
              loading={currentOttTab === 'movie' ? loadingPopM : loadingPopS}
              onItemClick={goPlayItem}
            />
          </>
        ) : currentOttTab === 'movie' ? (
          /* Movies tab — all providers */
          <>
            <Rail title="Trending Movies"    icon={<TrendingUp size={14} />} items={trendingMovies}  loading={loadingTrendM}   onItemClick={goPlayItem} />
            <Rail title="Popular Movies"     icon={<Film size={14} />}       items={popularMovies}   loading={loadingPopM}     onItemClick={goPlayItem} />
            <Rail title="Top Rated"          icon={<Star size={14} />}       items={topRated}        loading={loadingTopR}     onItemClick={goPlayItem} />
            <Rail title="Coming Soon"        icon={<Film size={14} />}       items={upcoming}        loading={loadingUpcoming} onItemClick={goPlayItem} />
            {animationMovies.length > 0 && (
              <Rail title="Animation & Cartoons" icon={<span style={{ fontSize: 14 }}>🎨</span>} items={animationMovies} loading={loadingPopM} onItemClick={goPlayItem} />
            )}
          </>
        ) : (
          /* Series tab — all providers */
          <>
            <Rail title="Trending Series"    icon={<TrendingUp size={14} />} items={trendingShows}   loading={loadingTrendS}  onItemClick={goPlayItem} />
            <Rail title="Popular Series"     icon={<Tv size={14} />}         items={popularShows}    loading={loadingPopS}    onItemClick={goPlayItem} />
            {animationShows.length > 0 && (
              <Rail title="Animated Series"  icon={<span style={{ fontSize: 14 }}>🎨</span>} items={animationShows}  loading={loadingPopS}    onItemClick={goPlayItem} />
            )}
          </>
        )}
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
              name: 'Telegram', href: 'https://t.me/Cineverseofc', fill: '#27A7E7',
              path: 'M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.568 8.16-1.78 8.395c-.134.6-.485.748-.984.466l-2.72-2.004-1.312 1.264c-.145.145-.267.267-.546.267l.195-2.79 5.08-4.59c.221-.196-.048-.305-.34-.109l-6.276 3.95-2.704-.845c-.587-.183-.598-.587.122-.87l10.566-4.07c.49-.183.918.109.76.844z',
            },
            {
              name: 'Instagram', href: 'https://instagram.com/cineverseofc', fill: '#E1306C',
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
          background: linear-gradient(90deg, ${C.surface} 25%, ${C.elevated} 50%, ${C.surface} 75%);
          background-size: 200% 100%;
          animation: cv-shimmer 1.6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
