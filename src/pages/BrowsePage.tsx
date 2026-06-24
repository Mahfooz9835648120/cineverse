// src/pages/BrowsePage.tsx
// Cineverse — Browse Page
// Route: /browse — the Home page's floating bottom dock already calls
// navigate('/browse'); wire this component to that path in your router
// (e.g. <Route path="/browse" element={<BrowsePage />} /> in App.tsx).

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Film, Tv, Star, ChevronDown, X, Check,
  Home as HomeIcon, Compass, SlidersHorizontal, Loader2,
} from 'lucide-react';
import { tmdb, getTMDBImage } from '@/lib/tmdb';

// ─── DESIGN TOKENS — matched 1:1 to Home / Player ──────────────────────────────
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

// ─── TYPES ──────────────────────────────────────────────────────────────────────
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

// ─── GENRE MAP (combined movie + tv ids, matches Home page's naming) ──────────
const GENRE_MAP: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
  10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
  10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News', 10764: 'Reality',
  10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics',
};

const MOVIE_GENRES = [28, 12, 16, 35, 80, 18, 14, 27, 9648, 10749, 878, 53, 10752, 37, 99]
  .map(id => ({ id, name: GENRE_MAP[id] }));

const TV_GENRES = [10759, 16, 35, 80, 18, 10751, 10762, 9648, 10765, 10768, 99, 37]
  .map(id => ({ id, name: GENRE_MAP[id] }));

// ─── PROVIDERS — same roster + colours as Home ─────────────────────────────────
const PROVIDER_COLORS: Record<string, string> = {
  netflix: '#E50914', prime: '#00A8E1', disney: '#113CCF', hulu: '#1CE783',
  crunchyroll: '#F47521', appletv: '#A2AAAD', max: '#7B2FF7', paramount: '#0064FF',
};

interface ProviderConfig { id: string; name: string; tmdbId: number; logo: string; }

const PROVIDERS: ProviderConfig[] = [
  { id: 'netflix',     name: 'Netflix',     tmdbId: 8,   logo: 'https://image.tmdb.org/t/p/original/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg' },
  { id: 'prime',       name: 'Prime Video', tmdbId: 9,   logo: 'https://image.tmdb.org/t/p/original/68MNXOqbynw78QoXmDqVoQbenu5.jpg' },
  { id: 'disney',      name: 'Disney+',     tmdbId: 337, logo: 'https://image.tmdb.org/t/p/original/97yvRBw1GzX7fXprcF80er19ZsX.jpg' },
  { id: 'hulu',        name: 'Hulu',        tmdbId: 15,  logo: 'https://image.tmdb.org/t/p/original/giwM8XX4V2AQb9vsoN7yti82tKK.jpg' },
  { id: 'crunchyroll', name: 'Crunchyroll', tmdbId: 283, logo: 'https://image.tmdb.org/t/p/original/8VUI8YOzGsRMpv2gjr3WjzL7nWX.jpg' },
  { id: 'appletv',     name: 'Apple TV+',   tmdbId: 350, logo: 'https://image.tmdb.org/t/p/original/peURlLlr8jggOwK53fJ5wdQl05y.jpg' },
  { id: 'max',         name: 'Max',         tmdbId: 1899, logo: 'https://image.tmdb.org/t/p/original/170ZsxBR9PfL5kxQX4HmHdHrYJ8.jpg' },
];

// ─── SORT OPTIONS ───────────────────────────────────────────────────────────────
type SortKey = 'popularity.desc' | 'vote_average.desc' | 'release.desc';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'popularity.desc',   label: 'Popularity' },
  { key: 'vote_average.desc', label: 'Top Rated' },
  { key: 'release.desc',      label: 'Newest' },
];

// ─── NORMALIZATION ──────────────────────────────────────────────────────────────
function normTmdbItem(raw: any, type: 'movie' | 'tv'): CineItem {
  const dateStr = type === 'movie' ? raw.release_date : raw.first_air_date;
  return {
    type,
    title:    raw.title || raw.name || 'Untitled',
    year:     dateStr ? parseInt(String(dateStr).slice(0, 4), 10) : 0,
    overview: raw.overview || '',
    rating:   typeof raw.vote_average === 'number' ? Math.round(raw.vote_average * 10) / 10 : 0,
    genres:   Array.isArray(raw.genre_ids) ? raw.genre_ids.map((id: number) => GENRE_MAP[id]).filter(Boolean) : [],
    tmdb_id:  raw.id,
    poster:   raw.poster_path ? getTMDBImage(raw.poster_path, 'poster') : '',
    backdrop: raw.backdrop_path ? getTMDBImage(raw.backdrop_path, 'backdrop') : '',
  };
}

function normPage(data: any, type: 'movie' | 'tv', limit = 20): CineItem[] {
  const results = data?.results || data?.data?.results || [];
  return results.slice(0, limit).map((r: any) => normTmdbItem(r, type));
}

// ─── TMDB DISCOVER (multi-strategy auth, mirrors Home/Player pattern) ─────────
async function discoverTitles(opts: {
  type: 'movie' | 'tv';
  genreId?: number | null;
  providerId?: number | null;
  sort: SortKey;
  page: number;
}): Promise<any> {
  const base = 'https://api.themoviedb.org/3';
  const sortParam: string = opts.sort === 'release.desc'
    ? (opts.type === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc')
    : opts.sort;

  const params = new URLSearchParams({
    sort_by: sortParam,
    page: String(opts.page),
    'vote_count.gte': sortParam.startsWith('vote_average') ? '200' : '20',
  });
  if (opts.genreId)    params.set('with_genres', String(opts.genreId));
  if (opts.providerId) { params.set('with_watch_providers', String(opts.providerId)); params.set('watch_region', 'US'); }

  // Strategy 1: a generic `discover` helper, if the shared tmdb lib exposes one
  try {
    if (typeof (tmdb as any).discover === 'function') {
      const r = await (tmdb as any).discover(opts.type, {
        genreId: opts.genreId, providerId: opts.providerId, sortBy: sortParam, page: opts.page,
      });
      if (r) return r;
    }
  } catch { /* fall through */ }

  // Strategy 2: bearer read-access token
  const token = (import.meta as any).env?.VITE_TMDB_TOKEN || (import.meta as any).env?.VITE_TMDB_READ_ACCESS_TOKEN || '';
  if (token) {
    try {
      const r = await fetch(`${base}/discover/${opts.type}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) return r.json();
    } catch { /* fall through */ }
  }

  // Strategy 3: v3 api_key query param
  const key = (import.meta as any).env?.VITE_TMDB_API_KEY || (import.meta as any).env?.VITE_TMDB_KEY || '';
  if (key) {
    try {
      const r = await fetch(`${base}/discover/${opts.type}?${params.toString()}&api_key=${key}`);
      if (r.ok) return r.json();
    } catch { /* fall through */ }
  }

  return null;
}

// ─── QUICK SEARCH (debounced, used by the inline search bar) ──────────────────
async function quickSearch(query: string, type: 'movie' | 'tv'): Promise<CineItem[]> {
  if (!query.trim()) return [];
  const base = 'https://api.themoviedb.org/3';
  const token = (import.meta as any).env?.VITE_TMDB_TOKEN || (import.meta as any).env?.VITE_TMDB_READ_ACCESS_TOKEN || '';
  const key   = (import.meta as any).env?.VITE_TMDB_API_KEY || (import.meta as any).env?.VITE_TMDB_KEY || '';

  try {
    if (typeof (tmdb as any).search === 'function') {
      const d = await (tmdb as any).search(query, type);
      if (d) return normPage(d, type, 8);
    }
  } catch { /* fall through */ }

  try {
    const url = `${base}/search/${type}?query=${encodeURIComponent(query)}&page=1${key ? `&api_key=${key}` : ''}`;
    const r = await fetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
    if (r.ok) return normPage(await r.json(), type, 8);
  } catch { /* fall through */ }

  return [];
}

// ─── SKELETON POSTER ────────────────────────────────────────────────────────────
function SkeletonPoster() {
  return (
    <div style={{ width: '100%' }}>
      <div className="cv-sk" style={{ width: '100%', aspectRatio: '2/3', borderRadius: 10, marginBottom: 8 }} />
      <div className="cv-sk" style={{ width: '70%', height: 10, borderRadius: 4 }} />
    </div>
  );
}

// ─── GRID POSTER CARD ───────────────────────────────────────────────────────────
const GridPosterCard = memo(function GridPosterCard({
  item, onClick,
}: { item: CineItem; onClick: (item: CineItem) => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={() => onClick(item)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      <div style={{
        width: '100%', aspectRatio: '2/3', borderRadius: 10, overflow: 'hidden',
        background: C.elevated, border: `1px solid ${C.border}`,
        marginBottom: 8, position: 'relative',
        transform: hover ? 'translateY(-3px) scale(1.02)' : 'none',
        boxShadow: hover ? '0 12px 28px rgba(0,0,0,0.5)' : 'none',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      }}>
        {item.poster ? (
          <img src={item.poster} alt={item.title} loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {item.type === 'movie' ? <Film size={22} color={C.textSub} /> : <Tv size={22} color={C.textSub} />}
          </div>
        )}
        {item.rating > 0 && (
          <div style={{
            position: 'absolute', top: 6, right: 6,
            display: 'flex', alignItems: 'center', gap: 3,
            padding: '2px 6px', borderRadius: 6,
            background: 'rgba(7,9,13,0.72)', backdropFilter: 'blur(8px)',
          }}>
            <Star size={9} fill={C.text} color={C.text} />
            <span style={{ fontSize: 10, fontWeight: 700, color: C.text }}>{item.rating.toFixed(1)}</span>
          </div>
        )}
      </div>
      <p style={{
        margin: 0, fontSize: 12.5, fontWeight: 600, color: C.text, lineHeight: 1.3,
        overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
      }}>{item.title}</p>
      {item.year > 0 && <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textSub }}>{item.year}</p>}
    </button>
  );
});

// ─── GENRE CHIPS ────────────────────────────────────────────────────────────────
function GenreChips({
  genres, selected, onSelect,
}: { genres: { id: number; name: string }[]; selected: number | null; onSelect: (id: number | null) => void }) {
  return (
    <div className="cv-hide-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
      <Chip active={selected === null} label="All Genres" onClick={() => onSelect(null)} />
      {genres.map(g => (
        <Chip key={g.id} active={selected === g.id} label={g.name} onClick={() => onSelect(selected === g.id ? null : g.id)} />
      ))}
    </div>
  );
}

function Chip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0, padding: '7px 14px', borderRadius: 99, fontSize: 12.5, fontWeight: 600,
        border: `1px solid ${active ? C.text : C.border}`,
        background: active ? C.text : C.elevated,
        color: active ? C.bg : C.textSub,
        cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
      }}
    >{label}</button>
  );
}

// ─── PROVIDER CHIPS ─────────────────────────────────────────────────────────────
function ProviderChips({
  selected, onSelect,
}: { selected: number | null; onSelect: (id: number | null) => void }) {
  return (
    <div className="cv-hide-scroll" style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, marginBottom: 18 }}>
      <button
        onClick={() => onSelect(null)}
        style={{
          flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer', width: 56,
        }}
      >
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          border: `1px solid ${selected === null ? C.text : C.border}`,
          background: C.elevated,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Compass size={18} color={selected === null ? C.text : C.textSub} />
        </div>
        <span style={{ fontSize: 9.5, fontWeight: 600, color: selected === null ? C.text : C.textSub, whiteSpace: 'nowrap' }}>All</span>
      </button>

      {PROVIDERS.map(p => {
        const active = selected === p.tmdbId;
        const glow = PROVIDER_COLORS[p.id] || C.accent;
        return (
          <button
            key={p.id}
            onClick={() => onSelect(active ? null : p.tmdbId)}
            style={{
              flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', cursor: 'pointer', width: 56,
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12, overflow: 'hidden',
              border: `1px solid ${active ? glow : C.border}`,
              boxShadow: active ? `0 0 0 3px ${glow}22` : 'none',
              transition: 'all 0.15s',
            }}>
              <img src={p.logo} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
            <span style={{
              fontSize: 9.5, fontWeight: 600, color: active ? C.text : C.textSub,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 56,
            }}>{p.name}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── SORT DROPDOWN ──────────────────────────────────────────────────────────────
function SortDropdown({ sort, onChange }: { sort: SortKey; onChange: (s: SortKey) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = SORTS.find(s => s.key === sort) || SORTS[0];

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 12px', borderRadius: 99, fontSize: 12.5, fontWeight: 600,
          border: `1px solid ${open ? C.borderHov : C.border}`, background: C.elevated,
          color: C.text, cursor: 'pointer',
        }}
      >
        <SlidersHorizontal size={13} />
        {current.label}
        <ChevronDown size={13} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 30,
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 10, padding: 5, minWidth: 160,
          boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
        }}>
          {SORTS.map(s => (
            <button
              key={s.key}
              onClick={() => { onChange(s.key); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '8px 10px', borderRadius: 6,
                background: s.key === sort ? C.elevated : 'transparent',
                border: 'none', color: C.text, fontSize: 12.5, fontWeight: 600,
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              {s.label}
              {s.key === sort && <Check size={13} color={C.text} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── FLOATING GLASS NAVBAR — matches Home / Player exactly ─────────────────────
function Nav({ searchOpen, onToggleSearch }: { searchOpen: boolean; onToggleSearch: () => void }) {
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
      position: 'fixed',
      top: atTop ? 14 : 10,
      left: atTop ? '4vw' : '3vw',
      right: atTop ? '4vw' : '3vw',
      zIndex: 50,
      borderRadius: 18,
      height: atTop ? 58 : 52,
      padding: '0 16px',
      background: atTop ? 'rgba(15,19,24,0.55)' : 'rgba(7,9,13,0.82)',
      backdropFilter: 'blur(32px)',
      WebkitBackdropFilter: 'blur(32px)',
      border: `1px solid ${atTop ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.1)'}`,
      boxShadow: atTop
        ? '0 4px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)'
        : '0 8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)',
      transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: '-0.05em', color: C.text }}>
          Cine<span style={{ color: C.textSub, fontWeight: 300 }}>verse</span>
        </span>
      </button>

      <span style={{ fontSize: 13, fontWeight: 700, color: C.textSub, marginLeft: 4 }}>Browse</span>

      <div style={{ flex: 1 }} />

      <button
        onClick={onToggleSearch}
        aria-label="Search"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: searchOpen ? C.text : 'rgba(248,249,251,0.07)',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          color: searchOpen ? C.bg : C.text, cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >{searchOpen ? <X size={15} /> : <Search size={15} />}</button>
    </nav>
  );
}

// ─── INLINE QUICK SEARCH BAR ────────────────────────────────────────────────────
function QuickSearchBar({
  type, onSelect, onClose,
}: { type: 'movie' | 'tv'; onSelect: (item: CineItem) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      quickSearch(query, type).then(setResults).finally(() => setLoading(false));
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, type]);

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 14, padding: '10px 14px',
      }}>
        <Search size={15} color={C.textSub} />
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={`Search ${type === 'movie' ? 'movies' : 'series'}…`}
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            color: C.text, fontSize: 14, fontFamily: 'inherit',
          }}
        />
        {loading && <Loader2 size={14} color={C.textSub} className="cv-spin" />}
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textSub, display: 'flex' }}>
          <X size={15} />
        </button>
      </div>

      {results.length > 0 && (
        <div style={{
          marginTop: 8, background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 14, overflow: 'hidden',
        }}>
          {results.map(item => (
            <button
              key={item.tmdb_id}
              onClick={() => { onSelect(item); onClose(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '10px 12px', background: 'none', border: 'none',
                borderBottom: `1px solid ${C.border}`, cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{ width: 34, height: 48, borderRadius: 6, overflow: 'hidden', background: C.elevated, flexShrink: 0 }}>
                {item.poster && <img src={item.poster} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
                <p style={{ margin: 0, fontSize: 11, color: C.textSub }}>{item.year || ''}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── FLOATING BOTTOM DOCK — matches Home, with Browse active ───────────────────
function FloatingBottomDock({ onToggleSearch }: { onToggleSearch: () => void }) {
  const navigate = useNavigate();
  return (
    <div style={{
      position: 'fixed', bottom: 18, left: '6vw', right: '6vw', zIndex: 50,
      borderRadius: 20, height: 64,
      background: 'rgba(15,19,24,0.62)',
      backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
      border: '1px solid rgba(255,255,255,0.1)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      <DockButton icon={<HomeIcon size={19} />} label="Home" onClick={() => navigate('/')} />
      <DockButton icon={<Search size={19} />} label="Search" onClick={onToggleSearch} />
      <DockButton icon={<Compass size={19} />} label="Browse" active onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
    </div>
  );
}

function DockButton({
  icon, label, active, onClick,
}: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        background: 'none', border: 'none', cursor: 'pointer',
        color: active ? C.text : C.textSub, padding: '6px 14px',
      }}
    >
      {icon}
      <span style={{ fontSize: 10, fontWeight: 600 }}>{label}</span>
    </button>
  );
}

// ─── EMPTY STATE ────────────────────────────────────────────────────────────────
function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div style={{
      gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 10, padding: '60px 20px', textAlign: 'center',
    }}>
      <Compass size={28} color={C.textSub} />
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text }}>Nothing matches these filters</p>
      <p style={{ margin: 0, fontSize: 12.5, color: C.textSub, maxWidth: 240 }}>
        Try a different genre, provider, or sort order.
      </p>
      <button
        onClick={onClear}
        style={{
          marginTop: 6, padding: '8px 16px', borderRadius: 99, fontSize: 12.5, fontWeight: 600,
          border: `1px solid ${C.border}`, background: C.elevated, color: C.text, cursor: 'pointer',
        }}
      >Clear filters</button>
    </div>
  );
}

// ─── BROWSE PAGE ────────────────────────────────────────────────────────────────
export default function BrowsePage() {
  const navigate = useNavigate();
  const [tab, setTab]             = useState<'movie' | 'tv'>('movie');
  const [genreId, setGenreId]     = useState<number | null>(null);
  const [providerId, setProviderId] = useState<number | null>(null);
  const [sort, setSort]           = useState<SortKey>('popularity.desc');
  const [items, setItems]         = useState<CineItem[]>([]);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]     = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);

  const genres = tab === 'movie' ? MOVIE_GENRES : TV_GENRES;

  // Clear genre filter when it doesn't exist for the newly selected tab
  useEffect(() => {
    if (genreId !== null && !genres.some(g => g.id === genreId)) setGenreId(null);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch whenever any filter changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPage(1);
    setHasMore(true);
    discoverTitles({ type: tab, genreId, providerId, sort, page: 1 })
      .then(d => {
        if (cancelled) return;
        const list = normPage(d, tab, 20);
        setItems(list);
        setHasMore(list.length >= 18);
      })
      .catch(() => { if (!cancelled) { setItems([]); setHasMore(false); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tab, genreId, providerId, sort]);

  const loadMore = useCallback(() => {
    const next = page + 1;
    setLoadingMore(true);
    discoverTitles({ type: tab, genreId, providerId, sort, page: next })
      .then(d => {
        const list = normPage(d, tab, 20);
        setItems(prev => {
          const seen = new Set(prev.map(i => i.tmdb_id));
          return [...prev, ...list.filter(i => !seen.has(i.tmdb_id))];
        });
        setPage(next);
        setHasMore(list.length >= 18);
      })
      .catch(() => setHasMore(false))
      .finally(() => setLoadingMore(false));
  }, [tab, genreId, providerId, sort, page]);

  const goPlay = useCallback((item: CineItem) => {
    navigate(`/player/${item.type === 'movie' ? 'movie' : 'show'}/${item.tmdb_id}`, { state: { item } });
  }, [navigate]);

  const clearFilters = useCallback(() => { setGenreId(null); setProviderId(null); setSort('popularity.desc'); }, []);

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'Inter, system-ui, sans-serif', color: C.text }}>
      <Nav searchOpen={searchOpen} onToggleSearch={() => setSearchOpen(o => !o)} />
      <div style={{ height: 'calc(58px + 28px)' }} />

      <div style={{ paddingInline: '4vw', paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}>

        {searchOpen && (
          <div style={{ marginBottom: 20 }}>
            <QuickSearchBar type={tab} onSelect={goPlay} onClose={() => setSearchOpen(false)} />
          </div>
        )}

        {/* Header */}
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: C.text }}>Browse</h1>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: C.textSub }}>Filter by genre, provider, or sort order.</p>
        </div>

        {/* Movie/TV tab + sort */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 6, padding: 4, borderRadius: 99, background: C.surface, border: `1px solid ${C.border}` }}>
            {(['movie', 'tv'] as const).map(t => {
              const active = tab === t;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 99, fontSize: 12.5, fontWeight: 700,
                    border: 'none', background: active ? C.text : 'transparent',
                    color: active ? C.bg : C.textSub, cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {t === 'movie' ? <Film size={13} /> : <Tv size={13} />}
                  {t === 'movie' ? 'Movies' : 'Series'}
                </button>
              );
            })}
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <SortDropdown sort={sort} onChange={setSort} />
          </div>
        </div>

        {/* Genre chips */}
        <GenreChips genres={genres} selected={genreId} onSelect={setGenreId} />

        {/* Provider chips */}
        <ProviderChips selected={providerId} onSelect={setProviderId} />

        {/* Results grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 6 }}>
          {loading
            ? Array.from({ length: 9 }).map((_, i) => <SkeletonPoster key={i} />)
            : items.length
              ? items.map(item => <GridPosterCard key={`${item.type}-${item.tmdb_id}`} item={item} onClick={goPlay} />)
              : <EmptyState onClear={clearFilters} />
          }
        </div>

        {/* Load more */}
        {!loading && items.length > 0 && hasMore && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 26 }}>
            <button
              onClick={loadMore}
              disabled={loadingMore}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 22px', borderRadius: 99, fontSize: 13, fontWeight: 700,
                border: `1px solid ${C.border}`, background: C.elevated, color: C.text,
                cursor: loadingMore ? 'default' : 'pointer', opacity: loadingMore ? 0.6 : 1,
              }}
            >
              {loadingMore && <Loader2 size={14} className="cv-spin" />}
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>

      <FloatingBottomDock onToggleSearch={() => setSearchOpen(o => !o)} />

      <style>{`
        .cv-hide-scroll::-webkit-scrollbar { display: none; }
        .cv-hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
        .cv-sk {
          background: linear-gradient(90deg, #0F1318 25%, #181D24 37%, #0F1318 63%);
          background-size: 400% 100%;
          animation: cv-shimmer 1.4s ease infinite;
        }
        @keyframes cv-shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        .cv-spin { animation: cv-spin 0.8s linear infinite; }
        @keyframes cv-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
