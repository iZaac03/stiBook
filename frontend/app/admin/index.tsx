import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, RefreshControl, Image, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import {
  adminGetUsers, adminGetStats, adminBanUser,
  adminActivateUser, adminDeletePost, adminGetLogs, getPosts,
} from '../../api/axios';

function Avatar({ name, uri, size = 38 }: { name: string; uri?: string | null; size?: number }) {
  const init = name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#312e81', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#c7d2fe', fontWeight: '800', fontSize: size * 0.33 }}>{init}</Text>
    </View>
  );
}

type Tab = 'dashboard' | 'users' | 'posts' | 'logs';

export default function AdminScreen() {
  const { user, handleLogout, isAdmin } = useAuth();
  const router = useRouter();

  // Redirect non-admins immediately
  useEffect(() => {
    if (user && !isAdmin) router.replace('/(tabs)');
  }, [user, isAdmin]);

  const [tab, setTab]           = useState<Tab>('dashboard');
  const [users, setUsers]       = useState<any[]>([]);
  const [posts, setPosts]       = useState<any[]>([]);
  const [logs, setLogs]         = useState<any[]>([]);
  const [stats, setStats]       = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);

  const fetchAll = useCallback(async () => {
    try {
      // Fetch users — adminGetUsers returns paginated object
      const [userRes, postRes, logRes] = await Promise.all([
        adminGetUsers(1, ''),
        getPosts(1),
        adminGetLogs(1),
      ]);

      // Handle both paginated and flat array responses
      const userArr: any[] = userRes?.data ?? (Array.isArray(userRes) ? userRes : []);
      const postArr: any[] = postRes?.data ?? (Array.isArray(postRes) ? postRes : []);
      const logArr:  any[] = logRes?.data  ?? (Array.isArray(logRes)  ? logRes  : []);

      setUsers(userArr);
      setPosts(postArr);
      setLogs(logArr);
      setStats({
        total_users:   userArr.length,
        active_users:  userArr.filter(u => u.is_active).length,
        banned_users:  userArr.filter(u => !u.is_active).length,
        total_posts:   postArr.length,
        total_admins:  userArr.filter(u => u.role === 'admin').length,
      });
    } catch (e) { console.error('Admin fetch error:', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { if (isAdmin) fetchAll(); }, [isAdmin]);

  const searchUsers = async (q: string) => {
    setUserSearch(q);
    if (q.length < 1) { fetchAll(); return; }
    try {
      const res = await adminGetUsers(1, q);
      setUsers(res?.data ?? (Array.isArray(res) ? res : []));
    } catch {}
  };

  const banUser = (id: number, name: string) =>
    Alert.alert(`Ban ${name}?`, 'User will lose app access.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Ban', style: 'destructive', onPress: async () => {
        try {
          await adminBanUser(id);
          setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: false } : u));
          Alert.alert('✅ Banned', `${name} has been banned.`);
        } catch (e: any) { Alert.alert('Error', e?.response?.data?.message ?? 'Failed.'); }
      }},
    ]);

  const activateUser = (id: number, name: string) =>
    Alert.alert(`Activate ${name}?`, '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Activate', onPress: async () => {
        try {
          await adminActivateUser(id);
          setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: true } : u));
          Alert.alert('✅ Activated', `${name} can use the app again.`);
        } catch (e: any) { Alert.alert('Error', e?.response?.data?.message ?? 'Failed.'); }
      }},
    ]);

  const removePost = (id: number) =>
    Alert.alert('Delete post?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await adminDeletePost(id);
          setPosts(prev => prev.filter(p => p.post_id !== id));
          Alert.alert('✅ Post deleted.');
        } catch (e: any) { Alert.alert('Error', e?.response?.data?.message ?? 'Failed.'); }
      }},
    ]);

  const TABS: { key: Tab; label: string; emoji: string }[] = [
    { key: 'dashboard', label: 'Dashboard', emoji: '📊' },
    { key: 'users',     label: 'Users',     emoji: '👥' },
    { key: 'posts',     label: 'Posts',     emoji: '📝' },
    { key: 'logs',      label: 'Logs',      emoji: '📋' },
  ];

  const filteredUsers = userSearch.length > 0
    ? users.filter(u =>
        u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.username?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email?.toLowerCase().includes(userSearch.toLowerCase())
      )
    : users;

  const onLogout = () => {
    const doLogout = async () => {
      try {
        await handleLogout();
      } catch (err) {
        console.error('Logout error:', err);
      } finally {
        router.replace('/(auth)/login');
      }
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Exit admin panel and log out?')) {
        doLogout();
      }
    } else {
      Alert.alert('Logout', 'Exit admin panel and log out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: doLogout },
      ]);
    }
  };

  if (!isAdmin) return null;

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0f' }}>
      {/* Header */}
      <View style={{ paddingTop: 52, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: '#0f0f14', borderBottomWidth: 1, borderBottomColor: '#1e1e2e' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: '800', letterSpacing: 2.5 }}>ADMIN PANEL</Text>
            <Text style={{ color: '#e2e8f0', fontSize: 20, fontWeight: '900' }}>Control Center</Text>
            <Text style={{ color: '#52525b', fontSize: 11, marginTop: 2 }}>{user?.name} · Admin</Text>
          </View>
          <TouchableOpacity
            onPress={onLogout}
            style={{ backgroundColor: '#1e1e2e', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 }}
          >
            <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700' }}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Nav tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }} contentContainerStyle={{ gap: 8 }}>
          {TABS.map(t => (
            <TouchableOpacity
              key={t.key} onPress={() => setTab(t.key)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: tab === t.key ? '#ef4444' : '#1e1e2e' }}
            >
              <Text style={{ fontSize: 14 }}>{t.emoji}</Text>
              <Text style={{ color: tab === t.key ? '#fff' : '#52525b', fontWeight: '700', fontSize: 13 }}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading && !refreshing
        ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#ef4444" size="large" /></View>
        : (
          <ScrollView
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll(); }} tintColor="#ef4444" />}
            contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
          >

            {/* ── DASHBOARD ── */}
            {tab === 'dashboard' && stats && (
              <View style={{ gap: 12 }}>
                {/* Stat grid */}
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {[
                    { label: 'Total Users',  val: stats.total_users,  emoji: '👥', color: '#6366f1' },
                    { label: 'Active',       val: stats.active_users, emoji: '🟢', color: '#22c55e' },
                  ].map(s => (
                    <View key={s.label} style={{ flex: 1, backgroundColor: '#13131a', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1e1e2e' }}>
                      <Text style={{ fontSize: 26 }}>{s.emoji}</Text>
                      <Text style={{ color: s.color, fontSize: 30, fontWeight: '900', marginTop: 8 }}>{s.val}</Text>
                      <Text style={{ color: '#52525b', fontSize: 12, marginTop: 2 }}>{s.label}</Text>
                    </View>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {[
                    { label: 'Banned',      val: stats.banned_users, emoji: '🚫', color: '#ef4444' },
                    { label: 'Total Posts', val: stats.total_posts,  emoji: '📝', color: '#f59e0b' },
                  ].map(s => (
                    <View key={s.label} style={{ flex: 1, backgroundColor: '#13131a', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1e1e2e' }}>
                      <Text style={{ fontSize: 26 }}>{s.emoji}</Text>
                      <Text style={{ color: s.color, fontSize: 30, fontWeight: '900', marginTop: 8 }}>{s.val}</Text>
                      <Text style={{ color: '#52525b', fontSize: 12, marginTop: 2 }}>{s.label}</Text>
                    </View>
                  ))}
                </View>

                {/* Recent logs */}
                <View style={{ backgroundColor: '#13131a', borderRadius: 16, borderWidth: 1, borderColor: '#1e1e2e', overflow: 'hidden' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e1e2e' }}>
                    <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 }}>RECENT ACTIONS</Text>
                    <TouchableOpacity onPress={() => setTab('logs')}><Text style={{ color: '#52525b', fontSize: 11 }}>See all</Text></TouchableOpacity>
                  </View>
                  {logs.slice(0, 6).map((l, i) => (
                    <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: '#0a0a0f' }}>
                      <Text style={{ color: '#94a3b8', fontSize: 12 }}>
                        {l.action?.includes('ban') ? '🚫' : l.action?.includes('activate') ? '✅' : l.action?.includes('delete') ? '🗑' : '📋'}{' '}
                        {l.action?.replace(/_/g, ' ')}
                      </Text>
                      <Text style={{ color: '#3f3f46', fontSize: 11 }}>{l.admin?.name ?? '—'}</Text>
                    </View>
                  ))}
                  {logs.length === 0 && <Text style={{ color: '#3f3f46', padding: 14, textAlign: 'center' }}>No actions yet.</Text>}
                </View>
              </View>
            )}

            {/* ── USERS ── */}
            {tab === 'users' && (
              <View style={{ gap: 10 }}>
                <View style={{ backgroundColor: '#13131a', borderRadius: 14, borderWidth: 1, borderColor: '#1e1e2e', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8, marginBottom: 4 }}>
                  <Text>🔍</Text>
                  <TextInput
                    value={userSearch} onChangeText={searchUsers}
                    placeholder="Search by name, username, or email..."
                    placeholderTextColor="#3f3f46"
                    style={{ flex: 1, color: '#e2e8f0', fontSize: 13, paddingVertical: 11 }}
                  />
                  {userSearch.length > 0 && (
                    <TouchableOpacity onPress={() => { setUserSearch(''); fetchAll(); }}>
                      <Text style={{ color: '#52525b' }}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={{ color: '#52525b', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>
                  {filteredUsers.length} USERS
                </Text>

                {filteredUsers.length === 0 && !loading && (
                  <View style={{ alignItems: 'center', padding: 40 }}>
                    <Text style={{ fontSize: 36, marginBottom: 8 }}>👥</Text>
                    <Text style={{ color: '#52525b', fontSize: 14 }}>No users found.</Text>
                    <Text style={{ color: '#3f3f46', fontSize: 12, marginTop: 4 }}>Try refreshing the page.</Text>
                  </View>
                )}

                {filteredUsers.map(u => (
                  <View key={u.id} style={{ backgroundColor: '#13131a', borderRadius: 16, borderWidth: 1, borderColor: u.is_active ? '#1e1e2e' : '#450a0a', overflow: 'hidden' }}>
                    <TouchableOpacity
                      onPress={() => router.push(`/user/${u.id}` as any)}
                      style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }}
                    >
                      <Avatar name={u.name ?? '?'} uri={u.profile_picture} size={46} />
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text style={{ color: '#e2e8f0', fontWeight: '700', fontSize: 14 }}>{u.name}</Text>
                          {u.role === 'admin' && (
                            <View style={{ backgroundColor: '#312e81', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                              <Text style={{ color: '#a5b4fc', fontSize: 9, fontWeight: '800' }}>ADMIN</Text>
                            </View>
                          )}
                          {!u.is_active && (
                            <View style={{ backgroundColor: '#450a0a', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                              <Text style={{ color: '#ef4444', fontSize: 9, fontWeight: '800' }}>BANNED</Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ color: '#52525b', fontSize: 11, marginTop: 2 }}>@{u.username}</Text>
                        <Text style={{ color: '#3f3f46', fontSize: 11 }}>{u.email}</Text>
                      </View>
                      <Text style={{ color: '#52525b', fontSize: 18 }}>›</Text>
                    </TouchableOpacity>
                    {/* Actions — never ban another admin */}
                    {u.role !== 'admin' && (
                      <TouchableOpacity
                        onPress={() => u.is_active ? banUser(u.id, u.name) : activateUser(u.id, u.name)}
                        style={{ borderTopWidth: 1, borderTopColor: u.is_active ? '#1e1e2e' : '#450a0a', paddingVertical: 10, alignItems: 'center', backgroundColor: u.is_active ? '#13131a' : '#1a0505' }}
                      >
                        <Text style={{ color: u.is_active ? '#ef4444' : '#22c55e', fontWeight: '700', fontSize: 13 }}>
                          {u.is_active ? '🚫 Ban User' : '✅ Activate User'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* ── POSTS ── */}
            {tab === 'posts' && (
              <View style={{ gap: 10 }}>
                <Text style={{ color: '#52525b', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>
                  {posts.length} POSTS TOTAL
                </Text>
                {posts.length === 0 && <Text style={{ color: '#3f3f46', textAlign: 'center', marginTop: 32 }}>No posts found.</Text>}
                {posts.map(p => (
                  <View key={p.post_id} style={{ backgroundColor: '#13131a', borderRadius: 16, borderWidth: 1, borderColor: '#1e1e2e', overflow: 'hidden' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 }}>
                      <Avatar name={p.user?.name ?? '?'} uri={p.user?.profile_picture} size={36} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#e2e8f0', fontWeight: '600', fontSize: 13 }}>{p.user?.name ?? 'Unknown'}</Text>
                        <Text style={{ color: '#52525b', fontSize: 11 }}>@{p.user?.username}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => removePost(p.post_id)}
                        style={{ backgroundColor: '#450a0a', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}
                      >
                        <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700' }}>🗑 Delete</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={{ color: '#94a3b8', fontSize: 13, lineHeight: 20, paddingHorizontal: 12, paddingBottom: 12 }} numberOfLines={4}>
                      {p.content}
                    </Text>
                    {p.image_url && <Image source={{ uri: p.image_url }} style={{ width: '100%', height: 140 }} resizeMode="cover" />}
                  </View>
                ))}
              </View>
            )}

            {/* ── LOGS ── */}
            {tab === 'logs' && (
              <View style={{ gap: 10 }}>
                <Text style={{ color: '#52525b', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>
                  {logs.length} LOG ENTRIES
                </Text>
                {logs.length === 0 && <Text style={{ color: '#3f3f46', textAlign: 'center', marginTop: 32 }}>No logs yet.</Text>}
                {logs.map((l, i) => (
                  <View key={i} style={{ backgroundColor: '#13131a', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#1e1e2e', flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                    <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: '#1e1e2e', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 18 }}>
                        {l.action?.includes('ban') ? '🚫' : l.action?.includes('activate') ? '✅' : l.action?.includes('delete') ? '🗑' : '📋'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#e2e8f0', fontWeight: '700', fontSize: 13 }}>
                        {l.action?.replace(/_/g, ' ')}
                      </Text>
                      <Text style={{ color: '#52525b', fontSize: 11, marginTop: 2 }}>
                        by {l.admin?.name ?? '—'} · {l.target_table} #{l.target_id}
                      </Text>
                      {l.details && <Text style={{ color: '#3f3f46', fontSize: 11, marginTop: 4 }}>{l.details}</Text>}
                    </View>
                  </View>
                ))}
              </View>
            )}

          </ScrollView>
        )
      }
    </View>
  );
}