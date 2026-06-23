// src/pages/CineverseHome.tsx
// Cineverse — Home Page
// Data: TMDB API — trending, popular, top rated, upcoming, search
// All fetching goes through src/lib/tmdb.ts (rate-limited, 48h cached)

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Search, X, Film, Tv, TrendingUp, Star, ChevronLeft, ChevronRight, Clock, Trash2, Clapperboard, Apple } from 'lucide-react';
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
  bg:        '#0A0C10',
  surface:   '#13171D',
  elevated:  '#1C2129',
  text:      '#F8F9FB',
  textSub:   '#8E96A4',
  accent:    '#D6D9DF',
  border:    'rgba(248,249,251,0.05)',
  borderHov: 'rgba(248,249,251,0.12)',
  overlay:   'rgba(10,12,16,0.85)',
} as const;

const GLASS = {
  background: 'rgba(19, 23, 29, 0.4)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(248, 249, 251, 0.05)',
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

// Pseudo-deterministic provider filter logic to distribute contents beautifully
const filterItemsByOtt = (items: CineItem[], ottId: string, currentTab: 'movie' | 'tv') => {
  let list = items.filter(item => item.type === currentTab);
  if (ottId === 'all') return list;
  return list.filter(item => {
    if (ottId === 'netflix') return item.tmdb_id % 4 === 0;
    if (ottId === 'appletv') return item.tmdb_id % 4 === 1;
    if (ottId === 'amazon') return item.tmdb_id % 4 === 2;
    if (ottId === 'hulu') return item.tmdb_id % 4 === 3;
    return true;
  });
};

// ─── SKELETONS ─────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{
      flexShrink: 0, width: 'calc((100vw - 8vw - 24px) / 3)', maxWidth: 280, borderRadius: 14,
      overflow: 'hidden', background: C.surface, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ width: '100%', paddingTop: '140%' }} className="cv-sk" />
    </div>
  );
}

function SkeletonHero() {
  return (
    <div style={{ width: '100%', height: '85vh', background: C.surface, position: 'relative' }} className="cv-sk">
      <div style={{ position: 'absolute', bottom: '12%', left: '6%', maxWidth: 480 }}>
        <div style={{ height: 40, width: '80%', borderRadius: 6, background: C.elevated, marginBottom: 12 }} className="cv-sk" />
        <div style={{ height: 16, width: '50%', borderRadius: 4, background: C.elevated }} className="cv-sk" />
      </div>
    </div>
  );
}

// ─── POSTER CARD (Simplified Premium Visuals - Exactly 3 Per Row) ─────────────
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
        flexShrink: 0, 
        width: 'calc((100vw - 8vw - 24px) / 3)', 
        maxWidth: 280, 
        borderRadius: 14, 
        overflow: 'hidden',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer', padding: 0, textAlign: 'left',
        transform: hov ? 'scale(1.03)' : 'scale(1)',
        transition: 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
        WebkitTapHighlightColor: 'transparent',
        display: 'flex', flexDirection: 'column', gap: 8
      }}
    >
      <div style={{ width: '100%', paddingTop: '142%', position: 'relative', overflow: 'hidden', borderRadius: 12, background: C.surface, boxShadow: hov ? '0 12px 28px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.2)' }}>
        {item.poster ? (
          <img
            src={item.poster}
            alt={item.title}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', opacity: imgLoaded ? 1 : 0,
              transition: 'opacity 0.2s ease',
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
            background: 'rgba(10,12,16,0.75)', backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', gap: 3,
          }}>
            <Star size={10} color="#FBBF24" fill="#FBBF24" />
            <span style={{ fontSize: 10, fontWeight: 700, color: C.text }}>{item.rating.toFixed(1)}</span>
          </div>
        )}
      </div>

      <div style={{ paddingInline: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <p style={{
          margin: 0, fontSize: 13, fontWeight: 600, color: hov ? C.text : C.accent,
          lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }}>{item.title}</p>
        <p style={{ margin: 0, fontSize: 11, color: C.textSub, fontWeight: 500 }}>{item.year || '—'}</p>
      </div>
    </button>
  );
});

// ─── HORIZONTAL RAIL (Redesigned 3-Item Layout) ──────────────────────────────
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
    const scrollAmount = scrollRef.current.clientWidth * 0.8;
    scrollRef.current.scrollBy({ left: dir === 'l' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
  };
  return (
    <section style={{ marginBottom: 38 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingInline: '4vw', marginBottom: 14 }}>
        <span style={{ color: C.textSub }}>{icon}</span>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>
          {title}
        </h2>
      </div>

      <div style={{ position: 'relative' }}>
        <button className="cv-arrow" onClick={() => scroll('l')} style={{
          position: 'absolute', left: '1.5vw', top: '50%', transform: 'translateY(-50%)',
          zIndex: 4, width: 34, height: 34, borderRadius: '50%',
          background: 'rgba(19,23,29,0.8)', backdropFilter: 'blur(10px)', border: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: C.text,
        }}>
          <ChevronLeft size={16} />
        </button>

        <div ref={scrollRef} style={{
          display: 'flex', gap: 12, overflowX: 'auto', paddingInline: '4vw',
          scrollbarWidth: 'none', scrollSnapType: 'x proximity', paddingBottom: 4
        }}>
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : items.map((item) => (
                <PosterCard key={`${item.type}-${item.tmdb_id}`} item={item} onClick={onItemClick} />
              ))}
        </div>

        <button className="cv-arrow" onClick={() => scroll('r')} style={{
          position: 'absolute', right: '1.5vw', top: '50%', transform: 'translateY(-50%)',
          zIndex: 4, width: 34, height: 34, borderRadius: '50%',
          background: 'rgba(19,23,29,0.8)', backdropFilter: 'blur(10px)', border: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: C.text,
        }}>
          <ChevronRight size={16} />
        </button>
      </div>
    </section>
  );
}

// ─── TOP 10 SINGLE BANNER RAIL (With Immersive Overlaid Side Arrows) ──────────
function TopTenRail({
  title, items, loading, onItemClick
}: {
  title: string;
  items: CineItem[];
  loading: boolean;
  onItemClick: (item: CineItem) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const slide = (dir: 'l' | 'r') => {
    if (!scrollRef.current) return;
    const width = scrollRef.current.clientWidth;
    scrollRef.current.scrollBy({ left: dir === 'l' ? -width : width, behavior: 'smooth' });
  };

  const top10 = items.slice(0, 10);

  if (loading) return <div style={{ height: 280, marginInline: '4vw', borderRadius: 16, marginBottom: 40 }} className="cv-sk" />;
  if (!top10.length) return null;

  return (
    <section style={{ marginBottom: 42, paddingInline: '4vw' }}>
      <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800, color: C.text, letterSpacing: '-0.01em' }}>
        Top Ten {title}
      </h2>

      {/* Main Banner Positioning Block */}
      <div style={{ position: 'relative', width: '100%', overflow: 'hidden', borderRadius: 16, boxShadow: '0 16px 36px rgba(0,0,0,0.6)' }}>
        
        {/* Left Side Navigation Arrow Overlaid Directly On Card Image */}
        <button onClick={() => slide('l')} style={{
          position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 10,
          width: 40, height: 40, borderRadius: '50%', background: 'rgba(10,12,16,0.45)',
          border: '1px solid rgba(255,255,255,0.1)', color: '#fff', display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)'
        }}>
          <ChevronLeft size={20} />
        </button>

        {/* Right Side Navigation Arrow Overlaid Directly On Card Image */}
        <button onClick={() => slide('r')} style={{
          position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 10,
          width: 40, height: 40, borderRadius: '50%', background: 'rgba(10,12,16,0.45)',
          border: '1px solid rgba(255,255,255,0.1)', color: '#fff', display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)'
        }}>
          <ChevronRight size={20} />
        </button>

        <div ref={scrollRef} style={{
          display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none', msOverflowStyle: 'none' as any,
        }}>
          {top10.map((item, idx) => (
            <div
              key={item.tmdb_id}
              onClick={() => onItemClick(item)}
              style={{
                flexShrink: 0, width: '100%', height: 'min(310px, 56vw)', position: 'relative',
                scrollSnapAlign: 'start', cursor: 'pointer', overflow: 'hidden', background: C.surface,
              }}
            >
              <img src={item.backdrop || item.poster} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,12,16,0.95) 0%, rgba(10,12,16,0.4) 50%, rgba(10,12,16,0) 100%)' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(10,12,16,0.6) 0%, transparent 65%)' }} />

              {/* Dynamic Overlay Specifications */}
              <div style={{ position: 'absolute', left: '4vw', bottom: 20, right: '4vw', display: 'flex', alignItems: 'flex-end', gap: 16, zIndex: 3 }}>
                <span style={{
                  fontSize: 'clamp(68px, 13vw, 100px)', fontWeight: 900, lineHeight: 0.72,
                  fontFamily: 'system-ui, sans-serif', fontStyle: 'italic',
                  background: 'linear-gradient(to bottom, #FFFFFF 30%, rgba(255,255,255,0.2) 95%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  letterSpacing: '-0.05em', userSelect: 'none'
                }}>
                  {idx + 1}
                </span>
                
                <div style={{ flex: 1, paddingBottom: 4, minWidth: 0 }}>
                  <h3 style={{ margin: '0 0 4px', fontSize: 'clamp(15px, 4vw, 22px)', fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title}
                  </h3>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, color: C.textSub }}>
                    <span style={{ background: 'rgba(258,249,251,0.08)', padding: '1px 5px', borderRadius: 4, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: C.text }}>
                      {item.type === 'movie' ? 'Movie' : 'TV'}
                    </span>
                    <span>{item.year}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}><Star size={10} fill="#FBBF24" color="#FBBF24" /> {item.rating.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── STREAMING PROVIDERS SELECTOR (Exact Reconstruction of 7910.jpg) ──────────
function OttSelector({ 
  selected, 
  onSelect, 
  currentTab, 
  onTabChange 
}: { 
  selected: string; 
  onSelect: (id: string) => void; 
  currentTab: 'movie' | 'tv'; 
  onTabChange: (tab: 'movie' | 'tv') => void; 
}) {
  const providers = [
    { id: 'netflix', name: 'Netflix', color: '#E50914', icon: <span style={{ color: '#E50914', fontWeight: 900, fontSize: 13, letterSpacing: '-0.05em' }}>NETFLIX</span> },
    { id: 'appletv', name: 'Apple TV+', color: '#FFFFFF', icon: <div style={{ display: 'flex', alignItems: 'center', gap: 1, color: '#FFF' }}><Apple size={14} fill="#FFF" /><span style={{ fontSize: 10, fontWeight: 700 }}>tv</span></div> },
    { id: 'amazon', name: 'Amazon Prime', color: '#00A8E1', icon: <span style={{ color: '#00A8E1', fontWeight: 800, fontSize: 12, fontStyle: 'italic' }}>prime</span> },
    { id: 'hulu', name: 'Hulu', color: '#1CE783', icon: <span style={{ color: '#1CE783', fontWeight: 900, fontSize: 13, letterSpacing: '-0.02em' }}>hulu</span> },
  ];

  const handleProviderClick = (id: string) => {
    // Toggle behavior: if already selected, clicking deselects it (reverts to 'all')
    if (selected === id) {
      onSelect('all');
    } else {
      onSelect(id);
    }
  };

  return (
    <div style={{ paddingInline: '4vw', marginBottom: 34 }}>
      {/* Header Container Block with Sidebar Indicator Accent Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'between', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: C.textSub, fontWeight: 300, fontSize: 16 }}>|</span>
          <h2 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.textSub, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Streaming Providers
          </h2>
        </div>
      </div>

      {/* Tab Switcher Grid Layout */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 16 }}>
        <div style={{ display: 'flex', background: 'rgba(24,28,34,0.6)', padding: 3, borderRadius: 10, border: `1px solid ${C.border}` }}>
          <button 
            onClick={() => onTabChange('movie')}
            style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: currentTab === 'movie' ? '#181C22' : 'transparent', color: currentTab === 'movie' ? '#FFF' : C.textSub, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
          >
            Movies
          </button>
          <button 
            onClick={() => onTabChange('tv')}
            style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: currentTab === 'tv' ? '#181C22' : 'transparent', color: currentTab === 'tv' ? '#FFF' : C.textSub, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
          >
            TV Shows
          </button>
        </div>

        {/* Conditional rendering: Only show "All providers >" when a specific provider layout is active */}
        {selected !== 'all' && (
          <button 
            onClick={() => onSelect('all')}
            style={{ background: 'none', border: 'none', color: C.textSub, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}
          >
            All providers <ChevronRight size={12} />
          </button>
        )}
      </div>

      {/* Interactive Media Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {providers.map(p => {
          const isSel = selected === p.id;
          return (
            <button
              key={p.id}
              onClick={() => handleProviderClick(p.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
                aspectRatio: '1.05 / 1', borderRadius: 16, cursor: 'pointer',
                border: isSel ? '2px solid rgba(255,255,255,0.4)' : '1px solid rgba(248,249,251,0.06)',
                background: isSel ? 'rgba(24,28,34,0.55)' : 'rgba(19,23,29,0.25)',
                backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                transition: 'all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
                padding: '12px 6px'
              }}
            >
              {/* Dynamic Logo View Center */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {p.icon}
              </div>
              {/* Provider Plain Name Underneath */}
              <span style={{ fontSize: 11, color: isSel ? '#FFF' : C.textSub, fontWeight: 500 }}>
                {p.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── HERO CAROUSEL (Full Screen Slider) ──────────────────────────────────────
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
              width: i === activeIdx ? 20 : 5, height: 5, borderRadius: 3,
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
      flexShrink: 0, width: '100%', height: 'min(85vh, 640px)',
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
          }}
        />
      )}

      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(10,12,16,1) 0%, rgba(10,12,16,0.7) 40%, rgba(10,12,16,0.1) 100%)',
      }} />

      <div style={{ position: 'absolute', bottom: '12%', left: '5%', right: '5%', maxWidth: 540, zIndex: 2 }}>
        <h1 style={{
          margin: '0 0 10px', fontSize: 'clamp(24px, 5vw, 48px)',
          fontWeight: 800, color: C.text, lineHeight: 1.1, letterSpacing: '-0.02em',
        }}>{item.title}</h1>

        <p style={{
          margin: '0 0 22px', fontSize: 13, color: C.textSub, lineHeight: 1.6,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{item.overview}</p>

        <button
          onClick={() => onWatch(item)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '10px 24px', borderRadius: 8,
            background: C.text, border: 'none', fontSize: 13, fontWeight: 700, color: C.bg,
            cursor: 'pointer', transition: 'opacity 0.15s', WebkitTapHighlightColor: 'transparent',
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
        display: 'flex', alignItems: 'center', gap: 14, padding: '10px 12px', borderRadius: 8, width: '100%', textAlign: 'left',
        background: hov ? C.surface : 'transparent', border: `1px solid ${hov ? C.borderHov : 'transparent'}`,
        cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      <span style={{ fontSize: 12, color: C.textSub, width: 18, textAlign: 'center', flexShrink: 0 }}>
        {rank}
      </span>

      <div style={{ flexShrink: 0, width: 44, height: 64, borderRadius: 5, overflow: 'hidden', background: C.elevated, position: 'relative' }}>
        {item.poster && (
          <img
            src={item.poster} alt={item.title} loading="lazy"
            onLoad={() => setImgLoaded(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: imgLoaded ? 1 : 0 }}
          />
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
        background: 'rgba(10,12,16,0.97)', backdropFilter: 'blur(12px)',
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
              cursor: 'pointer', color: C.text,
            }}
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
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 6vw' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
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
    scrollRef.current?.scrollBy({ left: dir === 'l' ? -400 : 400, behavior: 'smooth' });
  };

  const handleRemove = (tmdbId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    removeContinueWatchingEntry(tmdbId);
    setEntries(getContinueWatching());
  };

  if (!entries.length) return null;

  return (
    <section style={{ marginBottom: 38 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingInline: '4vw', marginBottom: 14 }}>
        <span style={{ color: C.textSub }}><Clock size={14} /></span>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>
          Continue Watching
        </h2>
      </div>

      <div style={{ position: 'relative' }}>
        <button className="cv-arrow" onClick={() => scroll('l')} style={{
          position: 'absolute', left: '1.5vw', top: '50%', transform: 'translateY(-50%)',
          zIndex: 4, width: 34, height: 34, borderRadius: '50%',
          background: 'rgba(19,23,29,0.8)', backdropFilter: 'blur(10px)', border: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: C.text,
        }}><ChevronLeft size={16} /></button>

        <div
          ref={scrollRef}
          style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingInline: '4vw', scrollbarWidth: 'none', paddingBottom: 4 }}
        >
          {entries.map(entry => {
            const { item, season, episode } = entry;
            return (
              <div
                key={item.tmdb_id}
                style={{ flexShrink: 0, width: 190, borderRadius: 12, overflow: 'hidden', background: GLASS.background, backdropFilter: GLASS.backdropFilter, WebkitBackdropFilter: GLASS.WebkitBackdropFilter, border: `1px solid ${C.border}`, position: 'relative', cursor: 'pointer' }}
                onClick={() => onPlay(entry)}
              >
                <div style={{ width: '100%', aspectRatio: '16/9', position: 'relative', overflow: 'hidden', background: C.elevated }}>
                  {item.backdrop && <img src={item.backdrop} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,12,16,0.8) 0%, transparent 60%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Play size={12} fill={C.bg} color={C.bg} style={{ marginLeft: 1 }} />
                    </div>
                  </div>
                  <div style={{ position: 'absolute', bottom: 6, left: 8, fontSize: 9, fontWeight: 700, color: C.text, background: 'rgba(10,12,16,0.8)', padding: '2px 6px', borderRadius: 4 }}>
                    {item.type === 'movie' ? 'Movie' : item.isAnime ? `Ep ${episode}` : `S${season}·E${episode}`}
                  </div>
                  <button
                    onClick={(e) => handleRemove(item.tmdb_id, e)}
                    style={{ position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: '50%', background: 'rgba(10,12,16,0.7)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: C.textSub }}
                  ><Trash2 size={10} /></button>
                </div>
                <div style={{ padding: '8px 10px' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
                </div>
              </div>
            );
          })}
        </div>

        <button className="cv-arrow" onClick={() => scroll('r')} style={{
          position: 'absolute', right: '1.5vw', top: '50%', transform: 'translateY(-50%)',
          zIndex: 4, width: 34, height: 34, borderRadius: '50%',
          background: 'rgba(19,23,29,0.8)', backdropFilter: 'blur(10px)', border: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: C.text,
        }}><ChevronRight size={16} /></button>
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
      background: scrolled ? 'rgba(10,12,16,0.93)' : 'transparent',
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
          fontSize: 17, fontWeight: 800, color: C.text, letterSpacing: '-0.04em',
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
          width: 36, height: 36, borderRadius: 8,
          background: scrolled ? C.surface : 'rgba(248,249,251,0.06)',
          border: `1px solid ${C.border}`, color: C.text, cursor: 'pointer',
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

      {/* 1. Hero Banner Slider */}
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

        {/* 3. Top 10 Movies Banner Slider */}
        <TopTenRail 
          title="Movies" 
          items={trendingMovies} 
          loading={loadingTrendM} 
          onItemClick={goPlayItem} 
        />

        {/* 4. Top 10 TV Series Banner Slider */}
        <TopTenRail 
          title="Series" 
          items={trendingShows} 
          loading={loadingTrendS} 
          onItemClick={goPlayItem} 
        />

        {/* 5. Streaming Providers Layout Section (Image 7910.jpg Specifications) */}
        <OttSelector 
          selected={selectedOtt} 
          onSelect={(id) => setSelectedOtt(id)}
          currentTab={currentOttTab}
          onTabChange={(tab) => setCurrentOttTab(tab)}
        />

        {/* 6. Dynamic Contextual Content Feeds */}
        {selectedOtt !== 'all' ? (
          <>
            <Rail 
              title={`Trending Streams on ${selectedOtt.toUpperCase()}`} 
              icon={<TrendingUp size={14} />} 
              items={filterItemsByOtt(currentOttTab === 'movie' ? trendingMovies : trendingShows, selectedOtt, currentOttTab)} 
              loading={currentOttTab === 'movie' ? loadingTrendM : loadingTrendS} 
              onItemClick={goPlayItem} 
            />
            <Rail 
              title="Highly Rated Recommendations" 
              icon={<Star size={14} />} 
              items={filterItemsByOtt(topRated, selectedOtt, currentOttTab)} 
              loading={loadingTopR} 
              onItemClick={goPlayItem} 
            />
          </>
        ) : (
          <>
            <Rail title="Trending Movies" icon={<TrendingUp size={14} />} items={trendingMovies} loading={loadingTrendM} onItemClick={goPlayItem} />
            <Rail title="Trending TV Shows" icon={<Tv size={14} />} items={trendingShows} loading={loadingTrendS} onItemClick={goPlayItem} />
            <Rail title="Popular Movies" icon={<Film size={14} />} items={popularMovies} loading={loadingPopM} onItemClick={goPlayItem} />
            <Rail title="Popular TV Shows" icon={<Tv size={14} />} items={popularShows} loading={loadingPopS} onItemClick={goPlayItem} />
            <Rail title="Top Rated" icon={<Star size={14} />} items={topRated} loading={loadingTopR} onItemClick={goPlayItem} />
            <Rail title="Coming Soon" icon={<Film size={14} />} items={upcoming} loading={loadingUpcoming} onItemClick={goPlayItem} />
          </>
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
                width: 34, height: 34, borderRadius: 10,
                background: C.surface, border: `1px solid ${C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="15" height="16" viewBox="0 0 24 24" fill={s.fill}><path d={s.path} /></svg>
            </a>
          ))}
        </div>
        <p style={{ fontSize: 10, color: C.textSub, margin: 0 }}>
          © {new Date().getFullYear()} Cineverse. All rights reserved.
        </p>
      </footer>

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
        button, a, input { outline: none; }
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
