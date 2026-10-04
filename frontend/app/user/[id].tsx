import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, Image, Alert, RefreshControl,
  Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import {
  getUserProfile, toggleLike, getComments,
  createComment, updateComment, deleteComment,
  sendFriendRequest, acceptFriendRequest, unfriend,
  updatePost, deletePost, getFullImageUrl,
} from '../../api/axios';

// ─── Avatar Helper ────────────────────────────────────────
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

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

// ─── Comments Modal ───────────────────────────────────────
function CommentsModal({ post, user, visible, onClose }: {
  post: any; user: any; visible: boolean; onClose: () => void;
}) {
  const [comments, setComments]     = useState<any[]>([]);
  const [text, setText]             = useState('');
  const [loading, setLoading]       = useState(true);
  const [posting, setPosting]       = useState(false);
  const [editingId, setEditingId]   = useState<number | null>(null);
  const [editText, setEditText]     = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (!visible || !post?.post_id) return;
    setLoading(true);
    getComments(post.post_id)
      .then(d => setComments(Array.isArray(d) ? d : d.data ?? []))
      .finally(() => setLoading(false));
  }, [visible, post?.post_id]);

  const submit = async () => {
    if (!text.trim()) return;
    setPosting(true);
    try {
      const res = await createComment(post.post_id, { comment_text: text.trim() });
      const newComment = res.comment ?? res;
      setComments(prev => [newComment, ...prev]);
      setText('');
    } catch {
      Alert.alert('Error', 'Could not post comment.');
    } finally {
      setPosting(false);
    }
  };

  const startEdit = (c: any) => {
    setEditingId(c.comment_id);
    setEditText(c.comment_text);
  };

  const saveEdit = async () => {
    if (!editText.trim() || !editingId) return;
    setSavingEdit(true);
    try {
      const res = await updateComment(editingId, { comment_text: editText.trim() });
      const updated = res.comment ?? res;
      setComments(prev => prev.map(c => c.comment_id === editingId ? { ...c, comment_text: updated.comment_text ?? editText.trim() } : c));
      setEditingId(null);
    } catch {
      Alert.alert('Error', 'Could not update comment.');
    } finally {
      setSavingEdit(false);
    }
  };

  const removeComment = (id: number) => {
    Alert.alert('Delete comment', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await deleteComment(id);
          setComments(prev => prev.filter(c => c.comment_id !== id));
        } catch { Alert.alert('Error', 'Could not delete comment.'); }
      }},
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ maxHeight: '82%', backgroundColor: '#13131a', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderTopColor: '#1e1e2e' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#1e1e2e' }}>
            <Text style={{ color: '#e2e8f0', fontSize: 16, fontWeight: '800' }}>Comments ({comments.length})</Text>
            <TouchableOpacity onPress={onClose}><Text style={{ color: '#6366f1', fontWeight: '700', fontSize: 14 }}>Done</Text></TouchableOpacity>
          </View>
          {loading ? (
            <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color="#6366f1" /></View>
          ) : (
            <ScrollView style={{ padding: 16, maxHeight: 320 }}>
              {comments.length === 0 && <Text style={{ color: '#52525b', textAlign: 'center', marginVertical: 20 }}>No comments yet.</Text>}
              {comments.map((c) => (
                <View key={c.comment_id} style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                  <Avatar name={c.user?.name ?? '?'} uri={c.user?.profile_picture} size={32} />
                  <View style={{ flex: 1, backgroundColor: '#1a1a24', padding: 12, borderRadius: 14 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: '#e2e8f0', fontWeight: '700', fontSize: 13 }}>{c.user?.name}</Text>
                      <Text style={{ color: '#52525b', fontSize: 11 }}>{timeAgo(c.created_at)}</Text>
                    </View>

                    {/* Inline edit */}
                    {editingId === c.comment_id ? (
                      <View style={{ marginTop: 6 }}>
                        <TextInput
                          value={editText}
                          onChangeText={setEditText}
                          multiline
                          autoFocus
                          style={{
                            color: '#e2e8f0', fontSize: 13,
                            backgroundColor: '#13131a', borderRadius: 8, padding: 8,
                            borderWidth: 1, borderColor: '#4f46e5', minHeight: 40,
                            textAlignVertical: 'top',
                          }}
                        />
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                          <TouchableOpacity
                            onPress={saveEdit}
                            disabled={savingEdit || !editText.trim()}
                            style={{ backgroundColor: '#6366f1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 }}
                          >
                            {savingEdit ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Save</Text>}
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => setEditingId(null)}
                            style={{ backgroundColor: '#1e1e2e', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 }}
                          >
                            <Text style={{ color: '#52525b', fontSize: 11 }}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <Text style={{ color: '#cbd5e1', fontSize: 13, marginTop: 4 }}>{c.comment_text}</Text>
                    )}

                    {(Number(c.user?.id || c.user_id) === Number(user?.id) || user?.role === 'admin') && editingId !== c.comment_id && (
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, justifyContent: 'flex-end' }}>
                        <TouchableOpacity
                          onPress={() => startEdit(c)}
                          style={{ backgroundColor: '#1e1e2e', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}
                        >
                          <Text style={{ color: '#a5b4fc', fontSize: 11, fontWeight: '700' }}>✏️ Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => removeComment(c.comment_id)}
                          style={{ backgroundColor: '#27171a', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}
                        >
                          <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '700' }}>🗑️ Delete</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
          <View style={{ flexDirection: 'row', gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: '#1e1e2e', alignItems: 'center' }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Write a comment..."
              placeholderTextColor="#52525b"
              style={{ flex: 1, backgroundColor: '#0a0a0f', color: '#e2e8f0', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: '#1e1e2e' }}
            />
            <TouchableOpacity onPress={submit} disabled={posting || !text.trim()} style={{ backgroundColor: text.trim() ? '#6366f1' : '#1e1e2e', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 }}>
              {posting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: text.trim() ? '#fff' : '#52525b', fontWeight: '700' }}>Post</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Main User Profile Screen ─────────────────────────────
export default function UserProfileScreen() {
  const { id }       = useLocalSearchParams<{ id: string }>();
  const { user: me } = useAuth();
  const router       = useRouter();

  const [profile, setProfile]         = useState<any>(null);
  const [posts, setPosts]             = useState<any[]>([]);
  const [friendStatus, setFriendStatus] = useState<string>('none');
  const [isSelf, setIsSelf]           = useState<boolean>(false);
  const [friendRequestId, setFriendRequestId] = useState<number | null>(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [activeCommentPost, setActiveCommentPost] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Edit post state
  const [editingPost, setEditingPost]           = useState<any | null>(null);
  const [editContent, setEditContent]           = useState('');
  const [editImageUri, setEditImageUri]         = useState<string | null>(null);
  const [editImageBase64, setEditImageBase64]   = useState<string | null>(null);
  const [editImageChanged, setEditImageChanged] = useState(false);
  const [editImageRemoved, setEditImageRemoved] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const openEditModal = (post: any) => {
    setEditingPost(post);
    setEditContent(post.content);
    setEditImageUri(post.image_url);
    setEditImageBase64(null);
    setEditImageChanged(false);
    setEditImageRemoved(false);
  };

  const pickEditImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photos access to attach an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [16, 9],
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setEditImageUri(result.assets[0].uri);
      setEditImageBase64(result.assets[0].base64 ?? null);
      setEditImageChanged(true);
      setEditImageRemoved(false);
    }
  };

  const handleUpdatePost = async () => {
    if (!editingPost) return;
    if (!editContent.trim()) {
      Alert.alert('Empty post', 'Post content cannot be empty.');
      return;
    }
    setIsSubmittingEdit(true);
    try {
      let res;
      if (editImageRemoved) {
        res = await updatePost(editingPost.post_id, {
          content: editContent.trim(),
          remove_image: true,
        });
      } else if (editImageChanged && editImageUri) {
        if (Platform.OS === 'web') {
          let sent = false;
          try {
            const form = new FormData();
            form.append('content', editContent.trim());
            const resp = await fetch(editImageUri);
            const blob = await resp.blob();
            form.append('image', blob, 'post.jpg');
            res = await updatePost(editingPost.post_id, form);
            sent = true;
          } catch {}
          if (!sent && editImageBase64) {
            res = await updatePost(editingPost.post_id, {
              content: editContent.trim(),
              image: `data:image/jpeg;base64,${editImageBase64}`,
            });
            sent = true;
          }
          if (!sent) throw new Error('Could not upload image.');
        } else {
          const form = new FormData();
          form.append('content', editContent.trim());
          const filename = editImageUri.split('/').pop() || 'post.jpg';
          const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
          form.append('image', {
            uri: editImageUri,
            name: filename,
            type: `image/${ext === 'png' ? 'png' : 'jpeg'}`,
          } as any);
          res = await updatePost(editingPost.post_id, form);
        }
      } else {
        res = await updatePost(editingPost.post_id, {
          content: editContent.trim(),
        });
      }

      const updated = res?.post || res;
      if (updated) {
        setPosts(prev => prev.map(p => p.post_id === updated.post_id ? { ...p, ...updated } : p));
      }
      setEditingPost(null);
      Alert.alert('Success', 'Post updated successfully!');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not update post.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleDeletePost = (postId: number) => {
    Alert.alert('Delete Post', 'Are you sure you want to delete this post? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePost(postId);
            setPosts(prev => prev.filter(p => p.post_id !== postId));
            Alert.alert('Deleted', 'Post deleted successfully.');
          } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.message || 'Could not delete post.');
          }
        },
      },
    ]);
  };

  const fetchProfile = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getUserProfile(id);
      setProfile(data.user);
      setPosts(data.posts ?? []);
      setFriendStatus(data.friend_status ?? 'none');
      setFriendRequestId(data.friend_request_id ?? null);
      setIsSelf(data.is_self || me?.id === Number(id));
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not load user profile.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, me]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleLike = async (postId: number) => {
    try {
      const res = await toggleLike(postId);
      setPosts(prev => prev.map(p => {
        if (p.post_id === postId) {
          return {
            ...p,
            liked: res.liked,
            likes_count: res.likes_count,
          };
        }
        return p;
      }));
    } catch {}
  };

  const handleFriendAction = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      if (friendStatus === 'none') {
        await sendFriendRequest(id);
        setFriendStatus('request_sent');
        Alert.alert('Success', 'Friend request sent!');
      } else if (friendStatus === 'request_received') {
        if (friendRequestId) {
          await acceptFriendRequest(friendRequestId);
          setFriendStatus('friends');
          Alert.alert('Connected! 🎉', `You and ${profile?.name} are now friends!`);
        } else {
          await fetchProfile();
        }
      } else if (friendStatus === 'friends') {
        Alert.alert('Unfriend', `Remove ${profile?.name} from your friends?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Unfriend', style: 'destructive', onPress: async () => {
            await unfriend(id);
            setFriendStatus('none');
          }},
        ]);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Action failed.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0f', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#6366f1" size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0f', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#ef4444', fontSize: 18, fontWeight: '700' }}>User not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16, backgroundColor: '#1e1e2e', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 }}>
          <Text style={{ color: '#a5b4fc', fontWeight: '700' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderHeader = () => (
    <View>
      {/* Banner */}
      <View style={{ height: 120, backgroundColor: profile.role === 'admin' ? '#450a0a' : '#1e1b4b' }}>
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, backgroundColor: '#0a0a0f', borderTopLeftRadius: 24, borderTopRightRadius: 24 }} />
      </View>

      {/* Avatar & Buttons Row */}
      <View style={{ paddingHorizontal: 20, marginTop: -50, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 }}>
        <View style={{ borderWidth: 3, borderColor: '#0a0a0f', borderRadius: 999 }}>
          <Avatar name={profile.name} uri={profile.profile_picture} size={84} />
        </View>

        {/* Actions */}
        <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 4 }}>
          {isSelf ? (
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/profile')}
              style={{ backgroundColor: '#312e81', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 9 }}
            >
              <Text style={{ color: '#a5b4fc', fontSize: 13, fontWeight: '700' }}>My Profile</Text>
            </TouchableOpacity>
          ) : (
            <>
              {/* Message button */}
              <TouchableOpacity
                onPress={() => router.push({
                  pathname: '/user/chat',
                  params: { id: profile.id, name: profile.name, avatar: profile.profile_picture },
                })}
                style={{ backgroundColor: '#1e1e2e', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <Text style={{ fontSize: 14 }}>💬</Text>
                <Text style={{ color: '#e2e8f0', fontSize: 13, fontWeight: '700' }}>Message</Text>
              </TouchableOpacity>

              {/* Friend Button */}
              <TouchableOpacity
                onPress={handleFriendAction}
                disabled={actionLoading || friendStatus === 'request_sent'}
                style={{
                  backgroundColor: friendStatus === 'friends' ? '#14532d' : friendStatus === 'request_sent' ? '#27272a' : friendStatus === 'request_received' ? '#16a34a' : '#4f46e5',
                  borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9,
                }}
              >
                <Text style={{ color: friendStatus === 'request_sent' ? '#71717a' : '#fff', fontSize: 13, fontWeight: '700' }}>
                  {friendStatus === 'friends' ? '👥 Friends' : friendStatus === 'request_sent' ? '⏳ Requested' : friendStatus === 'request_received' ? '🤝 Accept' : '➕ Add Friend'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* User Info */}
      <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text style={{ color: '#f1f5f9', fontSize: 22, fontWeight: '900' }}>{profile.name}</Text>
          {profile.role === 'admin' && (
            <View style={{ backgroundColor: '#450a0a', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#ef4444' }}>
              <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: '800' }}>ADMIN</Text>
            </View>
          )}
          {!profile.is_active && (
            <View style={{ backgroundColor: '#450a0a', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: '800' }}>SUSPENDED</Text>
            </View>
          )}
        </View>

        <Text style={{ color: '#6366f1', fontSize: 13, fontWeight: '600', marginTop: 2 }}>@{profile.username}</Text>

        {profile.bio ? (
          <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 8, lineHeight: 20 }}>{profile.bio}</Text>
        ) : null}

        {/* Stats card */}
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
          <View style={{ flex: 1, backgroundColor: '#13131a', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#1e1e2e', alignItems: 'center' }}>
            <Text style={{ color: '#6366f1', fontSize: 20, fontWeight: '900' }}>{profile.posts_count ?? posts.length}</Text>
            <Text style={{ color: '#52525b', fontSize: 11, fontWeight: '700', marginTop: 2 }}>POSTS</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: '#13131a', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#1e1e2e', alignItems: 'center' }}>
            <Text style={{ color: '#22c55e', fontSize: 20, fontWeight: '900' }}>
              {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </Text>
            <Text style={{ color: '#52525b', fontSize: 11, fontWeight: '700', marginTop: 2 }}>JOINED</Text>
          </View>
        </View>

        <Text style={{ color: '#6366f1', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginTop: 24, marginBottom: 8 }}>
          ACTIVITY &amp; POSTS ({posts.length})
        </Text>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0f' }}>
      {/* Top Navbar */}
      <View style={{ paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16, backgroundColor: '#0f0f14', borderBottomWidth: 1, borderBottomColor: '#1e1e2e', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#1e1e2e', alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: '#e2e8f0', fontSize: 18 }}>←</Text>
        </TouchableOpacity>
        <Text style={{ color: '#e2e8f0', fontWeight: '800', fontSize: 17, flex: 1 }} numberOfLines={1}>
          {profile.name}
        </Text>
      </View>

      <FlatList
        data={posts}
        keyExtractor={p => String(p.post_id)}
        ListHeaderComponent={renderHeader}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProfile(); }} tintColor="#6366f1" />}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', padding: 36 }}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>📝</Text>
            <Text style={{ color: '#52525b', fontSize: 14 }}>No posts shared yet.</Text>
          </View>
        }
        renderItem={({ item: p }) => {
          const canManage = isSelf || me?.role === 'admin' || Number(p.user_id) === Number(me?.id);
          return (
            <View style={{ marginHorizontal: 16, marginBottom: 14, backgroundColor: '#13131a', borderRadius: 16, borderWidth: 1, borderColor: '#1e1e2e', overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 }}>
                <Avatar name={profile.name} uri={profile.profile_picture} size={38} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#e2e8f0', fontWeight: '700', fontSize: 14 }}>{profile.name}</Text>
                  <Text style={{ color: '#52525b', fontSize: 11 }}>{timeAgo(p.created_at)}</Text>
                </View>

                {canManage && (
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => openEditModal(p)}
                      style={{ backgroundColor: '#1e1b4b', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#312e81' }}
                    >
                      <Text style={{ color: '#818cf8', fontSize: 12, fontWeight: '700' }}>✏️ Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeletePost(p.post_id)}
                      style={{ backgroundColor: '#450a0a', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#7f1d1d' }}
                    >
                      <Text style={{ color: '#f87171', fontSize: 12, fontWeight: '700' }}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <Text style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 22, paddingHorizontal: 14, paddingBottom: 12 }}>
                {p.content}
              </Text>

              {getFullImageUrl(p.image_url) ? (
                <Image source={{ uri: getFullImageUrl(p.image_url)! }} style={{ width: '100%', height: 200, backgroundColor: '#0a0a0f' }} resizeMode="cover" />
              ) : null}

              {/* Interaction footer */}
              <View style={{ flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#1e1e2e', gap: 16, alignItems: 'center' }}>
                <TouchableOpacity onPress={() => handleLike(p.post_id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 16 }}>{p.liked ? '❤️' : '🤍'}</Text>
                  <Text style={{ color: p.liked ? '#ef4444' : '#64748b', fontSize: 12, fontWeight: '700' }}>
                    {p.likes_count ?? 0}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setActiveCommentPost(p)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 16 }}>💬</Text>
                  <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '700' }}>
                    {p.comments?.length ?? 0}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      {/* Edit Post Modal */}
      <Modal visible={!!editingPost} animationType="slide" transparent onRequestClose={() => setEditingPost(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ maxHeight: '90%', backgroundColor: '#13131a', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderTopColor: '#1e1e2e' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1e1e2e' }}>
              <TouchableOpacity onPress={() => setEditingPost(null)}>
                <Text style={{ color: '#71717a', fontSize: 14, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={{ color: '#e2e8f0', fontSize: 16, fontWeight: '800' }}>Edit Post</Text>
              <TouchableOpacity
                onPress={handleUpdatePost}
                disabled={isSubmittingEdit || !editContent.trim()}
                style={{
                  backgroundColor: editContent.trim() ? '#4f46e5' : '#1e1e2e',
                  paddingHorizontal: 16,
                  paddingVertical: 7,
                  borderRadius: 12,
                }}
              >
                {isSubmittingEdit ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: editContent.trim() ? '#fff' : '#52525b', fontWeight: '700', fontSize: 13 }}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 18, maxHeight: 420 }}>
              {/* User row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <Avatar name={profile.name} uri={profile.profile_picture} size={40} />
                <View>
                  <Text style={{ color: '#e2e8f0', fontWeight: '700', fontSize: 14 }}>{profile.name}</Text>
                  <Text style={{ color: '#6366f1', fontSize: 11, fontWeight: '600' }}>@{profile.username}</Text>
                </View>
              </View>

              {/* Text input */}
              <TextInput
                value={editContent}
                onChangeText={setEditContent}
                placeholder="What's happening on campus?"
                placeholderTextColor="#52525b"
                multiline
                autoFocus
                style={{
                  color: '#e2e8f0',
                  fontSize: 16,
                  lineHeight: 24,
                  minHeight: 110,
                  textAlignVertical: 'top',
                }}
              />

              {/* Image preview */}
              {editImageUri && !editImageRemoved ? (
                <View style={{ marginTop: 12, position: 'relative', borderRadius: 14, overflow: 'hidden' }}>
                  <Image
                    source={{ uri: getFullImageUrl(editImageUri) || editImageUri }}
                    style={{ width: '100%', height: 200, borderRadius: 14 }}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    onPress={() => setEditImageRemoved(true)}
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      backgroundColor: 'rgba(0,0,0,0.75)',
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700' }}>✕ Remove Photo</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </ScrollView>

            {/* Bottom photo action */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#1e1e2e' }}>
              <Text style={{ color: '#71717a', fontSize: 13, fontWeight: '600' }}>
                {editImageUri && !editImageRemoved ? 'Replace current photo' : 'Add a photo'}
              </Text>
              <TouchableOpacity
                onPress={pickEditImage}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: '#181824',
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#27273a',
                }}
              >
                <Text style={{ fontSize: 16 }}>📸</Text>
                <Text style={{ color: '#cbd5e1', fontSize: 13, fontWeight: '600' }}>
                  {editImageUri && !editImageRemoved ? 'Change Photo' : 'Add Photo'}
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {activeCommentPost && (
        <CommentsModal
          post={activeCommentPost}
          user={me}
          visible={!!activeCommentPost}
          onClose={() => setActiveCommentPost(null)}
        />
      )}
    </View>
  );
}
