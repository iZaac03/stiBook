import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Image,
  Modal, KeyboardAvoidingView, Platform, ScrollView, TextInput,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  getPosts, toggleLike, getComments,
  createComment, updateComment, deleteComment,
  createPost, updatePost, deletePost, getFullImageUrl,
  searchUsers, getNotifications, getUnreadNotifCount,
  markNotificationRead, markAllNotificationsRead, clearAllNotifications,
  sendFriendRequest,
} from '../../api/axios';

// ─── Helpers ─────────────────────────────────────────────

function Avatar({ name, uri, size = 38 }: { name: string; uri?: string | null; size?: number }) {
  const init = name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const full = getFullImageUrl(uri);
  if (full) return <Image source={{ uri: full }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#312e81', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#c7d2fe', fontWeight: '800', fontSize: size * 0.33 }}>{init}</Text>
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

// ─── Types ────────────────────────────────────────────────

type Post = {
  post_id: number;
  content: string;
  image_url: string | null;
  created_at: string;
  likes_count?: number;
  liked?: boolean;
  user: { id: number; name: string; username: string; profile_picture: string | null };
};

type Comment = {
  comment_id: number;
  comment_text: string;
  created_at: string;
  user: { id: number; name: string; profile_picture: string | null };
  user_id?: number;
};

// ─── Comments Modal ───────────────────────────────────────

function CommentsModal({ post, user, visible, onClose }: {
  post: Post; user: any; visible: boolean; onClose: () => void;
}) {
  const router = useRouter();
  const [comments, setComments]     = useState<Comment[]>([]);
  const [text, setText]             = useState('');
  const [loading, setLoading]       = useState(true);
  const [posting, setPosting]       = useState(false);
  const [editingId, setEditingId]   = useState<number | null>(null);
  const [editText, setEditText]     = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    getComments(post.post_id)
      .then(d => setComments(Array.isArray(d) ? d : d.data ?? []))
      .finally(() => setLoading(false));
  }, [visible, post.post_id]);

  // ── Add comment ──────────────────────────────────────────
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

  // ── Edit comment ─────────────────────────────────────────
  const startEdit = (c: Comment) => {
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

  // ── Delete comment ───────────────────────────────────────
  const remove = (id: number) =>
    Alert.alert('Delete comment?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteComment(id);
            setComments(prev => prev.filter(c => c.comment_id !== id));
          } catch {
            Alert.alert('Error', 'Could not delete comment.');
          }
        },
      },
    ]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ maxHeight: '85%' }}>
          <View style={{ backgroundColor: '#13131a', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>

            {/* Handle */}
            <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
              <View style={{ width: 40, height: 4, backgroundColor: '#1e1e2e', borderRadius: 2 }} />
            </View>

            {/* Title bar */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e1e2e' }}>
              <Text style={{ color: '#e2e8f0', fontWeight: '800', fontSize: 16 }}>
                Comments {comments.length > 0 ? `(${comments.length})` : ''}
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={{ color: '#52525b', fontSize: 26, lineHeight: 30 }}>×</Text>
              </TouchableOpacity>
            </View>

            {/* List */}
            {loading ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator color="#6366f1" />
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
                {comments.length === 0 && (
                  <Text style={{ color: '#3f3f46', textAlign: 'center', marginTop: 24, fontSize: 13 }}>
                    No comments yet. Be the first!
                  </Text>
                )}
                {comments.map(c => (
                  <View key={c.comment_id} style={{ flexDirection: 'row', gap: 10, marginBottom: 4 }}>
                    <TouchableOpacity
                      onPress={() => {
                        onClose();
                        router.push((c.user?.id === user?.id ? '/(tabs)/profile' : `/user/${c.user?.id}`) as any);
                      }}
                    >
                      <Avatar name={c.user.name} uri={c.user.profile_picture} size={30} />
                    </TouchableOpacity>
                    <View style={{ flex: 1, backgroundColor: '#0a0a0f', borderRadius: 12, padding: 10 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <TouchableOpacity
                          onPress={() => {
                            onClose();
                            router.push((c.user?.id === user?.id ? '/(tabs)/profile' : `/user/${c.user?.id}`) as any);
                          }}
                        >
                          <Text style={{ color: '#a5b4fc', fontWeight: '700', fontSize: 12 }}>{c.user.name}</Text>
                        </TouchableOpacity>
                        <Text style={{ color: '#3f3f46', fontSize: 10 }}>{timeAgo(c.created_at)}</Text>
                      </View>

                      {/* Edit mode */}
                      {editingId === c.comment_id ? (
                        <View>
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
                              style={{ backgroundColor: '#6366f1', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 }}
                            >
                              {savingEdit
                                ? <ActivityIndicator color="#fff" size="small" />
                                : <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Save</Text>
                              }
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => setEditingId(null)}
                              style={{ backgroundColor: '#1e1e2e', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 }}
                            >
                              <Text style={{ color: '#52525b', fontSize: 12 }}>Cancel</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        /* Read mode */
                        <Text style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 18 }}>{c.comment_text}</Text>
                      )}

                      {/* Owner actions */}
                      {(Number(c.user?.id || c.user_id) === Number(user?.id) || user?.role === 'admin') && editingId !== c.comment_id && (
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                          <TouchableOpacity
                            onPress={() => startEdit(c)}
                            style={{ backgroundColor: '#1e1e2e', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6 }}
                          >
                            <Text style={{ color: '#a5b4fc', fontSize: 11, fontWeight: '700' }}>✏️ Edit</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => remove(c.comment_id)}
                            style={{ backgroundColor: '#27171a', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6 }}
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

            {/* New comment input */}
            <View style={{ flexDirection: 'row', gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: '#1e1e2e', alignItems: 'flex-end' }}>
              <Avatar name={user?.name ?? ''} uri={user?.profile_picture} size={30} />
              <View style={{ flex: 1, backgroundColor: '#0a0a0f', borderRadius: 14, borderWidth: 1, borderColor: '#1e1e2e', paddingHorizontal: 12, paddingVertical: 8 }}>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder="Write a comment..."
                  placeholderTextColor="#3f3f46"
                  multiline
                  style={{ color: '#e2e8f0', fontSize: 13, maxHeight: 80 }}
                />
              </View>
              <TouchableOpacity
                onPress={submit}
                disabled={posting || !text.trim()}
                style={{ backgroundColor: text.trim() ? '#6366f1' : '#1e1e2e', borderRadius: 12, padding: 10 }}
              >
                {posting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={{ fontSize: 18 }}>➤</Text>
                }
              </TouchableOpacity>
            </View>

          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Home Screen ──────────────────────────────────────────

export default function HomeScreen() {
  const { user } = useAuth();
  const router   = useRouter();

  const [posts, setPosts]           = useState<Post[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage]             = useState(1);
  const [hasMore, setHasMore]       = useState(true);
  const [activePost, setActivePost] = useState<Post | null>(null);

  // ─── Search state ─────────────────────────────────────────
  const [searchQuery, setSearchQuery]           = useState('');
  const [searchResults, setSearchResults]       = useState<any[]>([]);
  const [isSearching, setIsSearching]           = useState(false);
  const [searchFocused, setSearchFocused]       = useState(false);

  // ─── Notification state ───────────────────────────────────
  const [notifications, setNotifications]       = useState<any[]>([]);
  const [unreadCount, setUnreadCount]           = useState(0);
  const [notifModalOpen, setNotifModalOpen]     = useState(false);
  const [loadingNotifs, setLoadingNotifs]       = useState(false);
  const [liveBanner, setLiveBanner]             = useState<{ id: number; title: string; message: string; type: string; sender_id?: number } | null>(null);

  // Search debouncing
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const users = await searchUsers(searchQuery.trim());
        setSearchResults(users || []);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchFriendAction = async (targetUser: any) => {
    try {
      if (targetUser.friend_status === 'none') {
        await sendFriendRequest(targetUser.id);
        setSearchResults(prev => prev.map(u => u.id === targetUser.id ? { ...u, friend_status: 'request_sent' } : u));
        Alert.alert('Sent', `Friend request sent to ${targetUser.name}!`);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not send friend request.');
    }
  };

  const fetchNotifications = useCallback(async () => {
    try {
      setLoadingNotifs(true);
      const res = await getNotifications(1);
      const list = res.data ?? res;
      setNotifications(list || []);
      const countRes = await getUnreadNotifCount();
      setUnreadCount(countRes.unread_count ?? 0);
    } catch {
    } finally {
      setLoadingNotifs(false);
    }
  }, []);

  // Poll for notifications and trigger live top notification bar banner when new one arrives!
  useEffect(() => {
    fetchNotifications();

    const interval = setInterval(async () => {
      try {
        const countRes = await getUnreadNotifCount();
        const newCount = countRes.unread_count ?? 0;
        setUnreadCount(prev => {
          if (newCount > prev) {
            getNotifications(1).then(res => {
              const list = res.data ?? res;
              setNotifications(list || []);
              if (list && list.length > 0) {
                const latest = list[0];
                setLiveBanner({
                  id: latest.id,
                  title: latest.title,
                  message: latest.message,
                  type: latest.type,
                  sender_id: latest.sender_id,
                });
              }
            }).catch(() => {});
          }
          return newCount;
        });
      } catch {}
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Auto dismiss live banner after 6 seconds
  useEffect(() => {
    if (liveBanner) {
      const timer = setTimeout(() => setLiveBanner(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [liveBanner]);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
  };

  const handleClearAllNotifs = async () => {
    try {
      await clearAllNotifications();
      setNotifications([]);
      setUnreadCount(0);
    } catch {}
  };

  const handleNotificationPress = async (n: any) => {
    if (!n.is_read) {
      try {
        await markNotificationRead(n.id);
        setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, is_read: true } : item));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch {}
    }
    setNotifModalOpen(false);

    if (n.sender_id) {
      router.push(`/user/${n.sender_id}` as any);
    }
  };

  // Add post composer state
  const [composerOpen, setComposerOpen]         = useState(false);
  const [postText, setPostText]                 = useState('');
  const [postImageUri, setPostImageUri]         = useState<string | null>(null);
  const [postImageBase64, setPostImageBase64]   = useState<string | null>(null);
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);

  // Edit post state
  const [editingPost, setEditingPost]           = useState<Post | null>(null);
  const [editContent, setEditContent]           = useState('');
  const [editImageUri, setEditImageUri]         = useState<string | null>(null);
  const [editImageBase64, setEditImageBase64]   = useState<string | null>(null);
  const [editImageChanged, setEditImageChanged] = useState(false);
  const [editImageRemoved, setEditImageRemoved] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const openEditModal = (post: Post) => {
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

  const pickComposerImage = async () => {
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
      setPostImageUri(result.assets[0].uri);
      setPostImageBase64(result.assets[0].base64 ?? null);
      setComposerOpen(true);
    }
  };

  const handleCreatePost = async () => {
    if (!postText.trim()) {
      Alert.alert('Empty post', 'Please write something first!');
      return;
    }
    setIsSubmittingPost(true);
    try {
      let res;
      if (postImageUri) {
        if (Platform.OS === 'web') {
          let sent = false;
          try {
            const form = new FormData();
            form.append('content', postText.trim());
            const resp = await fetch(postImageUri);
            const blob = await resp.blob();
            form.append('image', blob, 'post.jpg');
            res = await createPost(form);
            sent = true;
          } catch {}
          if (!sent && postImageBase64) {
            res = await createPost({
              content: postText.trim(),
              image: `data:image/jpeg;base64,${postImageBase64}`,
            });
            sent = true;
          }
          if (!sent) throw new Error('Could not upload image.');
        } else {
          const form = new FormData();
          form.append('content', postText.trim());
          const filename = postImageUri.split('/').pop() || 'post.jpg';
          const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
          form.append('image', {
            uri: postImageUri,
            name: filename,
            type: `image/${ext === 'png' ? 'png' : 'jpeg'}`,
          } as any);
          res = await createPost(form);
        }
      } else {
        res = await createPost({ content: postText.trim() });
      }

      const newPost = res?.post || res;
      if (newPost) {
        setPosts(prev => [newPost, ...prev]);
      }
      setPostText('');
      setPostImageUri(null);
      setPostImageBase64(null);
      setComposerOpen(false);
      Alert.alert('Success', 'Your post is now live!');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not publish post.');
    } finally {
      setIsSubmittingPost(false);
    }
  };

  const fetchPosts = useCallback(async (p = 1, reset = false) => {
    try {
      const res  = await getPosts(p);
      const data: Post[] = res.data ?? res;
      setPosts(prev => reset ? data : [...prev, ...data]);
      if (!res.next_page_url) setHasMore(false);
    } catch {
      Alert.alert('Error', 'Could not load posts.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchPosts(1, true); }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    fetchPosts(1, true);
  };

  // ── Like: use server response only ───────────────────────
  const onLike = async (post: Post) => {
    try {
      const res = await toggleLike(post.post_id);
      // res = { liked: bool, likes_count: number, post_id: number }
      setPosts(prev => prev.map(p =>
        p.post_id === res.post_id
          ? { ...p, liked: res.liked, likes_count: res.likes_count }
          : p
      ));
    } catch {
      Alert.alert('Error', 'Could not update like.');
    }
  };

  const renderPost = ({ item }: { item: Post }) => (
    <View style={{
      backgroundColor: '#13131a', borderRadius: 18,
      marginHorizontal: 14, marginBottom: 14,
      borderWidth: 1, borderColor: '#1e1e2e', overflow: 'hidden',
    }}>
      {/* User row — clickable to view profile + owner actions */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 }}>
        <TouchableOpacity
          onPress={() => router.push((item.user?.id === user?.id ? '/(tabs)/profile' : `/user/${item.user?.id}`) as any)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}
        >
          <Avatar name={item.user.name} uri={item.user.profile_picture} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#e2e8f0', fontWeight: '700', fontSize: 14 }}>{item.user.name}</Text>
            <Text style={{ color: '#52525b', fontSize: 11 }}>@{item.user.username} · {timeAgo(item.created_at)}</Text>
          </View>
        </TouchableOpacity>

        {/* Owner actions: Edit and Delete */}
        {(Number(item.user?.id) === Number(user?.id) || user?.role === 'admin') && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TouchableOpacity
              onPress={() => openEditModal(item)}
              style={{
                backgroundColor: '#1e1e2e',
                paddingHorizontal: 9,
                paddingVertical: 5,
                borderRadius: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                borderWidth: 1,
                borderColor: '#2a2a3e',
              }}
            >
              <Text style={{ fontSize: 11 }}>✏️</Text>
              <Text style={{ color: '#a5b4fc', fontSize: 11, fontWeight: '700' }}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleDeletePost(item.post_id)}
              style={{
                backgroundColor: '#27171a',
                paddingHorizontal: 8,
                paddingVertical: 5,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#3f1d24',
              }}
            >
              <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '700' }}>🗑️</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Content */}
      <Text style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 22, paddingHorizontal: 14, paddingBottom: item.image_url ? 10 : 14 }}>
        {item.content}
      </Text>

      {/* Image */}
      {getFullImageUrl(item.image_url) ? (
        <Image source={{ uri: getFullImageUrl(item.image_url)! }} style={{ width: '100%', height: 220 }} resizeMode="cover" />
      ) : null}

      {/* Like + Comment bar */}
      <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#1e1e2e' }}>
        <TouchableOpacity
          onPress={() => onLike(item)}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 }}
        >
          <Text style={{ fontSize: 16 }}>{item.liked ? '❤️' : '🤍'}</Text>
          <Text style={{ color: item.liked ? '#f43f5e' : '#52525b', fontSize: 13, fontWeight: '600' }}>
            {item.likes_count ?? 0}
          </Text>
        </TouchableOpacity>

        <View style={{ width: 1, backgroundColor: '#1e1e2e' }} />

        <TouchableOpacity
          onPress={() => setActivePost(item)}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 }}
        >
          <Text style={{ fontSize: 16 }}>💬</Text>
          <Text style={{ color: '#52525b', fontSize: 13, fontWeight: '600' }}>Comment</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const displayedPosts = searchQuery.trim()
    ? posts.filter(p =>
        p.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.user?.username?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : posts;

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0f' }}>

      {/* Live Floating Notification Bar Banner */}
      {liveBanner && (
        <View style={{
          position: 'absolute',
          top: Platform.OS === 'web' ? 16 : 50,
          left: 14,
          right: 14,
          zIndex: 999,
          backgroundColor: '#181824',
          borderRadius: 16,
          padding: 12,
          borderWidth: 1.5,
          borderColor: liveBanner.type === 'friend_request' ? '#a855f7' : liveBanner.type === 'friend_accepted' ? '#22c55e' : '#6366f1',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.6,
          shadowRadius: 10,
          elevation: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}>
          <View style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: liveBanner.type === 'friend_request' ? '#581c87' : liveBanner.type === 'friend_accepted' ? '#14532d' : '#312e81',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 16 }}>
              {liveBanner.type === 'friend_request' ? '👥' : liveBanner.type === 'friend_accepted' ? '🤝' : '📝'}
            </Text>
          </View>

          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => {
              if (liveBanner.sender_id) router.push(`/user/${liveBanner.sender_id}` as any);
              setLiveBanner(null);
            }}
          >
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>
              {liveBanner.title}
            </Text>
            <Text style={{ color: '#cbd5e1', fontSize: 12, marginTop: 1 }} numberOfLines={1}>
              {liveBanner.message}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setLiveBanner(null)} style={{ padding: 4 }}>
            <Text style={{ color: '#71717a', fontSize: 13, fontWeight: '700' }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Header */}
      <View style={{ paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1e1e2e' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ color: '#6366f1', fontSize: 10, fontWeight: '800', letterSpacing: 2.5 }}>STIBOOK</Text>
            <Text style={{ color: '#e2e8f0', fontSize: 24, fontWeight: '900' }}>Feed</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {/* Notification Bell Button */}
            <TouchableOpacity
              onPress={() => { setNotifModalOpen(true); fetchNotifications(); }}
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                backgroundColor: '#181824',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: unreadCount > 0 ? '#6366f1' : '#27273a',
                position: 'relative',
              }}
            >
              <Text style={{ fontSize: 18 }}>🔔</Text>
              {unreadCount > 0 && (
                <View style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  backgroundColor: '#ef4444',
                  borderRadius: 10,
                  minWidth: 18,
                  height: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 4,
                  borderWidth: 2,
                  borderColor: '#0a0a0f',
                }}>
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Add Post header button */}
            <TouchableOpacity
              onPress={() => setComposerOpen(true)}
              style={{
                backgroundColor: '#4f46e5',
                paddingHorizontal: 14,
                paddingVertical: 9,
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>+</Text>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Post</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <View style={{ marginTop: 12 }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#13131a',
            borderRadius: 14,
            paddingHorizontal: 12,
            borderWidth: 1,
            borderColor: searchFocused ? '#6366f1' : '#1e1e2e',
            gap: 10,
          }}>
            <Text style={{ fontSize: 14, color: '#71717a' }}>🔍</Text>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search STIers, classmates, or posts..."
              placeholderTextColor="#52525b"
              style={{
                flex: 1,
                color: '#e2e8f0',
                fontSize: 14,
                paddingVertical: 9,
              }}
            />
            {isSearching && (
              <ActivityIndicator size="small" color="#6366f1" />
            )}
            {searchQuery.length > 0 && !isSearching && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text style={{ color: '#71717a', fontSize: 14, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Search Results Dropdown Panel */}
          {searchQuery.trim().length > 0 && (
            <View style={{
              backgroundColor: '#13131a',
              borderRadius: 16,
              marginTop: 8,
              borderWidth: 1,
              borderColor: '#27273a',
              maxHeight: 280,
              overflow: 'hidden',
            }}>
              <View style={{ paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1e1e2e', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: '#6366f1', fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>
                  PEOPLE FOUND ({searchResults.length})
                </Text>
                <Text style={{ color: '#52525b', fontSize: 11 }}>
                  Posts filtered below
                </Text>
              </View>

              <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled">
                {searchResults.length === 0 && !isSearching ? (
                  <View style={{ padding: 16, alignItems: 'center' }}>
                    <Text style={{ color: '#52525b', fontSize: 13 }}>No STIers found matching "{searchQuery}"</Text>
                  </View>
                ) : (
                  searchResults.map(u => (
                    <TouchableOpacity
                      key={u.id}
                      onPress={() => router.push(`/user/${u.id}` as any)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderBottomWidth: 1,
                        borderBottomColor: '#1a1a24',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        <Avatar name={u.name} uri={u.profile_picture} size={36} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#e2e8f0', fontWeight: '700', fontSize: 13 }} numberOfLines={1}>
                            {u.name}
                          </Text>
                          <Text style={{ color: '#6366f1', fontSize: 11 }} numberOfLines={1}>
                            @{u.username}
                          </Text>
                          {u.status ? (
                            <Text style={{ color: '#94a3b8', fontSize: 11, fontStyle: 'italic', marginTop: 2 }} numberOfLines={1}>
                              "{u.status}"
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      {/* Friend status button / badge */}
                      <TouchableOpacity
                        onPress={() => handleSearchFriendAction(u)}
                        disabled={u.friend_status !== 'none'}
                        style={{
                          backgroundColor: u.friend_status === 'friends' ? '#14532d' : u.friend_status === 'request_sent' ? '#27272a' : '#312e81',
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 8,
                        }}
                      >
                        <Text style={{ color: u.friend_status === 'request_sent' ? '#71717a' : '#fff', fontSize: 11, fontWeight: '700' }}>
                          {u.friend_status === 'friends' ? '👥 Friends' : u.friend_status === 'request_sent' ? '⏳ Sent' : '➕ Add'}
                        </Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          )}
        </View>
      </View>

      {/* Feed */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#6366f1" size="large" />
        </View>
      ) : (
        <FlatList
          data={displayedPosts}
          keyExtractor={p => String(p.post_id)}
          renderItem={renderPost}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
          onEndReached={() => {
            if (hasMore && !searchQuery.trim()) { const n = page + 1; setPage(n); fetchPosts(n); }
          }}
          onEndReachedThreshold={0.4}
          contentContainerStyle={{ paddingTop: 14, paddingBottom: 24 }}
          ListEmptyComponent={
            searchQuery.trim() ? (
              <View style={{ alignItems: 'center', padding: 36, backgroundColor: '#13131a', marginHorizontal: 14, borderRadius: 16, marginTop: 14 }}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>🔍</Text>
                <Text style={{ color: '#e2e8f0', fontWeight: '700', fontSize: 15 }}>No posts found</Text>
                <Text style={{ color: '#52525b', fontSize: 13, marginTop: 4 }}>No posts matching "{searchQuery}"</Text>
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingTop: 80 }}>
                <Text style={{ fontSize: 52, marginBottom: 12 }}>📭</Text>
                <Text style={{ color: '#e2e8f0', fontSize: 18, fontWeight: '800' }}>No posts yet</Text>
                <Text style={{ color: '#3f3f46', fontSize: 13, marginTop: 4 }}>Be the first to post something!</Text>
              </View>
            )
          }
          ListHeaderComponent={
            /* Post Composer Card at top of feed */
            <View style={{
              backgroundColor: '#13131a',
              marginHorizontal: 14,
              marginBottom: 16,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: '#1e1e2e',
              padding: 14,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar name={user?.name ?? 'User'} uri={user?.profile_picture} size={42} />
                <TouchableOpacity
                  onPress={() => setComposerOpen(true)}
                  style={{
                    flex: 1,
                    backgroundColor: '#0a0a0f',
                    borderRadius: 22,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderWidth: 1,
                    borderColor: '#27273a',
                  }}
                >
                  <Text style={{ color: '#71717a', fontSize: 14 }}>
                    What's on your mind, {user?.name?.split(' ')[0] || 'Student'}?
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#1e1e2e', marginTop: 12, paddingTop: 10, gap: 8 }}>
                <TouchableOpacity
                  onPress={pickComposerImage}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, backgroundColor: '#181824', borderRadius: 10 }}
                >
                  <Text style={{ fontSize: 15 }}>📸</Text>
                  <Text style={{ color: '#cbd5e1', fontSize: 12, fontWeight: '700' }}>Add Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setComposerOpen(true)}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, backgroundColor: '#181824', borderRadius: 10 }}
                >
                  <Text style={{ fontSize: 15 }}>✍️</Text>
                  <Text style={{ color: '#cbd5e1', fontSize: 12, fontWeight: '700' }}>Write Post</Text>
                </TouchableOpacity>
              </View>
            </View>
          }
        />
      )}

      {/* Create Post Modal */}
      <Modal visible={composerOpen} animationType="slide" transparent onRequestClose={() => setComposerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ maxHeight: '90%', backgroundColor: '#13131a', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderTopColor: '#1e1e2e' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1e1e2e' }}>
              <TouchableOpacity onPress={() => setComposerOpen(false)}>
                <Text style={{ color: '#71717a', fontSize: 14, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={{ color: '#e2e8f0', fontSize: 16, fontWeight: '800' }}>Create Post</Text>
              <TouchableOpacity
                onPress={handleCreatePost}
                disabled={isSubmittingPost || !postText.trim()}
                style={{
                  backgroundColor: postText.trim() ? '#4f46e5' : '#1e1e2e',
                  paddingHorizontal: 16,
                  paddingVertical: 7,
                  borderRadius: 12,
                }}
              >
                {isSubmittingPost ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: postText.trim() ? '#fff' : '#52525b', fontWeight: '700', fontSize: 13 }}>Post</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 18, maxHeight: 420 }}>
              {/* User row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <Avatar name={user?.name ?? 'User'} uri={user?.profile_picture} size={40} />
                <View>
                  <Text style={{ color: '#e2e8f0', fontWeight: '700', fontSize: 14 }}>{user?.name}</Text>
                  <Text style={{ color: '#6366f1', fontSize: 11, fontWeight: '600' }}>@{user?.username}</Text>
                </View>
              </View>

              {/* Text input */}
              <TextInput
                value={postText}
                onChangeText={setPostText}
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

              {/* Photo preview */}
              {postImageUri ? (
                <View style={{ marginTop: 12, position: 'relative', borderRadius: 14, overflow: 'hidden' }}>
                  <Image source={{ uri: postImageUri }} style={{ width: '100%', height: 200, borderRadius: 14 }} resizeMode="cover" />
                  <TouchableOpacity
                    onPress={() => { setPostImageUri(null); setPostImageBase64(null); }}
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      backgroundColor: 'rgba(0,0,0,0.7)',
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </ScrollView>

            {/* Bottom photo picker action */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#1e1e2e' }}>
              <Text style={{ color: '#71717a', fontSize: 13, fontWeight: '600' }}>Add to your post</Text>
              <TouchableOpacity
                onPress={pickComposerImage}
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
                <Text style={{ color: '#cbd5e1', fontSize: 13, fontWeight: '600' }}>Photo</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

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
                <Avatar name={editingPost?.user?.name ?? 'User'} uri={editingPost?.user?.profile_picture} size={40} />
                <View>
                  <Text style={{ color: '#e2e8f0', fontWeight: '700', fontSize: 14 }}>{editingPost?.user?.name}</Text>
                  <Text style={{ color: '#6366f1', fontSize: 11, fontWeight: '600' }}>@{editingPost?.user?.username}</Text>
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

      {/* Comments modal */}
      {activePost && (
        <CommentsModal
          post={activePost}
          user={user}
          visible={!!activePost}
          onClose={() => setActivePost(null)}
        />
      )}

      {/* ─── Notifications Modal (Notification Center) ─── */}
      <Modal visible={notifModalOpen} animationType="slide" transparent onRequestClose={() => setNotifModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <View style={{
            maxHeight: '85%',
            backgroundColor: '#13131a',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderTopWidth: 1,
            borderTopColor: '#1e1e2e',
            overflow: 'hidden',
          }}>
            {/* Modal Header */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 20,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: '#1e1e2e',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 20 }}>🔔</Text>
                <Text style={{ color: '#e2e8f0', fontSize: 18, fontWeight: '800' }}>Notifications</Text>
                {unreadCount > 0 && (
                  <View style={{ backgroundColor: '#4f46e5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{unreadCount} NEW</Text>
                  </View>
                )}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {unreadCount > 0 && (
                  <TouchableOpacity onPress={handleMarkAllRead}>
                    <Text style={{ color: '#818cf8', fontSize: 12, fontWeight: '700' }}>Read all</Text>
                  </TouchableOpacity>
                )}
                {notifications.length > 0 && (
                  <TouchableOpacity onPress={handleClearAllNotifs}>
                    <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700' }}>Clear</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setNotifModalOpen(false)} style={{ padding: 4 }}>
                  <Text style={{ color: '#71717a', fontSize: 16, fontWeight: '800' }}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Notifications List */}
            {loadingNotifs ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator color="#6366f1" size="large" />
              </View>
            ) : notifications.length === 0 ? (
              <View style={{ padding: 48, alignItems: 'center' }}>
                <Text style={{ fontSize: 40, marginBottom: 12 }}>🔕</Text>
                <Text style={{ color: '#e2e8f0', fontSize: 16, fontWeight: '800' }}>No notifications yet</Text>
                <Text style={{ color: '#52525b', fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
                  Whenever someone adds you as a friend or your friends post new updates, you will be notified here!
                </Text>
              </View>
            ) : (
              <ScrollView style={{ padding: 12 }}>
                {notifications.map(n => {
                  const isFriendReq = n.type === 'friend_request';
                  const isAccepted = n.type === 'friend_accepted';
                  const isFriendPost = n.type === 'friend_post';

                  return (
                    <TouchableOpacity
                      key={n.id}
                      onPress={() => handleNotificationPress(n)}
                      style={{
                        backgroundColor: n.is_read ? '#0f0f14' : '#181824',
                        borderRadius: 14,
                        padding: 14,
                        marginBottom: 10,
                        borderWidth: 1,
                        borderColor: n.is_read ? '#1a1a24' : '#312e81',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      <View style={{ position: 'relative' }}>
                        <Avatar
                          name={n.sender?.name || 'STIer'}
                          uri={n.sender?.profile_picture}
                          size={44}
                        />
                        <View style={{
                          position: 'absolute',
                          bottom: -2,
                          right: -2,
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          backgroundColor: isFriendReq ? '#7c3aed' : isAccepted ? '#16a34a' : '#4f46e5',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1.5,
                          borderColor: '#13131a',
                        }}>
                          <Text style={{ fontSize: 10 }}>
                            {isFriendReq ? '👥' : isAccepted ? '🤝' : '📝'}
                          </Text>
                        </View>
                      </View>

                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ color: n.is_read ? '#cbd5e1' : '#f1f5f9', fontWeight: '800', fontSize: 13 }}>
                            {n.title}
                          </Text>
                          <Text style={{ color: '#52525b', fontSize: 10 }}>
                            {timeAgo(n.created_at)}
                          </Text>
                        </View>
                        <Text style={{ color: n.is_read ? '#64748b' : '#cbd5e1', fontSize: 12, marginTop: 3, lineHeight: 17 }}>
                          {n.message}
                        </Text>
                      </View>

                      {!n.is_read && (
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#6366f1' }} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}