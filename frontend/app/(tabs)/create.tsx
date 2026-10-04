import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator, ScrollView, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { createPost } from '../../api/axios';

export default function CreatePostScreen() {
  const { user } = useAuth();
  const router   = useRouter();

  const [content, setContent]             = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedBase64, setSelectedBase64] = useState<string | null>(null);
  const [imageUrl, setImageUrl]           = useState('');
  const [loading, setLoading]             = useState(false);

  const charLimit = 500;

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow access to your photos to upload an image.');
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
      setSelectedImage(result.assets[0].uri);
      setSelectedBase64(result.assets[0].base64 ?? null);
      setImageUrl(''); // Clear manual URL if photo selected
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow camera access to take a photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
      aspect: [16, 9],
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
      setSelectedBase64(result.assets[0].base64 ?? null);
      setImageUrl('');
    }
  };

  const onSubmit = async () => {
    if (!content.trim()) {
      Alert.alert('Empty post', 'Write something first!');
      return;
    }
    setLoading(true);
    try {
      if (selectedImage) {
        if (Platform.OS === 'web') {
          let posted = false;
          try {
            const form = new FormData();
            form.append('content', content.trim());
            const resp = await fetch(selectedImage);
            const blob = await resp.blob();
            form.append('image', blob, 'post.jpg');
            await createPost(form);
            posted = true;
          } catch {}

          if (!posted && selectedBase64) {
            await createPost({
              content: content.trim(),
              image: `data:image/jpeg;base64,${selectedBase64}`,
            });
            posted = true;
          }
          if (!posted) throw new Error('Could not upload image on web.');
        } else {
          // Send multipart form-data with file
          const form = new FormData();
          form.append('content', content.trim());
          const filename = selectedImage.split('/').pop() || 'post.jpg';
          const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
          form.append('image', {
            uri: selectedImage,
            name: filename,
            type: `image/${ext === 'png' ? 'png' : 'jpeg'}`,
          } as any);

          await createPost(form);
        }
      } else {
        // Send JSON with optional URL
        await createPost({
          content: content.trim(),
          image_url: imageUrl.trim() || undefined,
        });
      }

      Alert.alert('Posted! 🎉', 'Your post is now live.', [
        {
          text: 'OK',
          onPress: () => {
            setContent('');
            setSelectedImage(null);
            setSelectedBase64(null);
            setImageUrl('');
            router.replace('/(tabs)');
          },
        },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to post. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const initials = user?.name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0a0a0f' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={{ paddingTop: 56, paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#1e1e2e' }}>
          <Text style={{ color: '#6366f1', fontSize: 10, fontWeight: '800', letterSpacing: 2.5 }}>STIBOOK</Text>
          <Text style={{ color: '#e2e8f0', fontSize: 22, fontWeight: '900', marginTop: 2 }}>Create Post</Text>
        </View>

        <View style={{ padding: 20 }}>

          {/* User row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            {user?.profile_picture ? (
              <Image source={{ uri: user.profile_picture }} style={{ width: 44, height: 44, borderRadius: 14 }} />
            ) : (
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#312e81', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#c7d2fe', fontWeight: '800', fontSize: 16 }}>{initials}</Text>
              </View>
            )}
            <View>
              <Text style={{ color: '#e2e8f0', fontWeight: '700', fontSize: 15 }}>{user?.name}</Text>
              <Text style={{ color: '#52525b', fontSize: 12 }}>@{user?.username}</Text>
            </View>
          </View>

          {/* Content */}
          <TextInput
            value={content}
            onChangeText={t => t.length <= charLimit && setContent(t)}
            placeholder="What's happening on campus?"
            placeholderTextColor="#3f3f46"
            multiline
            style={{
              color: '#e2e8f0', fontSize: 16, lineHeight: 24, minHeight: 140,
              textAlignVertical: 'top', backgroundColor: '#13131a', borderRadius: 16,
              borderWidth: 1, borderColor: content.length > 0 ? '#4f46e5' : '#1e1e2e',
              padding: 16, marginBottom: 8,
            }}
          />
          <Text style={{ color: content.length > charLimit * 0.8 ? '#f97316' : '#3f3f46', fontSize: 11, textAlign: 'right', marginBottom: 16 }}>
            {content.length}/{charLimit}
          </Text>

          {/* Image Preview if selected */}
          {selectedImage && (
            <View style={{ position: 'relative', marginBottom: 20, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#312e81' }}>
              <Image source={{ uri: selectedImage }} style={{ width: '100%', height: 200 }} resizeMode="cover" />
              <TouchableOpacity
                onPress={() => setSelectedImage(null)}
                style={{
                  position: 'absolute', top: 12, right: 12, width: 32, height: 32,
                  borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.7)',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Photo attach action buttons */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            <TouchableOpacity
              onPress={pickImage}
              style={{
                flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                backgroundColor: '#13131a', borderRadius: 14, paddingVertical: 14,
                borderWidth: 1, borderColor: '#1e1e2e',
              }}
            >
              <Text style={{ fontSize: 18 }}>🖼️</Text>
              <Text style={{ color: '#a5b4fc', fontWeight: '700', fontSize: 13 }}>
                {selectedImage ? 'Change Photo' : 'Add Photo'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={takePhoto}
              style={{
                flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                backgroundColor: '#13131a', borderRadius: 14, paddingVertical: 14,
                borderWidth: 1, borderColor: '#1e1e2e',
              }}
            >
              <Text style={{ fontSize: 18 }}>📸</Text>
              <Text style={{ color: '#a5b4fc', fontWeight: '700', fontSize: 13 }}>Camera</Text>
            </TouchableOpacity>
          </View>

          {/* Image URL fallback (only when no local image picked) */}
          {!selectedImage && (
            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: '#52525b', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 }}>
                OR PASTE IMAGE URL
              </Text>
              <TextInput
                value={imageUrl}
                onChangeText={setImageUrl}
                placeholder="https://example.com/photo.jpg"
                placeholderTextColor="#3f3f46"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={{
                  color: '#e2e8f0', fontSize: 14, backgroundColor: '#13131a',
                  borderRadius: 14, borderWidth: 1, borderColor: '#1e1e2e',
                  paddingHorizontal: 14, paddingVertical: 12,
                }}
              />
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            onPress={onSubmit}
            disabled={loading || !content.trim()}
            style={{
              backgroundColor: content.trim() ? '#6366f1' : '#1e1e2e',
              borderRadius: 16, paddingVertical: 16, alignItems: 'center',
              shadowColor: '#6366f1', shadowOpacity: content.trim() ? 0.4 : 0,
              shadowRadius: 16, elevation: 8,
            }}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: content.trim() ? '#fff' : '#3f3f46', fontWeight: '800', fontSize: 15 }}>Publish Post</Text>
            }
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}