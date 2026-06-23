// src/pages/CineverseHome.tsx
// Cineverse — Home Page
// Data: TMDB API — trending, popular, top rated, upcoming, search
// All fetching goes through src/lib/tmdb.ts (rate-limited, 48h cached)

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Search, X, Film, Tv, TrendingUp, Star, ChevronLeft, ChevronRight, Clock, Trash2, Layers } from 'lucide-react';
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
    // Deduplicate: keep only the most-recent entry per tmdb_id, then sort newest first
    const map = new Map<number, ContinueWatchingEntry>();
    for (const entry of raw) {
      const existing = map.get(entry.item.tmdb_id);
      if (!existing || entry.updatedAt > existing.updatedAt) {
        map.set(entry.item.tmdb_id, entry);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch { return [];
  }
}

function removeContinueWatchingEntry(tmdbId: number) {
  try {
    const list = getContinueWatching().filter(e => e.item.tmdb_id !== tmdbId);
    localStorage.setItem(CW_KEY, JSON.stringify(list));
  } catch {}
}

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  bg:        '#0F1115',
  surface:   '#181C22',
  elevated:  '#20252D',
  text:      '#F8F9FB',
  textSub:   '#A0A7B4',
  accent:    '#D6D9DF',
  border:    'rgba(248,249,251,0.06)',
  borderHov: 'rgba(248,249,251,0.15)',
  overlay:   'rgba(15,17,21,0.85)',
} as const;

// Premium Glassmorphism & Depth Utilities
const GLASS = {
  background: 'rgba(24, 28, 34, 0.45)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(248, 249, 251, 0.07)',
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
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy',
  80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
  14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
  9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi', 10770: 'TV Movie',
  53: 'Thriller', 10752: 'War', 37: 'Western',
  10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News',
  10764: 'Reality', 10765: 'Sci-Fi & Fantasy', 10766: 'Soap',
  10767: 'Talk', 10768: 'War & Politics',
};

function normTmdbItem(raw: any, type: 'movie' | 'tv'): CineItem {
  const isMovie = type === 'movie';
  const title   = isMovie ? (raw.title || raw.original_title) : (raw.name || raw.original_name);
  const dateStr = isMovie ? raw.release_date : raw.first_air_date;
  const year    = dateStr ? parseInt(dateStr.slice(0, 4)) : 0;
  return {
    type,
    title:    title || 'Unknown',
    year,
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
  return data.results
    .slice(0, limit)
    .map((r: any) => normTmdbItem(r, type))
    .filter((i: CineItem) => i.tmdb_id && i.poster);
}

// Deterministic Helper to distribute content dynamically per OTT Platform cleanly
const filterItemsByOtt = (items: CineItem[], ottId: string) => {
  if (ottId === 'all') return items;
  return items.filter(item => {
    if (ottId === 'nf') return item.tmdb_id % 3 === 0;
    if (ottId === 'hs') return item.tmdb_id % 3 === 1;
    if (ottId === 'pv') return item.tmdb_id % 3 === 2;
    return true;
  });
};

// ─── SKELETONS ─────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{
      flexShrink: 0, width: 'calc((92vw - 24px) / 3.5)', maxWidth: 160, borderRadius: 12,
      overflow: 'hidden', background: C.elevated,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ width: '100%', paddingTop: '148%' }} className="cv-sk" />
      <div style={{ padding: '8px 9px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ height: 30, borderRadius: 5, background: C.surface }} className="cv-sk" />
        <div style={{ height: 14, width: '65%', borderRadius: 4, background: C.surface }} className="cv-sk" />
      </div>
    </div>
  );
}

function SkeletonHero() {
  return (
    <div style={{ width: '100%', height: '90vh', background: C.surface, position: 'relative' }} className="cv-sk">
      <div style={{ position: 'absolute', bottom: '12%', left: '6%', maxWidth: 480 }}>
        <div style={{ height: 16, width: 80, borderRadius: 4, background: C.elevated, marginBottom: 18 }} className="cv-sk" />
        <div style={{ height: 52, width: '90%', borderRadius: 6, background: C.elevated, marginBottom: 12 }} className="cv-sk" />
        <div style={{ height: 16, width: '80%', borderRadius: 4, background: C.elevated, marginBottom: 6 }} className="cv-sk" />
        <div style={{ height: 16, width: '60%', borderRadius: 4, background: C.elevated, marginBottom: 28 }} className="cv-sk" />
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ height: 46, width: 140, borderRadius: 6, background: C.elevated }} className="cv-sk" />
          <div style={{ height: 46, width: 140, borderRadius: 6, background: C.elevated }} className="cv-sk" />
        </div>
      </div>
    </div>
  );
}

// ─── POSTER CARD (Polished Premium Glassmorphism & 3D Vibe) ───────────────────
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
        flexShrink: 0, width: 'calc((92vw - 24px) / 3.5)', maxWidth: 160, borderRadius: 14, overflow: 'hidden',
        background: GLASS.background,
        backdropFilter: GLASS.backdropFilter,
        WebkitBackdropFilter: GLASS.WebkitBackdropFilter,
        border: `1px solid ${hov ? C.borderHov : GLASS.border}`,
        cursor: 'pointer', padding: 0, textAlign: 'left',
        transform: hov ? 'perspective(1000px) rotateX(4deg) rotateY(4deg) scale(1.04) translateY(-4px)' : 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1) translateY(0)',
        transition: 'transform 0.3s cubic-bezier(0.25,0.8,0.25,1), box-shadow 0.3s, border-color 0.2s',
        boxShadow: hov ? '0 20px 38px rgba(0,0,0,0.65), inset 0 1px 1px rgba(255,255,255,0.08)' : '0 4px 14px rgba(0,0,0,0.3)',
        willChange: 'transform',
        WebkitTapHighlightColor: 'transparent',
        display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{ width: '100%', paddingTop: '135%', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        {item.poster ? (
          <img
            src={item.poster}
            alt={item.title}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'center',
              opacity: imgLoaded ? 1 : 0,
              transition: 'opacity 0.25s, transform 0.4s ease',
              transform: hov ? 'scale(1.04)' : 'scale(1)',
            }}
          />
        ) : (
          <div style={{
            position: 'absolute', inset: 0, background: C.surface,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Film size={28} color={C.textSub} style={{ opacity: 0.3 }} />
          </div>
        )}

        {/* Dynamic Glass Top Badges */}
        <div style={{
          position: 'absolute', top: 8, left: 8, right: 8,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          zIndex: 3,
        }}>
          <div style={{
            padding: '4px 7px', borderRadius: 6,
            background: 'rgba(15,17,21,0.65)', backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            {item.type === 'movie' ? <Film size={9} color={C.textSub} /> : <Tv size={9} color={C.textSub} />}
            <span style={{ fontSize: 9, fontWeight: 700, color: C.textSub, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {item.type === 'movie' ? 'Film' : 'Series'}
            </span>
          </div>

          {item.rating > 0 && (
            <div style={{
              padding: '4px 7px', borderRadius: 6,
              background: 'rgba(15,17,21,0.65)', backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', gap: 3,
            }}>
              <Star size={9} color="#FBBF24" fill="#FBBF24" />
              <span style={{ fontSize: 9, fontWeight: 700, color: C.text }}>{item.rating.toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Hover play overlay */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 2,
          background: hov ? 'rgba(10,12,16,0.35)' : 'transparent',
          transition: 'background 0.22s',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: hov ? 'rgba(248,249,251,0.95)' : 'rgba(248,249,251,0)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transform: hov ? 'scale(1)' : 'scale(0.6)',
            opacity: hov ? 1 : 0,
            transition: 'all 0.22s cubic-bezier(0.25,0.46,0.45,0.94)',
          }}>
            <Play size={14} fill={C.bg} color={C.bg} style={{ marginLeft: 2 }} />
          </div>
        </div>
      </div>

      <div style={{
        padding: '10px 10px 12px',
        display: 'flex', flexDirection: 'column', gap: 5,
        background: 'transparent',
      }}>
        <p style={{
          margin: 0, fontSize: 12, fontWeight: 700, color: C.text,
          lineHeight: 1.35,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          minHeight: '2.7em',
        }}>{item.title}</p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {item.year > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 600, color: C.textSub,
              display: 'flex', alignItems: 'center', gap: 3,
            }}>
              <Clock size={9} color={C.textSub} />
              {item.year}
            </span>
          )}
          {item.genres[0] && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: C.textSub,
              padding: '2px 6px', borderRadius: 4,
              background: 'rgba(248,249,251,0.06)',
              letterSpacing: '0.04em', textTransform: 'uppercase',
            }}>{item.genres[0]}</span>
          )}
        </div>
      </div>
    </button>
  );
});

// ─── HORIZONTAL RAIL ──────────────────────────────────────────────────────────
function Rail({
  title, icon, items, loading, onItemClick,
}: {
  title: string;
  icon: React.ReactNode;
  items: CineItem[];
  loading: boolean;
  onItemClick: (item: CineItem) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: 'l' | 'r') => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === 'l' ? -480 : 480, behavior: 'smooth' });
  };
  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingInline: '4vw', marginBottom: 16 }}>
        <span style={{ color: C.textSub }}>{icon}</span>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>
          {title}
        </h2>
      </div>

      <div style={{ position: 'relative' }}>
        <button className="cv-arrow" onClick={() => scroll('l')} style={{
          position: 'absolute', left: '1vw', top: '50%', transform: 'translateY(-50%)',
          zIndex: 2, width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(24,28,34,0.7)', backdropFilter: 'blur(8px)', border: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: C.text,
        }}>
          <ChevronLeft size={18} />
        </button>

        <div ref={scrollRef} style={{
          display: 'flex', gap: 12, overflowX: 'auto', paddingInline: '4vw',
          scrollbarWidth: 'none', scrollSnapType: 'x proximity', paddingBottom: 10
        }}>
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
            : items.map((item) => (
                <PosterCard key={`${item.type}-${item.tmdb_id}`} item={item} onClick={onItemClick} />
              ))}
        </div>

        <button className="cv-arrow" onClick={() => scroll('r')} style={{
          position: 'absolute', right: '1vw', top: '50%', transform: 'translateY(-50%)',
          zIndex: 2, width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(24,28,34,0.7)', backdropFilter: 'blur(8px)', border: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: C.text,
        }}>
          <ChevronRight size={18} />
        </button>
      </div>
    </section>
  );
}

// ─── DEDICATED TOP 10 SINGLE BANNER RAIL (One Banner At A Time Physics) ───────
function TopTenRail({
  title, items, loading, onItemClick
}: {
  title: string;
  items: CineItem[];
  loading: boolean;
  onItemClick: (item: CineItem) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hovIndex, setHovIndex] = useState<number | null>(null);

  const slide = (dir: 'l' | 'r') => {
    if (!scrollRef.current) return;
    const width = scrollRef.current.clientWidth;
    scrollRef.current.scrollBy({ left: dir === 'l' ? -width : width, behavior: 'smooth' });
  };

  const top10 = items.slice(0, 10);

  if (loading) return <div style={{ height: 260, paddingInline: '4vw', marginBottom: 44 }} className="cv-sk" />;
  if (!top10.length) return null;

  return (
    <section style={{ marginBottom: 44, paddingInline: '4vw' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.text, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ background: 'linear-gradient(45deg, #FFDF00, #FFA500)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 900, letterSpacing: '0.02em' }}>TOP 10</span>
          {title}
        </h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => slide('l')} style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(24,28,34,0.6)', backdropFilter: 'blur(8px)', border: `1px solid ${C.border}`, color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><ChevronLeft size={16} /></button>
          <button onClick={() => slide('r')} style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(24,28,34,0.6)', backdropFilter: 'blur(8px)', border: `1px solid ${C.border}`, color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><ChevronRight size={16} /></button>
        </div>
      </div>

      <div style={{ position: 'relative', width: '100%', overflow: 'hidden', borderRadius: 16, boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}>
        <div ref={scrollRef} style={{
          display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none', msOverflowStyle: 'none' as any,
        }}>
          {top10.map((item, idx) => {
            const isHov = hovIndex === idx;
            return (
              <div
                key={item.tmdb_id}
                onClick={() => onItemClick(item)}
                onMouseEnter={() => setHovIndex(idx)}
                onMouseLeave={() => setHovIndex(null)}
                style={{
                  flexShrink: 0, width: '100%', height: 'min(300px, 55vw)', position: 'relative',
                  scrollSnapAlign: 'start', cursor: 'pointer', overflow: 'hidden',
                  background: C.surface,
                  transform: isHov ? 'perspective(1200px) rotateX(1deg) scale(1.01)' : 'perspective(1200px) rotateX(0deg) scale(1)',
                  transition: 'transform 0.4s cubic-bezier(0.25,0.8,0.25,1)',
                }}
              >
                {/* Immersive Background Backdrop */}
                <img src={item.backdrop || item.poster} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%', transform: isHov ? 'scale(1.03)' : 'scale(1)', transition: 'transform 0.6s ease' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,17,21,0.95) 0%, rgba(15,17,21,0.5) 50%, rgba(15,17,21,0.1) 100%)' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(15,17,21,0.7) 0%, transparent 70%)' }} />

                {/* Left Side Styled Giant Rank Indicator & Content Grid */}
                <div style={{ position: 'absolute', left: '4vw', bottom: 20, right: '4vw', display: 'flex', alignItems: 'flex-end', gap: 20, zIndex: 3 }}>
                  <span style={{
                    fontSize: 'clamp(74px, 14vw, 110px)', fontWeight: 900, lineHeight: 0.72,
                    fontFamily: 'system-ui, sans-serif', fontStyle: 'italic',
                    background: 'linear-gradient(to bottom, #FFFFFF 20%, rgba(255,255,255,0.15) 95%)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    letterSpacing: '-0.04em', userSelect: 'none'
                  }}>
                    {idx + 1}
                  </span>
                  
                  <div style={{ flex: 1, paddingBottom: 4, minWidth: 0 }}>
                    <h3 style={{ margin: '0 0 6px', fontSize: 'clamp(16px, 4vw, 24px)', fontWeight: 800, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title}
                    </h3>
                    
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: C.textSub, flexWrap: 'wrap' }}>
                      <span>{item.year}</span>
                      <span>•</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Star size={11} fill="#FBBF24" color="#FBBF24" /> {item.rating.toFixed(1)}</span>
                      {item.genres[0] && (
                        <>
                          <span>•</span>
                          <span style={{ background: 'rgba(248,249,251,0.08)', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: C.text }}>
                            {item.genres[0]}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── GLASSMORPHIC OTT PLATFORM SELECTOR ─────────────────────────────────────
function OttSelector({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const platforms = [
    { id: 'all', name: 'All Platforms', label: '✨' },
    { id: 'nf', name: 'Netflix', color: '#E50914', short: 'N' },
    { id: 'hs', name: 'Hotstar', color: '#00A0E2', short: 'H' },
    { id: 'pv', name: 'Prime', color: '#00A8E1', short: 'P' },
  ];

  return (
    <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingInline: '4vw', marginBottom: 32, scrollbarWidth: 'none' }}>
      {platforms.map(p => {
        const isSel = selected === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 12,
              cursor: 'pointer', border: isSel ? `1px solid ${p.color || C.text}` : '1px solid rgba(248,249,251,0.06)',
              background: isSel ? 'rgba(24,28,34,0.75)' : 'rgba(24,28,34,0.3)',
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              color: isSel ? C.text : C.textSub, fontWeight: 600, fontSize: 13,
              transition: 'all 0.25s cubic-bezier(0.25,0.8,0.25,1)',
              boxShadow: isSel ? `0 8px 20px rgba(0,0,0,0.35), inset 0 1px 1px rgba(255,255,255,0.06)` : 'none',
              transform: isSel ? 'scale(1.02)' : 'scale(1)',
              whiteSpace: 'nowrap',
            }}
          >
            {p.short ? (
              <span style={{ width: 16, height: 16, borderRadius: 3, background: p.color, color: '#fff', fontSize: 10, fontWeight: 900, display: 'inline-flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
                {p.short}
              </span>
            ) : <span>{p.label}</span>}
            {p.name}
          </button>
        );
      })}
    </div>
  );
}

// ─── HERO CAROUSEL (scroll-snap) ─────────────────────────────────────────────
function Hero({
  items, onWatch,
}: {
  items: CineItem[];
  onWatch:   (item: CineItem) => void;
  onDetails: (item: CineItem) => void;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const slides = Array.from(container.children) as HTMLElement[];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const i = slides.indexOf(entry.target as HTMLElement);
            if (i !== -1) setActiveIdx(i);
          }
        });
      },
      { root: container, threshold: 0.6 }
    );
    slides.forEach(s => observer.observe(s));
    return () => observer.disconnect();
  }, [items.length]);

  const scrollTo = (i: number) => {
    const container = scrollRef.current;
    if (!container) return;
    const slide = container.children[i] as HTMLElement;
    slide?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
  };

  if (!items.length) return <SkeletonHero />;
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div
        ref={scrollRef}
        style={{
          display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none', msOverflowStyle: 'none' as any,
        }}
      >
        {items.map((item) => (
          <HeroSlide key={item.tmdb_id} item={item} onWatch={onWatch} />
        ))}
      </div>

      <div style={{ position: 'absolute', bottom: '5%', left: '5%', display: 'flex', gap: 6, zIndex: 2 }}>
        {items.map((_, i) => (
          <button
            key={i}
            onClick={() => scrollTo(i)}
            style={{
              width: i === activeIdx ? 24 : 6, height: 6, borderRadius: 3,
              background: i === activeIdx ? C.text : 'rgba(248,249,251,0.2)',
              border: 'none', cursor: 'pointer', padding: 0,
              transition: 'width 0.2s, background 0.2s',
              WebkitTapHighlightColor: 'transparent',
            }}
          />
        ))}
      </div>
    </div>
  );
}

function HeroSlide({ item, onWatch }: {
  item: CineItem;
  onWatch: (item: CineItem) => void;
}) {
  const [imgOk, setImgOk] = useState(false);
  return (
    <div style={{
      flexShrink: 0, width: '100%', height: 'min(92vh, 680px)',
      position: 'relative', overflow: 'hidden', background: C.bg,
      scrollSnapAlign: 'start', scrollSnapStop: 'always',
    }}>
      {item.backdrop && (
        <img
          src={item.backdrop}
          alt=""
          onLoad={() => setImgOk(true)}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center top',
            opacity: imgOk ? 1 : 0, transition: 'opacity 0.35s ease',
            willChange: 'opacity',
          }}
        />
      )}

      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(15,17,21,1) 0%, rgba(15,17,21,0.75) 35%, rgba(15,17,21,0.2) 65%, rgba(15,17,21,0.05) 100%)',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to right, rgba(15,17,21,0.6) 0%, transparent 60%)',
      }} />

      <div style={{ position: 'absolute', bottom: '11%', left: '5%', right: '5%', maxWidth: 580, zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 9px', borderRadius: 4, border: `1px solid ${C.border}`,
            background: 'rgba(15,17,21,0.55)', backdropFilter: 'blur(4px)',
          }}>
            {item.type === 'movie' ? <Film size={10} color={C.textSub} /> : <Tv size={10} color={C.textSub} />}
            <span style={{ fontSize: 10, fontWeight: 700, color: C.textSub, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
              {item.type === 'movie' ? 'Movie' : 'TV Series'}
            </span>
          </div>
          {item.year > 0 && (
            <span style={{ fontSize: 12, color: C.textSub, fontWeight: 500 }}>{item.year}</span>
          )}
          {item.rating > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.textSub }}>
              <Star size={11} color="#FBBF24" fill="#FBBF24" />
              <span style={{ fontWeight: 600, color: C.text }}>{item.rating.toFixed(1)}</span>
              <span style={{ color: C.textSub }}>/10</span>
            </span>
          )}
        </div>

        <h1 style={{
          margin: '0 0 12px', fontSize: 'clamp(26px, 5.5vw, 58px)',
          fontWeight: 900, color: C.text, lineHeight: 1.05, letterSpacing: '-0.03em',
        }}>{item.title}</h1>

        {item.genres.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {item.genres.slice(0, 4).map(g => (
              <span key={g} style={{
                fontSize: 11, color: C.textSub, fontWeight: 600, letterSpacing: '0.04em',
                padding: '2px 8px', borderRadius: 3, background: 'rgba(248,249,251,0.07)',
                border: `1px solid ${C.border}`,
              }}>{g}</span>
            ))}
          </div>
        )}

        <p style={{
          margin: '0 0 28px', fontSize: 14, color: C.textSub, lineHeight: 1.7,
          display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          maxWidth: 500,
        }}>{item.overview}</p>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => onWatch(item)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 6,
              background: C.text, border: 'none', fontSize: 14, fontWeight: 700, color: C.bg,
              cursor: 'pointer', letterSpacing: '-0.01em', transition: 'opacity 0.15s',
              WebkitTapHighlightColor: 'transparent',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <Play size={15} fill={C.bg} color={C.bg} /> Watch Now
          </button>
        </div>
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
        display: 'flex', alignItems: 'center', gap: 14, padding: '10px 12px', borderRadius: 8, width: '100%', textAlign: 'left',
        background: hov ? C.surface : 'transparent', border: `1px solid ${hov ? C.borderHov : 'transparent'}`,
        cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      <span style={{ fontSize: 12, color: C.textSub, width: 18, textAlign: 'center', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
        {rank}
      </span>

      <div style={{ flexShrink: 0, width: 44, height: 64, borderRadius: 5, overflow: 'hidden', background: C.elevated, position: 'relative' }}>
        {item.poster && (
          <img
            src={item.poster} alt={item.title} loading="lazy"
            onLoad={() => setImgLoaded(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.2s' }}
          />
        )}
        {hov && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,17,21,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Play size={13} fill={C.text} color={C.text} />
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.text, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{item.title}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: C.textSub }}>{item.year || '—'}</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: C.textSub, padding: '1px 6px', borderRadius: 3, border: `1px solid ${C.border}`, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {item.type === 'movie' ? 'Movie' : 'TV'}
          </span>
          {item.rating > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: C.textSub }}>
              <Star size={10} /> {item.rating.toFixed(1)}
            </span>
          )}
          {item.genres.slice(0, 2).map(g => (
            <span key={g} style={{ fontSize: 11, color: C.textSub, opacity: 0.7 }}>{g}</span>
          ))}
        </div>
      </div>

      <ChevronRight size={14} color={hov ? C.textSub : 'transparent'} style={{ flexShrink: 0, transition: 'color 0.15s' }} />
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
    const handlePop = () => { onClose(); };
    window.addEventListener('popstate', handlePop);
    return () => {
      window.removeEventListener('popstate', handlePop);
      if (window.history.state?.searchOverlay) {
        window.history.replaceState(null, document.title);
      }
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
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(15,17,21,0.96)', backdropFilter: 'blur(12px)',
        display: 'flex', flexDirection: 'column',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ padding: '20px 6vw 20px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={onClose}
            style={{
              flexShrink: 0, width: 38, height: 38, borderRadius: 8,
              background: C.surface, border: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: C.text, transition: 'border-color 0.15s',
              WebkitTapHighlightColor: 'transparent',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = C.borderHov)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
            aria-label="Go back"
          >
            <ChevronLeft size={18} />
          </button>

          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={17} color={C.textSub} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search movies and TV shows…"
              style={{
                width: '100%', padding: '12px 44px 12px 42px',
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
                fontSize: 16, color: C.text, outline: 'none', fontFamily: 'inherit',
              }}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.textSub, WebkitTapHighlightColor: 'transparent' }}
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 6vw' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 10, borderRadius: 8, background: C.surface }}>
                  <div style={{ flexShrink: 0, width: 52, height: 76, borderRadius: 6, background: C.elevated }} className="cv-sk" />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 13, width: '55%', borderRadius: 4, background: C.elevated, marginBottom: 8 }} className="cv-sk" />
                    <div style={{ height: 10, width: '30%', borderRadius: 4, background: C.elevated }} className="cv-sk" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loading && results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {results.map((item, idx) => (
                <SearchListRow
                  key={`${item.type}-${item.tmdb_id}`}
                  item={item}
                  rank={idx + 1}
                  onClick={() => { onSelect(item); onClose(); }}
                />
              ))}
            </div>
          )}
          {!loading && query && results.length === 0 && (
            <p style={{ color: C.textSub, fontSize: 14, textAlign: 'center', marginTop: 48 }}>
              No results for "{query}"
            </p>
          )}
          {!query && (
            <p style={{ color: C.textSub, fontSize: 14, textAlign: 'center', marginTop: 48, opacity: 0.6 }}>
              Start typing to search…
            </p>
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

  useEffect(() => {
    setEntries(getContinueWatching());
    const handler = () => setEntries(getContinueWatching());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const scroll = (dir: 'l' | 'r') => {
    scrollRef.current?.scrollBy({ left: dir === 'l' ? -480 : 480, behavior: 'smooth' });
  };

  const handleRemove = (tmdbId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    removeContinueWatchingEntry(tmdbId);
    setEntries(getContinueWatching());
  };

  if (!entries.length) return null;

  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingInline: '4vw', marginBottom: 16 }}>
        <span style={{ color: C.textSub }}><Clock size={14} /></span>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>
          Continue Watching
        </h2>
      </div>

      <div style={{ position: 'relative' }}>
        <button className="cv-arrow"
          onClick={() => scroll('l')}
          style={{
            position: 'absolute', left: '1vw', top: '50%', transform: 'translateY(-50%)',
            zIndex: 2, width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(24,28,34,0.7)', backdropFilter: 'blur(8px)', border: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: C.text,
          }}
        ><ChevronLeft size={18} /></button>

        <div
          ref={scrollRef}
          style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingInline: '4vw', scrollbarWidth: 'none', paddingBottom: 4 }}
        >
          {entries.map(entry => {
            const { item, season, episode } = entry;
            return (
              <div
                key={item.tmdb_id}
                style={{ flexShrink: 0, width: 200, borderRadius: 12, overflow: 'hidden', background: GLASS.background, backdropFilter: GLASS.backdropFilter, WebkitBackdropFilter: GLASS.WebkitBackdropFilter, border: `1px solid ${C.border}`, position: 'relative', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.25)' }}
                onClick={() => onPlay(entry)}
                onMouseEnter={e => (e.currentTarget.style.borderColor = C.borderHov)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
              >
                <div style={{ width: '100%', aspectRatio: '16/9', position: 'relative', overflow: 'hidden', background: C.elevated }}>
                  {item.backdrop && (
                    <img
                      src={item.backdrop} alt={item.title} loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  )}
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(to top, rgba(15,17,21,0.85) 0%, transparent 60%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'rgba(248,249,251,0.9)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Play size={12} fill={C.bg} color={C.bg} style={{ marginLeft: 1 }} />
                    </div>
                  </div>
                  <div style={{
                    position: 'absolute', bottom: 6, left: 8,
                    fontSize: 10, fontWeight: 700, color: C.text,
                    background: 'rgba(15,17,21,0.8)', padding: '2px 7px', borderRadius: 4,
                  }}>
                    {item.type === 'movie'
                      ? 'Movie'
                      : item.isAnime
                        ? `Ep ${episode}`
                        : `S${season} · E${episode}`}
                  </div>
                  <button
                    onClick={(e) => handleRemove(item.tmdb_id, e)}
                    style={{
                      position: 'absolute', top: 6, right: 6,
                      width: 22, height: 22, borderRadius: '50%',
                      background: 'rgba(15,17,21,0.75)', border: 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', color: C.textSub, transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={e => (e.currentTarget.style.color = C.textSub)}
                  ><Trash2 size={11} /></button>
                </div>

                <div style={{ padding: '8px 10px 10px' }}>
                  <p style={{
                    fontSize: 12, fontWeight: 600, color: C.text, margin: 0,
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
                  }}>{item.title}</p>
                  <p style={{ fontSize: 11, color: C.textSub, margin: '3px 0 0' }}>
                    {item.year}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={() => scroll('r')}
          style={{
            position: 'absolute', right: '1vw', top: '50%', transform: 'translateY(-50%)',
            zIndex: 2, width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(24,28,34,0.7)', backdropFilter: 'blur(8px)', border: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: C.text,
          }}
        ><ChevronRight size={18} /></button>
      </div>
    </section>
  );
}

// ─── NAV ──────────────────────────────────────────────────────────────────────
function Nav({ onSearchOpen }: { onSearchOpen: () => void }) {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
      padding: '0 4vw', height: 56,
      background: scrolled ? 'rgba(15,17,21,0.92)' : 'transparent',
      borderBottom: scrolled ? `1px solid ${C.border}` : 'none',
      backdropFilter: scrolled ? 'blur(12px)' : 'none',
      WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
      transition: 'background 0.2s, border-color 0.2s',
      display: 'flex', alignItems: 'center',
    }}>
      <button
        onClick={() => navigate('/')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 18, fontWeight: 800, color: C.text, letterSpacing: '-0.04em',
          padding: 0, flex: 1, textAlign: 'left',
        }}
      >
        Cine<span style={{ color: C.textSub, fontWeight: 400 }}>verse</span>
      </button>

      <button
        onClick={onSearchOpen}
        aria-label="Search"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 38, height: 38, borderRadius: 8,
          background: scrolled ? C.surface : 'rgba(248,249,251,0.08)',
          border: `1px solid ${C.border}`,
          color: C.text, cursor: 'pointer',
          transition: 'border-color 0.15s, background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = C.borderHov)}
        onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
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

  const [heroItems,      setHeroItems]      = useState<CineItem[]>([]);
  const [trendingMovies, setTrendingMovies] = useState<CineItem[]>([]);
  const [trendingShows,  setTrendingShows]  = useState<CineItem[]>([]);
  const [popularMovies,  setPopularMovies]  = useState<CineItem[]>([]);
  const [popularShows,   setPopularShows]   = useState<CineItem[]>([]);
  const [topRated,       setTopRated]       = useState<CineItem[]>([]);
  const [upcoming,       setUpcoming]       = useState<CineItem[]>([]);
  
  const [loadingHero,   setLoadingHero]   = useState(true);
  const [loadingTrendM, setLoadingTrendM] = useState(true);
  const [loadingTrendS, setLoadingTrendS] = useState(true);
  const [loadingPopM,   setLoadingPopM]   = useState(true);
  const [loadingPopS,   setLoadingPopS]   = useState(true);
  const [loadingTopR,   setLoadingTopR]   = useState(true);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);

  const [cwKey, setCwKey] = useState(0);

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
  const goDetails = useCallback((item: CineItem) => {
    navigate(`/details/${item.type}/${item.tmdb_id}`, { state: { item } });
  }, [navigate]);

  useEffect(() => {
    tmdb.getTrending('movie').then(data => {
      const items = normPage(data, 'movie', 6).filter(i => i.backdrop);
      setHeroItems(items);
      setLoadingHero(false);
    }).catch(() => setLoadingHero(false));

    tmdb.getTrending('movie').then(data => {
      setTrendingMovies(normPage(data, 'movie', 20));
      setLoadingTrendM(false);
    }).catch(() => setLoadingTrendM(false));

    tmdb.getTrending('tv').then(data => {
      setTrendingShows(normPage(data, 'tv', 20));
      setLoadingTrendS(false);
    }).catch(() => setLoadingTrendS(false));

    tmdb.getPopular('movie').then(data => {
      setPopularMovies(normPage(data, 'movie', 20));
      setLoadingPopM(false);
    }).catch(() => setLoadingPopM(false));

    tmdb.getPopular('tv').then(data => {
      setPopularShows(normPage(data, 'tv', 20));
      setLoadingPopS(false);
    }).catch(() => setLoadingPopS(false));

    tmdb.getTopRated('movie').then(data => {
      setTopRated(normPage(data, 'movie', 20));
      setLoadingTopR(false);
    }).catch(() => setLoadingTopR(false));

    tmdb.getUpcoming().then(data => {
      setUpcoming(normPage(data, 'movie', 16));
      setLoadingUpcoming(false);
    }).catch(() => setLoadingUpcoming(false));
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'Inter, system-ui, sans-serif', overflowX: 'hidden' }}>
      <Nav onSearchOpen={() => setSearchOpen(true)} />

      {/* 1. Hero Slider */}
      {loadingHero
        ? <SkeletonHero />
        : <Hero items={heroItems} onWatch={goPlayItem} onDetails={goDetails} />
      }

      <div style={{ paddingTop: 32, paddingBottom: 64 }}>
        {/* 2. Continue Watching Rail */}
        <ContinueWatchingRail
          key={cwKey}
          onPlay={goPlay}
          onRemove={() => setCwKey(k => k + 1)}
        />

        {/* 3. Top 10 Movies Rail (One Banner-at-a-time Carousel) */}
        <TopTenRail 
          title="Trending Movies" 
          items={trendingMovies} 
          loading={loadingTrendM} 
          onItemClick={goPlayItem} 
        />

        {/* 4. Top 10 Series Rail (One Banner-at-a-time Carousel) */}
        <TopTenRail 
          title="Trending TV Shows" 
          items={trendingShows} 
          loading={loadingTrendS} 
          onItemClick={goPlayItem} 
        />

        {/* 5. Glassmorphic OTT Platform Row */}
        <OttSelector 
          selected={selectedOtt} 
          onSelect={(id) => setSelectedOtt(id)} 
        />

        {/* 6. Curated Category Rails (Filtered smoothly according to current OTT selection) */}
        <Rail title={selectedOtt === 'all' ? "Trending Movies" : "Trending Content"} icon={<TrendingUp size={14} />} items={filterItemsByOtt(trendingMovies, selectedOtt)} loading={loadingTrendM} onItemClick={goPlayItem} />
        <Rail title={selectedOtt === 'all' ? "Trending TV Shows" : "Popular Streams"} icon={<Tv size={14} />} items={filterItemsByOtt(trendingShows, selectedOtt)} loading={loadingTrendS} onItemClick={goPlayItem} />
        <Rail title="Popular Movies" icon={<Film size={14} />} items={filterItemsByOtt(popularMovies, selectedOtt)} loading={loadingPopM} onItemClick={goPlayItem} />
        <Rail title="Popular TV Shows" icon={<Tv size={14} />} items={filterItemsByOtt(popularShows, selectedOtt)} loading={loadingPopS} onItemClick={goPlayItem} />
        <Rail title="Top Rated Content" icon={<Star size={14} />} items={filterItemsByOtt(topRated, selectedOtt)} loading={loadingTopR} onItemClick={goPlayItem} />
        {selectedOtt === 'all' && (
          <Rail title="Coming Soon" icon={<Film size={14} />} items={upcoming} loading={loadingUpcoming} onItemClick={goPlayItem} />
        )}
      </div>

      {/* Footer */}
      <footer style={{
        borderTop: `1px solid ${C.border}`, padding: '32px 4vw',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center',
      }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: C.text, letterSpacing: '-0.04em' }}>
          Cine<span style={{ color: C.textSub, fontWeight: 400 }}>verse</span>
        </span>
        <p style={{ fontSize: 12, color: C.textSub, margin: 0 }}>
          Discover. Watch. Experience. · A part of{' '}
          <a href="https://www.streamverse.fun/" target="_blank" rel="noopener noreferrer"
            style={{ color: C.textSub, textDecoration: 'none', fontWeight: 600 }}>
            StreamVerse
          </a>
        </p>
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
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: C.surface, border: `1px solid ${C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = s.fill + '55')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={s.fill}><path d={s.path} /></svg>
            </a>
          ))}
        </div>
        <p style={{ fontSize: 10, color: C.textSub, margin: 0 }}>
          © {new Date().getFullYear()} Cineverse. All rights reserved.
        </p>
      </footer>

      {/* Search Overlay Container */}
      {searchOpen && (
        <SearchOverlay
          onClose={() => setSearchOpen(false)}
          onSelect={goPlay}
        />
      )}

      <style>{`
        *::-webkit-scrollbar { display: none; }
        * { -ms-overflow-style: none; scrollbar-width: none; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        *:focus { outline: none; }
        *:focus-visible { outline: none; }
        button, a, input { -webkit-tap-highlight-color: transparent; outline: none; }
        @keyframes cv-shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        .cv-sk {
          background: linear-gradient(90deg, ${C.surface} 25%, ${C.elevated} 50%, ${C.surface} 75%);
          background-size: 200% 100%;
          animation: cv-shimmer 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
