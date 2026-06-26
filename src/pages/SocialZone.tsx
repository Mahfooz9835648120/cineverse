// src/pages/SocialZone.tsx
// ─── Aniverse · Social Zone ───────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Users, MessageCircle, UserPlus, Search,
  Send, Check, X, Clock, Trash2, UserCheck, Bell,
  ChevronRight, Circle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// ─── PALETTE (matches PlayerPage / AniverseHome) ──────────────────────────────
const C = {
  bg:           '#080C12',
  surface:      '#0E1520',
  elevated:     '#162030',
  text:         '#EFF6FF',
  textSub:      '#94AFC8',
  textMuted:    '#3D5570',
  accent:       '#3B82F6',
  accentBright: '#60A5FA',
  accentDim:    'rgba(59,130,246,0.12)',
  accentBorder: 'rgba(59,130,246,0.22)',
  border:       'rgba(255,255,255,0.07)',
  borderHov:    'rgba(255,255,255,0.12)',
  success:      '#A6D6A6',
  warning:      '#E7C98F',
  error:        '#E19A9A',
  glass: {
    background:           'rgba(8,12,18,0.70)',
    backdropFilter:       'blur(28px)',
    WebkitBackdropFilter: 'blur(28px)',
    border:               '1px solid rgba(255,255,255,0.07)',
    boxShadow:            '0 8px 32px rgba(0,0,0,0.5)',
  },
} as const;

const GPU: React.CSSProperties = { willChange: 'transform, opacity', transform: 'translate3d(0,0,0)' };

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Profile {
  id: string;
  username: string;
  avatar_url?: string | null;
  display_name?: string | null;
}

interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
  sender?: Profile;
  receiver?: Profile;
}

interface Friend {
  id: string;
  user_a: string;
  user_b: string;
  friend?: Profile;
}

interface DmConversation {
  id: string;
  user_a: string;
  user_b: string;
  other?: Profile;
  lastMessage?: DmMessage | null;
  unread?: number;
}

interface DmMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  expires_at: string;
  read_at: string | null;
}

// ─── AVATAR ───────────────────────────────────────────────────────────────────
const Avatar = memo(({ profile, size = 36 }: { profile?: Profile | null; size?: number }) => {
  const initials = (profile?.display_name || profile?.username || '?')
    .slice(0, 2).toUpperCase();
  const hue = [...(profile?.id || 'xx')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 2.5,
      background: profile?.avatar_url ? 'transparent' : `hsl(${hue},45%,28%)`,
      border: `1px solid rgba(255,255,255,0.10)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, overflow: 'hidden', position: 'relative',
    }}>
      {profile?.avatar_url
        ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ fontSize: size * 0.33, fontWeight: 700, color: `hsl(${hue},70%,75%)` }}>{initials}</span>
      }
    </div>
  );
});

// ─── ONLINE DOT ───────────────────────────────────────────────────────────────
const OnlineDot = ({ online }: { online: boolean }) => (
  <span style={{
    width: 8, height: 8, borderRadius: '50%',
    background: online ? C.success : C.textMuted,
    flexShrink: 0, display: 'inline-block',
    boxShadow: online ? `0 0 6px ${C.success}` : 'none',
  }} />
);

// ─── TIME AGO ─────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function expiresIn(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'expired';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
type Tab = 'chats' | 'friends' | 'requests';

export default function SocialZone() {
  const navigate = useNavigate();
  const [me, setMe] = useState<Profile | null>(null);
  const [tab, setTab] = useState<Tab>('chats');
  const [loading, setLoading] = useState(true);

  // Chats
  const [conversations, setConversations] = useState<DmConversation[]>([]);
  const [activeConv, setActiveConv] = useState<DmConversation | null>(null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const msgInputRef = useRef<HTMLTextAreaElement>(null);

  // Friends
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [pendingSent, setPendingSent] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [leaving, setLeaving] = useState(false);
  const handleBack = useCallback(() => { setLeaving(true); setTimeout(() => navigate('/'), 270); }, [navigate]);

  // ── AUTH ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { navigate('/'); return; }
      // Fetch profile
      supabase.from('profiles').select('*').eq('id', data.user.id).single()
        .then(({ data: p }) => {
          setMe(p || { id: data.user!.id, username: data.user!.email?.split('@')[0] || 'User' });
        });
    });
  }, [navigate]);

  // ── LOAD ALL DATA ─────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!me) return;
    setLoading(true);
    try {
      await Promise.all([loadConversations(), loadFriends(), loadRequests()]);
    } finally {
      setLoading(false);
    }
  }, [me]);

  useEffect(() => { if (me) loadAll(); }, [me, loadAll]);

  // ── CONVERSATIONS ─────────────────────────────────────────────────────────
  const loadConversations = async () => {
    if (!me) return;
    const { data } = await supabase
      .from('dm_conversations')
      .select('*')
      .or(`user_a.eq.${me.id},user_b.eq.${me.id}`)
      .order('created_at', { ascending: false });
    if (!data) return;

    const convs: DmConversation[] = await Promise.all(data.map(async (c) => {
      const otherId = c.user_a === me.id ? c.user_b : c.user_a;
      const [{ data: profile }, { data: lastMsgs }, { count }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', otherId).single(),
        supabase.from('dm_messages').select('*').eq('conversation_id', c.id)
          .order('created_at', { ascending: false }).limit(1),
        supabase.from('dm_messages').select('*', { count: 'exact', head: true })
          .eq('conversation_id', c.id).eq('sender_id', otherId).is('read_at', null),
      ]);
      return { ...c, other: profile, lastMessage: lastMsgs?.[0] || null, unread: count || 0 };
    }));

    // Sort by last message time
    convs.sort((a, b) => {
      const ta = a.lastMessage?.created_at || a.created_at;
      const tb = b.lastMessage?.created_at || b.created_at;
      return new Date(tb).getTime() - new Date(ta).getTime();
    });
    setConversations(convs);
  };

  // ── OPEN CONVERSATION ─────────────────────────────────────────────────────
  const openConversation = async (conv: DmConversation) => {
    setActiveConv(conv);
    setMessages([]);
    const { data } = await supabase
      .from('dm_messages')
      .select('*')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true });
    setMessages(data || []);

    // Mark read
    if (me && conv.unread && conv.unread > 0) {
      await supabase.from('dm_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conv.id)
        .neq('sender_id', me.id)
        .is('read_at', null);
      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread: 0 } : c));
    }
  };

  // ── REALTIME MESSAGES ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeConv) return;
    const channel = supabase
      .channel(`dm:${activeConv.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'dm_messages',
        filter: `conversation_id=eq.${activeConv.id}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as DmMessage]);
        // Auto-mark read if from other
        if (me && payload.new.sender_id !== me.id) {
          supabase.from('dm_messages').update({ read_at: new Date().toISOString() })
            .eq('id', payload.new.id);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeConv, me]);

  // ── AUTO SCROLL ───────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── SEND MESSAGE ──────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!me || !activeConv || !msgInput.trim() || sending) return;
    const content = msgInput.trim();
    setMsgInput('');
    setSending(true);
    try {
      await supabase.from('dm_messages').insert({
        conversation_id: activeConv.id,
        sender_id: me.id,
        content,
      });
      // Update conversation list
      loadConversations();
    } finally {
      setSending(false);
      msgInputRef.current?.focus();
    }
  };

  // ── DELETE MESSAGE ────────────────────────────────────────────────────────
  const deleteMessage = async (msgId: string) => {
    await supabase.from('dm_messages').delete().eq('id', msgId);
    setMessages(prev => prev.filter(m => m.id !== msgId));
  };

  // ── START DM WITH FRIEND ──────────────────────────────────────────────────
  const startDm = async (friendProfile: Profile) => {
    if (!me) return;
    // Check if conversation already exists
    const existing = conversations.find(c =>
      (c.user_a === me.id && c.user_b === friendProfile.id) ||
      (c.user_b === me.id && c.user_a === friendProfile.id)
    );
    if (existing) { setTab('chats'); openConversation(existing); return; }

    // Create new conversation
    const { data } = await supabase.from('dm_conversations').insert({
      user_a: me.id, user_b: friendProfile.id,
    }).select().single();
    if (data) {
      const newConv: DmConversation = { ...data, other: friendProfile, lastMessage: null, unread: 0 };
      setConversations(prev => [newConv, ...prev]);
      setTab('chats');
      openConversation(newConv);
    }
  };

  // ── FRIENDS ───────────────────────────────────────────────────────────────
  const loadFriends = async () => {
    if (!me) return;
    const { data } = await supabase.from('friends')
      .select('*')
      .or(`user_a.eq.${me.id},user_b.eq.${me.id}`);
    if (!data) return;
    const enriched = await Promise.all(data.map(async (f) => {
      const otherId = f.user_a === me.id ? f.user_b : f.user_a;
      const { data: p } = await supabase.from('profiles').select('*').eq('id', otherId).single();
      return { ...f, friend: p };
    }));
    setFriends(enriched);
  };

  const removeFriend = async (friendId: string) => {
    if (!me) return;
    setActionLoading(friendId);
    await supabase.from('friends').delete()
      .or(`and(user_a.eq.${me.id},user_b.eq.${friendId}),and(user_a.eq.${friendId},user_b.eq.${me.id})`);
    setFriends(prev => prev.filter(f => f.friend?.id !== friendId));
    setActionLoading(null);
  };

  // ── FRIEND REQUESTS ───────────────────────────────────────────────────────
  const loadRequests = async () => {
    if (!me) return;
    const { data } = await supabase.from('friend_requests')
      .select('*')
      .or(`sender_id.eq.${me.id},receiver_id.eq.${me.id}`)
      .eq('status', 'pending');
    if (!data) return;
    const enriched = await Promise.all(data.map(async (r) => {
      const [{ data: sender }, { data: receiver }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', r.sender_id).single(),
        supabase.from('profiles').select('*').eq('id', r.receiver_id).single(),
      ]);
      return { ...r, sender, receiver };
    }));
    setRequests(enriched);
    setPendingSent(new Set(enriched.filter(r => r.sender_id === me.id).map(r => r.receiver_id)));
  };

  const acceptRequest = async (req: FriendRequest) => {
    if (!me) return;
    setActionLoading(req.id);
    await supabase.from('friend_requests').update({ status: 'accepted', updated_at: new Date().toISOString() }).eq('id', req.id);
    await supabase.from('friends').insert({ user_a: req.sender_id, user_b: req.receiver_id });
    await loadFriends();
    setRequests(prev => prev.filter(r => r.id !== req.id));
    setActionLoading(null);
  };

  const declineRequest = async (req: FriendRequest) => {
    if (!me) return;
    setActionLoading(req.id);
    await supabase.from('friend_requests').update({ status: 'declined', updated_at: new Date().toISOString() }).eq('id', req.id);
    setRequests(prev => prev.filter(r => r.id !== req.id));
    setActionLoading(null);
  };

  const cancelRequest = async (receiverId: string) => {
    if (!me) return;
    await supabase.from('friend_requests').delete()
      .eq('sender_id', me.id).eq('receiver_id', receiverId).eq('status', 'pending');
    setPendingSent(prev => { const s = new Set(prev); s.delete(receiverId); return s; });
    setRequests(prev => prev.filter(r => !(r.sender_id === me.id && r.receiver_id === receiverId)));
  };

  const sendRequest = async (toId: string) => {
    if (!me) return;
    setActionLoading(toId);
    await supabase.from('friend_requests').insert({ sender_id: me.id, receiver_id: toId });
    setPendingSent(prev => new Set([...prev, toId]));
    setActionLoading(null);
  };

  // ── SEARCH USERS ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase.from('profiles')
        .select('*')
        .ilike('username', `%${searchQuery}%`)
        .neq('id', me?.id || '')
        .limit(10);
      setSearchResults(data || []);
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery, me]);

  const isFriend = (id: string) => friends.some(f => f.friend?.id === id);
  const incomingReqs = requests.filter(r => r.receiver_id === me?.id);
  const totalUnread = conversations.reduce((a, c) => a + (c.unread || 0), 0);

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }} animate={leaving ? { opacity: 0, y: 18 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      style={{
        background: C.bg, color: C.text, minHeight: '100vh',
        fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
        WebkitTapHighlightColor: 'transparent', userSelect: 'none', WebkitUserSelect: 'none',
        display: 'flex', flexDirection: 'column',
      } as React.CSSProperties}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; -ms-overflow-style: none; scrollbar-width: none; }
        *::-webkit-scrollbar { display: none !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.45; } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        textarea { resize: none; }
        textarea:focus { outline: none; }
      `}</style>

      {/* ── HEADER ── */}
      <header style={{
        height: 60, padding: '0 14px',
        display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 50,
        ...C.glass, borderBottom: `1px solid ${C.border}`,
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      }}>
        <motion.button whileTap={{ scale: 0.92 }} onClick={handleBack}
          style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: C.accentDim, border: `1px solid ${C.accentBorder}`,
            color: C.accentBright, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
          <ChevronLeft size={16} />
        </motion.button>

        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>Social Zone</h1>
          <p style={{ margin: 0, fontSize: 10, color: C.textMuted, fontWeight: 400 }}>
            {friends.length} friends · {conversations.length} chats
          </p>
        </div>

        {me && <Avatar profile={me} size={32} />}
      </header>

      {/* ── TABS ── */}
      <div style={{
        display: 'flex', gap: 0,
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        position: 'sticky', top: 60, zIndex: 40,
      }}>
        {([
          { id: 'chats',    label: 'Chats',    icon: <MessageCircle size={13} />, badge: totalUnread },
          { id: 'friends',  label: 'Friends',  icon: <Users size={13} />,          badge: 0 },
          { id: 'requests', label: 'Requests', icon: <Bell size={13} />,           badge: incomingReqs.length },
        ] as { id: Tab; label: string; icon: React.ReactNode; badge: number }[]).map(t => (
          <motion.button key={t.id} whileTap={{ scale: 0.96 }} onClick={() => setTab(t.id)}
            style={{
              flex: 1, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: 'none', border: 'none', cursor: 'pointer',
              color: tab === t.id ? C.accentBright : C.textMuted,
              fontSize: 11, fontWeight: tab === t.id ? 700 : 500,
              borderBottom: `2px solid ${tab === t.id ? C.accent : 'transparent'}`,
              transition: 'all 0.15s', position: 'relative', ...GPU,
            }}>
            {t.icon}
            {t.label}
            {t.badge > 0 && (
              <span style={{
                minWidth: 16, height: 16, borderRadius: 8, background: C.accent,
                color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 4px',
              }}>{t.badge > 99 ? '99+' : t.badge}</span>
            )}
          </motion.button>
        ))}
      </div>

      {/* ── CONTENT ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <AnimatePresence mode="wait">

          {/* ────────── CHATS TAB ────────── */}
          {tab === 'chats' && !activeConv && (
            <motion.div key="chats"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>

              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${C.border}`, borderTopColor: C.accent, animation: 'spin 0.8s linear infinite' }} />
                </div>
              ) : conversations.length === 0 ? (
                <EmptyState icon={<MessageCircle size={28} color={C.textMuted} />}
                  title="No conversations yet"
                  desc="Add friends and start chatting" />
              ) : (
                conversations.map((conv, i) => (
                  <motion.button key={conv.id}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: i * 0.04 }}
                    whileTap={{ scale: 0.985, transition: { duration: 0.07 } }}
                    onClick={() => openConversation(conv)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                      padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer',
                      borderBottom: `1px solid ${C.border}`, textAlign: 'left', ...GPU,
                    }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <Avatar profile={conv.other} size={44} />
                      {conv.unread! > 0 && (
                        <span style={{
                          position: 'absolute', top: -3, right: -3,
                          minWidth: 16, height: 16, borderRadius: 8, background: C.accent,
                          color: '#fff', fontSize: 9, fontWeight: 800,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
                          border: `2px solid ${C.bg}`,
                        }}>{conv.unread! > 9 ? '9+' : conv.unread}</span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: conv.unread! > 0 ? 700 : 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {conv.other?.display_name || conv.other?.username || 'Unknown'}
                        </p>
                        {conv.lastMessage && (
                          <span style={{ fontSize: 10, color: C.textMuted, flexShrink: 0 }}>
                            {timeAgo(conv.lastMessage.created_at)}
                          </span>
                        )}
                      </div>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: conv.unread! > 0 ? C.textSub : C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: conv.unread! > 0 ? 500 : 400 }}>
                        {conv.lastMessage
                          ? (conv.lastMessage.sender_id === me?.id ? 'You: ' : '') + conv.lastMessage.content
                          : 'Say hello 👋'}
                      </p>
                    </div>
                    <ChevronRight size={14} color={C.textMuted} style={{ flexShrink: 0 }} />
                  </motion.button>
                ))
              )}
            </motion.div>
          )}

          {/* ────────── ACTIVE CONVERSATION ────────── */}
          {tab === 'chats' && activeConv && (
            <motion.div key="conv"
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              {/* Conv header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', background: C.surface,
                borderBottom: `1px solid ${C.border}`, flexShrink: 0,
              }}>
                <motion.button whileTap={{ scale: 0.92 }}
                  onClick={() => setActiveConv(null)}
                  style={{ width: 32, height: 32, borderRadius: 9, background: C.elevated, border: `1px solid ${C.border}`, color: C.textSub, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  <ChevronLeft size={14} />
                </motion.button>
                <Avatar profile={activeConv.other} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeConv.other?.display_name || activeConv.other?.username || 'Unknown'}
                  </p>
                  <p style={{ margin: 0, fontSize: 10, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={9} /> Messages expire in 24h
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {messages.length === 0 && (
                  <div style={{ margin: 'auto', textAlign: 'center', padding: '32px 0' }}>
                    <p style={{ fontSize: 12, color: C.textMuted }}>No messages yet. Say something!</p>
                  </div>
                )}
                {messages.map((msg, i) => {
                  const isMine = msg.sender_id === me?.id;
                  const showDate = i === 0 ||
                    new Date(messages[i - 1].created_at).toDateString() !== new Date(msg.created_at).toDateString();
                  const expiring = new Date(msg.expires_at).getTime() - Date.now() < 3600000;
                  return (
                    <div key={msg.id} style={{ animation: 'fadeUp 0.18s ease-out' }}>
                      {showDate && (
                        <div style={{ textAlign: 'center', margin: '8px 0 4px' }}>
                          <span style={{ fontSize: 10, color: C.textMuted, background: C.elevated, padding: '3px 10px', borderRadius: 10, border: `1px solid ${C.border}` }}>
                            {new Date(msg.created_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 6 }}>
                        {!isMine && <Avatar profile={activeConv.other} size={24} />}
                        <div style={{ maxWidth: '72%' }}>
                          <div
                            style={{
                              padding: '9px 13px', borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                              background: isMine ? C.accent : C.elevated,
                              border: `1px solid ${isMine ? 'rgba(59,130,246,0.35)' : C.border}`,
                              color: C.text, fontSize: 13, lineHeight: 1.45, wordBreak: 'break-word',
                              position: 'relative',
                            }}>
                            {msg.content}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                            <span style={{ fontSize: 9, color: C.textMuted }}>
                              {new Date(msg.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {expiring && (
                              <span style={{ fontSize: 9, color: C.warning, display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Clock size={8} /> {expiresIn(msg.expires_at)}
                              </span>
                            )}
                            {isMine && msg.read_at && (
                              <span style={{ fontSize: 9, color: C.accentBright, display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Check size={9} /><Check size={9} style={{ marginLeft: -5 }} />
                              </span>
                            )}
                            {isMine && (
                              <motion.button whileTap={{ scale: 0.88 }}
                                onClick={() => deleteMessage(msg.id)}
                                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: C.textMuted, display: 'flex', alignItems: 'center' }}>
                                <Trash2 size={9} />
                              </motion.button>
                            )}
                          </div>
                        </div>
                        {isMine && <Avatar profile={me} size={24} />}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input bar */}
              <div style={{
                padding: '10px 14px 14px', background: C.surface,
                borderTop: `1px solid ${C.border}`, flexShrink: 0,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'flex-end', gap: 8,
                  background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 16,
                  padding: '8px 8px 8px 14px',
                }}>
                  <textarea
                    ref={msgInputRef}
                    value={msgInput}
                    onChange={e => setMsgInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder="Type a message…"
                    rows={1}
                    style={{
                      flex: 1, background: 'none', border: 'none', color: C.text,
                      fontSize: 13, lineHeight: 1.45, fontFamily: 'inherit',
                      maxHeight: 100, overflowY: 'auto',
                      WebkitUserSelect: 'text', userSelect: 'text',
                    } as React.CSSProperties}
                  />
                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    onClick={sendMessage}
                    disabled={!msgInput.trim() || sending}
                    style={{
                      width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                      background: msgInput.trim() ? C.accent : C.surface,
                      border: `1px solid ${msgInput.trim() ? 'rgba(59,130,246,0.4)' : C.border}`,
                      color: msgInput.trim() ? '#fff' : C.textMuted,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: msgInput.trim() ? 'pointer' : 'not-allowed',
                      transition: 'all 0.15s', ...GPU,
                    }}>
                    {sending
                      ? <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid rgba(255,255,255,0.3)`, borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />
                      : <Send size={15} />}
                  </motion.button>
                </div>
                <p style={{ margin: '5px 0 0', fontSize: 9, color: C.textMuted, textAlign: 'center' }}>
                  Messages vanish after 24 hours · Enter to send
                </p>
              </div>
            </motion.div>
          )}

          {/* ────────── FRIENDS TAB ────────── */}
          {tab === 'friends' && (
            <motion.div key="friends"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Search */}
              <div style={{ position: 'relative' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: C.elevated, border: `1px solid ${C.border}`,
                  borderRadius: 12, padding: '10px 14px',
                }}>
                  <Search size={14} color={C.textMuted} style={{ flexShrink: 0 }} />
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search users by username…"
                    style={{
                      flex: 1, background: 'none', border: 'none', color: C.text,
                      fontSize: 13, fontFamily: 'inherit', outline: 'none',
                      WebkitUserSelect: 'text', userSelect: 'text',
                    } as React.CSSProperties}
                  />
                  {searching && <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${C.border}`, borderTopColor: C.accent, animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />}
                  {searchQuery && !searching && (
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                      style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', display: 'flex', padding: 0 }}>
                      <X size={14} />
                    </motion.button>
                  )}
                </div>

                {/* Search results */}
                <AnimatePresence>
                  {searchResults.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.15 }}
                      style={{
                        position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 30,
                        background: C.elevated, border: `1px solid ${C.border}`,
                        borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
                        overflow: 'hidden',
                      }}>
                      {searchResults.map(p => {
                        const already = isFriend(p.id);
                        const sent    = pendingSent.has(p.id);
                        const isLoading = actionLoading === p.id;
                        return (
                          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${C.border}` }}>
                            <Avatar profile={p} size={36} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.display_name || p.username}</p>
                              <p style={{ margin: 0, fontSize: 10, color: C.textMuted }}>@{p.username}</p>
                            </div>
                            {already ? (
                              <span style={{ fontSize: 10, color: C.success, display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(166,214,166,0.10)', border: '1px solid rgba(166,214,166,0.20)', padding: '4px 9px', borderRadius: 8 }}>
                                <UserCheck size={11} /> Friends
                              </span>
                            ) : sent ? (
                              <motion.button whileTap={{ scale: 0.95 }} onClick={() => cancelRequest(p.id)}
                                style={{ fontSize: 10, color: C.textMuted, background: C.surface, border: `1px solid ${C.border}`, padding: '5px 10px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Clock size={10} /> Sent
                              </motion.button>
                            ) : (
                              <motion.button whileTap={{ scale: 0.95 }} onClick={() => sendRequest(p.id)} disabled={isLoading}
                                style={{ fontSize: 10, color: '#fff', background: C.accent, border: 'none', padding: '5px 10px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, ...GPU }}>
                                {isLoading ? <div style={{ width: 10, height: 10, borderRadius: '50%', border: `1.5px solid rgba(255,255,255,0.3)`, borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} /> : <UserPlus size={10} />}
                                Add
                              </motion.button>
                            )}
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Friends list */}
              <div>
                <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Your Friends · {friends.length}
                </p>
                {loading ? (
                  <LoadingSpinner />
                ) : friends.length === 0 ? (
                  <EmptyState icon={<Users size={26} color={C.textMuted} />}
                    title="No friends yet"
                    desc="Search for users above to add them" />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {friends.map((f, i) => (
                      <motion.div key={f.id}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16, delay: i * 0.04 }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 11,
                          padding: '10px 13px', borderRadius: 14,
                          background: C.elevated, border: `1px solid ${C.border}`,
                        }}>
                        <Avatar profile={f.friend} size={40} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {f.friend?.display_name || f.friend?.username || 'Unknown'}
                          </p>
                          <p style={{ margin: 0, fontSize: 10, color: C.textMuted }}>@{f.friend?.username}</p>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <motion.button whileTap={{ scale: 0.93 }}
                            onClick={() => f.friend && startDm(f.friend)}
                            style={{ width: 32, height: 32, borderRadius: 9, background: C.accentDim, border: `1px solid ${C.accentBorder}`, color: C.accentBright, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            <MessageCircle size={13} />
                          </motion.button>
                          <motion.button whileTap={{ scale: 0.93 }}
                            onClick={() => f.friend && removeFriend(f.friend.id)}
                            disabled={actionLoading === f.friend?.id}
                            style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(225,154,154,0.08)', border: '1px solid rgba(225,154,154,0.18)', color: C.error, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            {actionLoading === f.friend?.id
                              ? <div style={{ width: 12, height: 12, borderRadius: '50%', border: `1.5px solid ${C.error}`, borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
                              : <X size={13} />}
                          </motion.button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ────────── REQUESTS TAB ────────── */}
          {tab === 'requests' && (
            <motion.div key="requests"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Incoming */}
              <div>
                <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Incoming · {incomingReqs.length}
                </p>
                {loading ? <LoadingSpinner /> : incomingReqs.length === 0 ? (
                  <EmptyState icon={<UserPlus size={24} color={C.textMuted} />}
                    title="No incoming requests"
                    desc="When someone adds you, they'll show up here" />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {incomingReqs.map((req, i) => (
                      <motion.div key={req.id}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16, delay: i * 0.04 }}
                        style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', borderRadius: 14, background: C.elevated, border: `1px solid ${C.accentBorder}` }}>
                        <Avatar profile={req.sender} size={42} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {req.sender?.display_name || req.sender?.username || 'Unknown'}
                          </p>
                          <p style={{ margin: 0, fontSize: 10, color: C.textMuted }}>{timeAgo(req.created_at)}</p>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <motion.button whileTap={{ scale: 0.92 }}
                            onClick={() => acceptRequest(req)}
                            disabled={actionLoading === req.id}
                            style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(166,214,166,0.12)', border: '1px solid rgba(166,214,166,0.25)', color: C.success, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', ...GPU }}>
                            {actionLoading === req.id ? <div style={{ width: 13, height: 13, borderRadius: '50%', border: `1.5px solid rgba(166,214,166,0.3)`, borderTopColor: C.success, animation: 'spin 0.7s linear infinite' }} /> : <Check size={15} />}
                          </motion.button>
                          <motion.button whileTap={{ scale: 0.92 }}
                            onClick={() => declineRequest(req)}
                            disabled={actionLoading === req.id}
                            style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(225,154,154,0.08)', border: '1px solid rgba(225,154,154,0.18)', color: C.error, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', ...GPU }}>
                            <X size={15} />
                          </motion.button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sent */}
              {(() => {
                const sent = requests.filter(r => r.sender_id === me?.id);
                if (sent.length === 0) return null;
                return (
                  <div>
                    <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Sent · {sent.length}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {sent.map((req, i) => (
                        <motion.div key={req.id}
                          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16, delay: i * 0.04 }}
                          style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 13px', borderRadius: 14, background: C.surface, border: `1px solid ${C.border}` }}>
                          <Avatar profile={req.receiver} size={38} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {req.receiver?.display_name || req.receiver?.username || 'Unknown'}
                            </p>
                            <p style={{ margin: 0, fontSize: 10, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Clock size={9} /> Pending · {timeAgo(req.created_at)}
                            </p>
                          </div>
                          <motion.button whileTap={{ scale: 0.93 }}
                            onClick={() => cancelRequest(req.receiver_id)}
                            style={{ fontSize: 10, color: C.textMuted, background: C.elevated, border: `1px solid ${C.border}`, padding: '5px 10px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <X size={10} /> Cancel
                          </motion.button>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const EmptyState = ({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) => (
  <div style={{ textAlign: 'center', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
    <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {icon}
    </div>
    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.textSub }}>{title}</p>
    <p style={{ margin: 0, fontSize: 12, color: C.textMuted }}>{desc}</p>
  </div>
);

const LoadingSpinner = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
    <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid rgba(255,255,255,0.07)`, borderTopColor: '#3B82F6', animation: 'spin 0.8s linear infinite' }} />
  </div>
);
