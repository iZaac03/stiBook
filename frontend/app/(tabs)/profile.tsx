import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Image, Alert, ActivityIndicator, RefreshControl, Modal, Platform,
  KeyboardAvoidingView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import {
  getPosts, uploadProfilePicture, updateProfile,
  getFullImageUrl, updatePost, deletePost,
} from '../../api/axios';

function Avatar({ name, uri, size = 80 }: { name: string; uri?: string | null; size?: number }) {
  const init = name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
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
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function ProfileScreen() {
  const { user, handleLogout, refreshUser, isAdmin } = useAuth() as any;
  const router = useRouter();

  const [posts, setPosts]                   = useState<any[]>([]);
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [statusModal, setStatusModal]       = useState(false);
  const [statusDraft, setStatusDraft]       = useState('');
  const [currentStatus, setCurrentStatus]   = useState('');
  const [savingStatus, setSavingStatus]     = useState(false);

  // Post editing state
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

  // Load saved status from user model or AsyncStorage cache
  useEffect(() => {
    (async () => {
      if (user?.status) {
        setCurrentStatus(user.status);
      } else if (user?.id) {
        try {
          const cached = await AsyncStorage.getItem(`user_status_${user.id}`);
          if (cached) setCurrentStatus(cached);
        } catch {}
      }
    })();
  }, [user?.id, user?.status]);

  const fetchPosts = useCallback(async () => {
    try {
      const res  = await getPosts(1);
      const all: any[] = res.data ?? res;
      setPosts(all.filter((p: any) => Number(p.user?.id || p.user_id) === Number(user?.id)));
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [user]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const onRefresh = () => { setRefreshing(true); fetchPosts(); };

  // ── Profile photo ─────────────────────────────────────────
  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo library access to change your picture.'); return; }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setUploadingPhoto(true);
      try {
        await uploadProfilePicture(asset.uri, asset.base64);
        if (refreshUser) await refreshUser();
        Alert.alert('Success', 'Profile photo updated!');
      } catch (e: any) {
        Alert.alert('Upload failed', e?.response?.data?.message ?? 'Could not upload photo.');
      } finally {
        setUploadingPhoto(false);
      }
    }
  };

  // ── Status: saved permanently until changed ───────────────
  const openStatusModal = () => {
    setStatusDraft(currentStatus);
    setStatusModal(true);
  };

  const saveStatus = async () => {
    const trimmed = statusDraft.trim();
    setCurrentStatus(trimmed);
    setStatusModal(false);
    setSavingStatus(true);

    try {
      // 1. Cache locally for instant availability
      if (user?.id) {
        await AsyncStorage.setItem(`user_status_${user.id}`, trimmed);
      }
      // 2. Persist to backend database
      await updateProfile({ status: trimmed });
      // 3. Refresh user in AuthContext
      if (refreshUser) await refreshUser();
    } catch (e) {
      console.error('Failed to save status to server', e);
    } finally {
      setSavingStatus(false);
    }
  };

  // ── Cross-Platform Logout ────────────────────────────────
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
      if (typeof window !== 'undefined' && window.confirm('Are you sure you want to log out?')) {
        doLogout();
      }
    } else {
      Alert.alert('Logout', 'Are you sure you want to log out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: doLogout },
      ]);
    }
  };

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0f', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color="#6366f1" size="large" />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0f' }}>

      {/* Status modal */}
      <Modal visible={statusModal} animationType="slide" transparent onRequestClose={() => setStatusModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#13131a', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1, borderTopColor: '#1e1e2e' }}>
            <Text style={{ color: '#e2e8f0', fontSize: 17, fontWeight: '800', marginBottom: 16 }}>Update Status</Text>
            <TextInput
              value={statusDraft}
              onChangeText={setStatusDraft}
              placeholder="What's happening right now?"
              placeholderTextColor="#3f3f46"
              multiline
              autoFocus
              style={{
                backgroundColor: '#0a0a0f', borderRadius: 14, borderWidth: 1,
                borderColor: '#1e1e2e', padding: 14, color: '#e2e8f0',
                fontSize: 15, minHeight: 80, textAlignVertical: 'top', marginBottom: 16,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setStatusModal(false)}
                style={{ flex: 1, borderWidth: 1, borderColor: '#1e1e2e', borderRadius: 14, padding: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#52525b', fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveStatus}
                style={{ flex: 1, backgroundColor: '#6366f1', borderRadius: 14, padding: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Indigo banner */}
        <View style={{ height: 130, backgroundColor: '#1e1b4b' }}>
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 48, backgroundColor: '#0a0a0f', borderTopLeftRadius: 28, borderTopRightRadius: 28 }} />
        </View>

        {/* Avatar + actions */}
        <View style={{ paddingHorizontal: 20, marginTop: -68, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16 }}>
          {/* Tappable avatar — change photo */}
          <TouchableOpacity onPress={pickPhoto} style={{ position: 'relative' }}>
            <View style={{ borderWidth: 3, borderColor: '#0a0a0f', borderRadius: 999 }}>
              <Avatar name={user?.name ?? ''} uri={user?.profile_picture} size={82} />
            </View>
            <View style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 26, height: 26, backgroundColor: '#6366f1',
              borderRadius: 13, alignItems: 'center', justifyContent: 'center',
              borderWidth: 2, borderColor: '#0a0a0f',
            }}>
              {uploadingPhoto
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={{ fontSize: 12 }}>📷</Text>
              }
            </View>
          </TouchableOpacity>

          {/* Action buttons */}
          <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 4 }}>
            {isAdmin && (
              <TouchableOpacity
                onPress={() => router.push('/admin')}
                style={{ backgroundColor: '#450a0a', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#ef4444' }}
              >
                <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700' }}>🛡️ Admin</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={openStatusModal}
              style={{ backgroundColor: '#312e81', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 }}
            >
              <Text style={{ color: '#a5b4fc', fontSize: 12, fontWeight: '700' }}>Edit Status</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onLogout}
              style={{ backgroundColor: '#1e1e2e', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 }}
            >
              <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700' }}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Name + username */}
        <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
          <Text style={{ color: '#f1f5f9', fontSize: 22, fontWeight: '900' }}>{user?.name}</Text>
          <Text style={{ color: '#6366f1', fontSize: 13, fontWeight: '600', marginTop: 2 }}>@{user?.username}</Text>
          {user?.bio ? (
            <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 6, lineHeight: 20 }}>{user.bio}</Text>
          ) : null}
          <Text style={{ color: '#3f3f46', fontSize: 11, marginTop: 6 }}>Tap your avatar to change profile photo</Text>
        </View>

        {/* Status box */}
        <View style={{ marginHorizontal: 20, marginBottom: 16, backgroundColor: '#13131a', borderRadius: 16, borderWidth: 1, borderColor: '#1e1e2e', overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1e1e2e' }}>
            <Text style={{ color: '#6366f1', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 }}>CURRENT STATUS</Text>
            <TouchableOpacity onPress={openStatusModal}>
              <Text style={{ color: '#52525b', fontSize: 11, fontWeight: '700' }}>EDIT</Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: 14 }}>
            {currentStatus
              ? <Text style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 22, fontStyle: 'italic' }}>"{currentStatus}"</Text>
              : <Text style={{ color: '#3f3f46', fontSize: 13, fontStyle: 'italic' }}>No status set yet.</Text>
            }
            <TouchableOpacity
              onPress={openStatusModal}
              style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <View style={{ flex: 1, backgroundColor: '#0a0a0f', borderRadius: 10, borderWidth: 1, borderColor: '#1e1e2e', paddingHorizontal: 12, paddingVertical: 9 }}>
                <Text style={{ color: '#3f3f46', fontSize: 13 }}>Update your status...</Text>
              </View>
              <TouchableOpacity
                onPress={() => setStatusModal(true)}
                style={{ backgroundColor: '#6366f1', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>POST</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        </View>

        {/* Personal Info */}
        <View style={{ marginHorizontal: 20, marginBottom: 16, backgroundColor: '#13131a', borderRadius: 16, borderWidth: 1, borderColor: '#1e1e2e', overflow: 'hidden' }}>
          <Text style={{ color: '#6366f1', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1e1e2e' }}>
            PERSONAL INFO
          </Text>
          {[
            { label: 'Email',   value: user?.email },
            { label: 'Role',    value: user?.role === 'admin' ? '🛡️ Admin' : '👤 User' },
            { label: 'Account', value: user?.is_active ? '🟢 Active' : '🔴 Inactive' },
            { label: 'Posts',   value: String(posts.length) },
          ].map(row => (
            <View key={row.label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e1e2e' }}>
              <Text style={{ color: '#52525b', fontSize: 13, fontWeight: '600' }}>{row.label}</Text>
              <Text style={{ color: '#e2e8f0', fontSize: 13, fontWeight: '700', flexShrink: 1, textAlign: 'right' }}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* My Posts */}
        <View style={{ marginHorizontal: 20, marginBottom: 28 }}>
          <Text style={{ color: '#52525b', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 }}>
            MY POSTS ({posts.length})
          </Text>
          {posts.length === 0 ? (
            <View style={{ alignItems: 'center', padding: 32, backgroundColor: '#13131a', borderRadius: 16, borderWidth: 1, borderColor: '#1e1e2e' }}>
              <Text style={{ fontSize: 36, marginBottom: 8 }}>✏️</Text>
              <Text style={{ color: '#e2e8f0', fontWeight: '700', fontSize: 15 }}>No posts yet</Text>
              <Text style={{ color: '#3f3f46', fontSize: 13, marginTop: 4 }}>Go to the Feed tab to create one!</Text>
            </View>
          ) : (
            posts.map(p => (
              <View key={p.post_id} style={{ backgroundColor: '#13131a', borderRadius: 16, marginBottom: 14, borderWidth: 1, borderColor: '#1e1e2e', overflow: 'hidden' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 6 }}>
                  <Text style={{ color: '#52525b', fontSize: 11, fontWeight: '600' }}>{timeAgo(p.created_at)}</Text>
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
                </View>

                <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
                  <Text style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 22 }}>{p.content}</Text>
                </View>

                {getFullImageUrl(p.image_url) ? (
                  <Image source={{ uri: getFullImageUrl(p.image_url)! }} style={{ width: '100%', height: 200, backgroundColor: '#0a0a0f' }} resizeMode="cover" />
                ) : null}
              </View>
            ))
          )}
        </View>

      </ScrollView>

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
                <Avatar name={user?.name ?? 'User'} uri={user?.profile_picture} size={40} />
                <View>
                  <Text style={{ color: '#e2e8f0', fontWeight: '700', fontSize: 14 }}>{user?.name}</Text>
                  <Text style={{ color: '#6366f1', fontSize: 11, fontWeight: '600' }}>@{user?.username}</Text>
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
    </View>
  );
}