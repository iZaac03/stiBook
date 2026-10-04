import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl,
  Image, Alert, ScrollView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import {
  getConversations, getFriendRequests, getFriends,
  searchUsers, sendFriendRequest, acceptFriendRequest,
  rejectFriendRequest, unfriend, getFullImageUrl,
} from '../../api/axios';

// ─── Helpers ─────────────────────────────────────────────

function Avatar({ name, uri, size = 44 }: { name: string; uri?: string | null; size?: number }) {
  const init = name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const full = getFullImageUrl(uri);
  if (full) return <Image source={{ uri: full }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#312e81', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#c7d2fe', fontWeight: '800', fontSize: size * 0.35 }}>{init}</Text>
    </View>
  );
}

function timeAgo(d?: string) {
  if (!d) return '';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function MessageScreen() {
  const { user: me } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab]         = useState<'chats' | 'friends'>('chats');
  const [conversations, setConversations] = useState<any[]>([]);
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [friends, setFriends]             = useState<any[]>([]);
  const [discoveredUsers, setDiscoveredUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery]     = useState('');
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [searching, setSearching]         = useState(false);
  const [actionInProgress, setActionInProgress] = useState<number | null>(null);

  // ─── Fetch All Data ──────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [convRes, reqRes, friendsRes, usersRes] = await Promise.allSettled([
        getConversations(),
        getFriendRequests(),
        getFriends(),
        searchUsers(''),
      ]);

      if (convRes.status === 'fulfilled') {
        setConversations(Array.isArray(convRes.value) ? convRes.value : []);
      }
      if (reqRes.status === 'fulfilled') {
        setFriendRequests(Array.isArray(reqRes.value) ? reqRes.value : []);
      }
      if (friendsRes.status === 'fulfilled') {
        setFriends(Array.isArray(friendsRes.value) ? friendsRes.value : []);
      }
      if (usersRes.status === 'fulfilled') {
        setDiscoveredUsers(Array.isArray(usersRes.value) ? usersRes.value : []);
      }
    } catch (e) {
      console.error('Failed to load message data', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Auto-refresh conversations periodically
    const interval = setInterval(async () => {
      try {
        const conv = await getConversations();
        if (Array.isArray(conv)) setConversations(conv);
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // ─── Search Directory ────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (activeTab === 'friends') {
        setSearching(true);
        try {
          const res = await searchUsers(searchQuery.trim());
          setDiscoveredUsers(Array.isArray(res) ? res : []);
        } catch {} finally {
          setSearching(false);
        }
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery, activeTab]);

  // ─── Friend Actions ──────────────────────────────────────
  const handleSendFriendRequest = async (userId: number) => {
    setActionInProgress(userId);
    try {
      await sendFriendRequest(userId);
      setDiscoveredUsers(prev => prev.map(u => u.id === userId ? { ...u, friend_status: 'request_sent' } : u));
      Alert.alert('Request Sent', 'Friend request has been sent!');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not send friend request.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleAcceptRequest = async (requestId: number, senderName: string) => {
    try {
      await acceptFriendRequest(requestId);
      setFriendRequests(prev => prev.filter(r => (r.request_id || r.id) !== requestId));
      Alert.alert('Connected! 🎉', `You and ${senderName} are now friends!`);
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not accept request.');
    }
  };

  const handleRejectRequest = async (requestId: number) => {
    try {
      await rejectFriendRequest(requestId);
      setFriendRequests(prev => prev.filter(r => (r.request_id || r.id) !== requestId));
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not decline request.');
    }
  };

  const handleUnfriend = (friendId: number, friendName: string) => {
    Alert.alert('Unfriend', `Remove ${friendName} from friends?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unfriend',
        style: 'destructive',
        onPress: async () => {
          try {
            await unfriend(friendId);
            setFriends(prev => prev.filter(f => f.id !== friendId));
            setDiscoveredUsers(prev => prev.map(u => u.id === friendId ? { ...u, friend_status: 'none' } : u));
          } catch {
            Alert.alert('Error', 'Could not remove friend.');
          }
        },
      },
    ]);
  };

  const totalUnread = conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);
  const totalPending = friendRequests.length;

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0f' }}>

      {/* Header */}
      <View style={{ paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1e1e2e' }}>
        <Text style={{ color: '#6366f1', fontSize: 10, fontWeight: '800', letterSpacing: 2.5 }}>STIBOOK</Text>
        <Text style={{ color: '#e2e8f0', fontSize: 24, fontWeight: '900', marginTop: 2 }}>Messages & Friends</Text>

        {/* Segmented Switcher */}
        <View style={{ flexDirection: 'row', backgroundColor: '#13131a', borderRadius: 14, padding: 4, marginTop: 16, borderWidth: 1, borderColor: '#1e1e2e' }}>
          <TouchableOpacity
            onPress={() => setActiveTab('chats')}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: activeTab === 'chats' ? '#4f46e5' : 'transparent',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Text style={{ color: activeTab === 'chats' ? '#fff' : '#71717a', fontWeight: '700', fontSize: 14 }}>
              💬 Chats
            </Text>
            {totalUnread > 0 && (
              <View style={{ backgroundColor: '#ef4444', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{totalUnread}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('friends')}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: activeTab === 'friends' ? '#4f46e5' : 'transparent',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Text style={{ color: activeTab === 'friends' ? '#fff' : '#71717a', fontWeight: '700', fontSize: 14 }}>
              👥 Friends
            </Text>
            {totalPending > 0 && (
              <View style={{ backgroundColor: '#f59e0b', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ color: '#000', fontSize: 11, fontWeight: '800' }}>{totalPending}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#6366f1" size="large" />
        </View>
      ) : activeTab === 'chats' ? (
        /* ─── Chats Tab ─── */
        <FlatList
          data={conversations}
          keyExtractor={c => String(c.other_user?.id || Math.random())}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
          contentContainerStyle={{ paddingVertical: 12 }}
          renderItem={({ item }) => {
            const partner = item.other_user;
            if (!partner) return null;
            const isUnread = (item.unread_count || 0) > 0;

            return (
              <TouchableOpacity
                onPress={() => router.push({
                  pathname: '/user/chat',
                  params: { id: partner.id, name: partner.name, avatar: partner.profile_picture },
                })}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 18,
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: '#14141e',
                  backgroundColor: isUnread ? '#141424' : 'transparent',
                }}
              >
                <View style={{ position: 'relative' }}>
                  <Avatar name={partner.name} uri={partner.profile_picture} size={48} />
                  {partner.status ? (
                    <View style={{ position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#10b981', borderWidth: 2, borderColor: '#0a0a0f' }} />
                  ) : null}
                </View>

                <View style={{ flex: 1, marginLeft: 14 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: '#e2e8f0', fontWeight: isUnread ? '800' : '700', fontSize: 15 }}>
                      {partner.name}
                    </Text>
                    <Text style={{ color: isUnread ? '#818cf8' : '#52525b', fontSize: 11, fontWeight: isUnread ? '700' : '500' }}>
                      {timeAgo(item.last_message?.created_at)}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        flex: 1,
                        color: isUnread ? '#cbd5e1' : '#71717a',
                        fontWeight: isUnread ? '700' : '400',
                        fontSize: 13,
                        marginRight: 8,
                      }}
                    >
                      {item.last_message?.body || 'Started a conversation'}
                    </Text>

                    {isUnread && (
                      <View style={{ backgroundColor: '#6366f1', borderRadius: 12, paddingHorizontal: 7, paddingVertical: 2 }}>
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{item.unread_count}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 }}>
              <Text style={{ fontSize: 52, marginBottom: 12 }}>💬</Text>
              <Text style={{ color: '#e2e8f0', fontSize: 18, fontWeight: '800' }}>No conversations yet</Text>
              <Text style={{ color: '#71717a', fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>
                Connect with classmates, add friends, and start chatting directly!
              </Text>
              <TouchableOpacity
                onPress={() => setActiveTab('friends')}
                style={{
                  marginTop: 20,
                  backgroundColor: '#4f46e5',
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderRadius: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Find Classmates</Text>
              </TouchableOpacity>
            </View>
          }
        />
      ) : (
        /* ─── Friends & Requests Tab ─── */
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* Search bar */}
          <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#13131a',
              borderRadius: 14,
              borderWidth: 1,
              borderColor: '#1e1e2e',
              paddingHorizontal: 14,
              paddingVertical: 10,
              gap: 8,
            }}>
              <Text style={{ fontSize: 16 }}>🔍</Text>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search students to add as friend..."
                placeholderTextColor="#52525b"
                style={{ flex: 1, color: '#e2e8f0', fontSize: 14 }}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Text style={{ color: '#71717a', fontSize: 14 }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Section: Pending Friend Requests */}
          {friendRequests.length > 0 && (
            <View style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: '#13131a', borderRadius: 16, borderWidth: 1, borderColor: '#27273a', overflow: 'hidden' }}>
              <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e1e2e', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: '#f59e0b', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 }}>
                  PENDING REQUESTS ({friendRequests.length})
                </Text>
              </View>

              {friendRequests.map((req) => {
                const sender = req.sender;
                const reqId = req.request_id || req.id;
                return (
                  <View key={reqId} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#181824' }}>
                    <TouchableOpacity onPress={() => router.push(`/user/${sender?.id}` as any)}>
                      <Avatar name={sender?.name ?? 'User'} uri={sender?.profile_picture} size={42} />
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ color: '#e2e8f0', fontWeight: '700', fontSize: 14 }}>{sender?.name}</Text>
                      <Text style={{ color: '#71717a', fontSize: 11 }}>@{sender?.username}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => handleAcceptRequest(reqId, sender?.name ?? 'User')}
                        style={{ backgroundColor: '#16a34a', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 }}
                      >
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleRejectRequest(reqId)}
                        style={{ backgroundColor: '#27272a', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 }}
                      >
                        <Text style={{ color: '#a1a1aa', fontSize: 12, fontWeight: '600' }}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Section: My Friends */}
          {friends.length > 0 && (
            <View style={{ marginTop: 20 }}>
              <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
                <Text style={{ color: '#a5b4fc', fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>
                  MY FRIENDS ({friends.length})
                </Text>
              </View>

              {friends.map((f) => (
                <View
                  key={f.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: '#14141e',
                  }}
                >
                  <TouchableOpacity
                    onPress={() => router.push(`/user/${f.id}` as any)}
                    style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                  >
                    <Avatar name={f.name} uri={f.profile_picture} size={44} />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={{ color: '#e2e8f0', fontWeight: '700', fontSize: 14 }}>{f.name}</Text>
                      <Text style={{ color: '#71717a', fontSize: 11 }}>@{f.username}</Text>
                    </View>
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <TouchableOpacity
                      onPress={() => router.push({
                        pathname: '/user/chat',
                        params: { id: f.id, name: f.name, avatar: f.profile_picture },
                      })}
                      style={{
                        backgroundColor: '#4f46e5',
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Text style={{ fontSize: 12 }}>💬</Text>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Message</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleUnfriend(f.id, f.name)}
                      style={{ padding: 6 }}
                    >
                      <Text style={{ color: '#52525b', fontSize: 14 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Section: Add / Discover Classmates */}
          <View style={{ marginTop: 24 }}>
            <View style={{ paddingHorizontal: 20, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#6366f1', fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>
                {searchQuery ? 'SEARCH RESULTS' : 'DISCOVER CLASSMATES'}
              </Text>
              {searching && <ActivityIndicator color="#6366f1" size="small" />}
            </View>

            {discoveredUsers.length === 0 ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <Text style={{ color: '#71717a', fontSize: 13 }}>No students found matching your search.</Text>
              </View>
            ) : (
              discoveredUsers.map((u) => {
                const isSent = u.friend_status === 'request_sent';
                const isFriend = u.friend_status === 'friends';
                const isReceived = u.friend_status === 'request_received';
                const isPendingAction = actionInProgress === u.id;

                return (
                  <View
                    key={u.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 20,
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: '#14141e',
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => router.push(`/user/${u.id}` as any)}
                      style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                    >
                      <Avatar name={u.name} uri={u.profile_picture} size={44} />
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={{ color: '#e2e8f0', fontWeight: '700', fontSize: 14 }}>{u.name}</Text>
                        <Text style={{ color: '#71717a', fontSize: 11 }}>@{u.username}</Text>
                        {u.status ? (
                          <Text numberOfLines={1} style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>
                            {u.status}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>

                    {/* Friend action button */}
                    {isFriend ? (
                      <TouchableOpacity
                        onPress={() => router.push({
                          pathname: '/user/chat',
                          params: { id: u.id, name: u.name, avatar: u.profile_picture },
                        })}
                        style={{ backgroundColor: '#1e1e2e', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 }}
                      >
                        <Text style={{ color: '#a5b4fc', fontSize: 12, fontWeight: '700' }}>💬 Chat</Text>
                      </TouchableOpacity>
                    ) : isSent ? (
                      <View style={{ backgroundColor: '#181824', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: '#27273a' }}>
                        <Text style={{ color: '#71717a', fontSize: 12, fontWeight: '600' }}>⏳ Sent</Text>
                      </View>
                    ) : isReceived ? (
                      <TouchableOpacity
                        onPress={() => router.push(`/user/${u.id}` as any)}
                        style={{ backgroundColor: '#16a34a', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 }}
                      >
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Respond</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={() => handleSendFriendRequest(u.id)}
                        disabled={isPendingAction}
                        style={{
                          backgroundColor: '#4f46e5',
                          paddingHorizontal: 14,
                          paddingVertical: 7,
                          borderRadius: 10,
                        }}
                      >
                        {isPendingAction ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>➕ Add</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}