import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getBaseUrl = () => {
  if (Platform.OS === 'web') {
    return 'http://localhost:8000/api';
  }
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoClient?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1' && /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      return `http://${host}:8000/api`;
    }
  }
  return 'http://192.168.0.25:8000/api';
};

const API = axios.create({
  baseURL: getBaseUrl(),
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  timeout: 10000,
});

API.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const getFullImageUrl = (pathOrUrl) => {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://') || pathOrUrl.startsWith('blob:') || pathOrUrl.startsWith('data:')) {
    return pathOrUrl;
  }
  const base = getBaseUrl().replace('/api', '');
  return `${base}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
};

// ─── Token ────────────────────────────────────────────────
export const saveToken  = async (token) => AsyncStorage.setItem('auth_token', token);
export const clearToken = async ()      => AsyncStorage.removeItem('auth_token');
export const getToken   = async ()      => AsyncStorage.getItem('auth_token');

// ─── Auth ─────────────────────────────────────────────────
export const register       = async (d) => (await API.post('/register', d)).data;
export const login          = async (d) => (await API.post('/login', d)).data;
export const logout         = async ()  => (await API.post('/logout')).data;
export const getUser        = async ()  => (await API.get('/user')).data;
export const forgotPassword = async (d) => (await API.post('/forgot-password', d)).data;
export const resetPassword  = async (d) => (await API.post('/reset-password', d)).data;

// ─── Profile ──────────────────────────────────────────────
export const uploadProfilePicture = async (uri, base64) => {
  if (Platform.OS === 'web') {
    try {
      const form = new FormData();
      if (uri.startsWith('blob:') || uri.startsWith('http') || uri.startsWith('data:')) {
        const response = await fetch(uri);
        const blob = await response.blob();
        form.append('profile_picture', blob, 'avatar.jpg');
        return (await API.post('/user/profile-picture', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })).data;
      }
    } catch {
      // Fallback to base64 if fetch fails
    }
    if (base64) {
      return (await API.post('/user/profile-picture', {
        profile_picture: `data:image/jpeg;base64,${base64}`,
      })).data;
    }
  }

  // Native / general fallback
  const filename = uri.split('/').pop() || 'photo.jpg';
  const ext      = filename.split('.').pop()?.toLowerCase() || 'jpg';
  const form     = new FormData();
  form.append('profile_picture', {
    uri,
    name: filename,
    type: `image/${ext === 'png' ? 'png' : 'jpeg'}`,
  });
  return (await API.post('/user/profile-picture', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })).data;
};

export const updateProfile = async (d) => (await API.put('/user/profile', d)).data;
export const getUserProfile = async (id) => (await API.get(`/users/${id}`)).data;
export const searchUsers = async (search = '') => (await API.get('/users', { params: { search } })).data;

// ─── Posts ────────────────────────────────────────────────
// Returns paginated: { data: Post[], next_page_url: string|null, ... }
export const getPosts   = async (page = 1) => (await API.get(`/posts?page=${page}`)).data;
export const getPost    = async (id)       => (await API.get(`/posts/${id}`)).data;
export const createPost = async (d)        => {
  const isFormData = typeof FormData !== 'undefined' && d instanceof FormData;
  return (await API.post('/posts', d, isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {})).data;
};
export const updatePost = async (id, d) => {
  const isFormData = typeof FormData !== 'undefined' && d instanceof FormData;
  if (isFormData) {
    return (await API.post(`/posts/${id}?_method=PUT`, d, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
  }
  return (await API.put(`/posts/${id}`, d)).data;
};
export const deletePost = async (id)       => (await API.delete(`/posts/${id}`)).data;

// ─── Likes ────────────────────────────────────────────────
// Returns { liked: bool, likes_count: number, post_id: number }
export const toggleLike = async (postId) => (await API.post(`/posts/${postId}/like`)).data;

// ─── Comments ─────────────────────────────────────────────
// Returns array of comments
export const getComments   = async (postId)      => (await API.get(`/posts/${postId}/comments`)).data;
// Returns { message, comment }
export const createComment = async (postId, d)   => (await API.post(`/posts/${postId}/comments`, d)).data;
// Returns { message, comment }  — owner only
export const updateComment = async (id, d)       => (await API.put(`/comments/${id}`, d)).data;
// Returns { message }  — owner only
export const deleteComment = async (id)          => (await API.delete(`/comments/${id}`)).data;

// ─── Friends & Requests ───────────────────────────────────
export const getFriendRequests   = async ()            => (await API.get('/friend-requests')).data;
export const sendFriendRequest   = async (receiverId)  => (await API.post('/friend-requests', { receiver_id: receiverId })).data;
export const acceptFriendRequest = async (id)          => (await API.put(`/friend-requests/${id}/accept`)).data;
export const rejectFriendRequest = async (id)          => (await API.put(`/friend-requests/${id}/reject`)).data;
export const getFriends          = async ()            => (await API.get('/friends')).data;
export const unfriend            = async (friendId)    => (await API.delete(`/friends/${friendId}`)).data;

// ─── Chat / Messages ──────────────────────────────────────
export const getConversations = async () => (await API.get('/conversations')).data;
export const getMessages      = async (userId) => (await API.get(`/messages/${userId}`)).data;
export const sendMessage      = async (userId, d) => (await API.post(`/messages/${userId}`, d)).data;

// ─── Notifications ────────────────────────────────────────
export const getNotifications        = async (page = 1) => (await API.get(`/notifications?page=${page}`)).data;
export const getUnreadNotifCount     = async ()          => (await API.get('/notifications/unread-count')).data;
export const markNotificationRead    = async (id)        => (await API.put(`/notifications/${id}/read`)).data;
export const markAllNotificationsRead= async ()          => (await API.put('/notifications/mark-all-read')).data;
export const deleteNotification      = async (id)        => (await API.delete(`/notifications/${id}`)).data;
export const clearAllNotifications   = async ()          => (await API.delete('/notifications')).data;

// ─── Admin ────────────────────────────────────────────────
export const adminGetStats     = async ()                 => (await API.get('/admin/stats')).data;
export const adminGetUsers     = async (page = 1, q = '') => (await API.get('/admin/users', { params: { page, search: q } })).data;
export const adminBanUser      = async (id)               => (await API.put(`/admin/users/${id}/ban`)).data;
export const adminActivateUser = async (id)               => (await API.put(`/admin/users/${id}/activate`)).data;
export const adminDeletePost   = async (id)               => (await API.delete(`/admin/posts/${id}`)).data;
export const adminGetLogs      = async (page = 1)         => (await API.get('/admin/logs', { params: { page } })).data;

export default API;