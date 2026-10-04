import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  ActivityIndicator, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { getMessages, sendMessage, getFullImageUrl } from '../../api/axios';

function Avatar({ name, uri, size = 32 }: { name: string; uri?: string | null; size?: number }) {
  const init = name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const full = getFullImageUrl(uri);
  if (full) return <Image source={{ uri: full }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#312e81', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#c7d2fe', fontWeight: '800', fontSize: size * 0.33 }}>{init}</Text>
    </View>
  );
}

type Message = {
  id: number; body: string; sender_id: number;
  created_at: string; sender?: { name: string; profile_picture: string | null };
};

export default function ChatScreen() {
  const { id, name, avatar } = useLocalSearchParams<{ id: string; name: string; avatar?: string }>();
  const { user }     = useAuth();
  const router       = useRouter();
  const flatRef      = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText]         = useState('');
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await getMessages(id);
        setMessages(data ?? []);
      } catch {} finally { setLoading(false); }
    })();

    // Poll every 3 seconds for new messages
    const interval = setInterval(async () => {
      try {
        const data = await getMessages(id);
        if (Array.isArray(data)) setMessages(data);
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    if (messages.length > 0) flatRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const onSend = async () => {
    if (!text.trim()) return;
    const draft = text.trim();
    setText('');
    setSending(true);
    try {
      const res = await sendMessage(id, { body: draft });
      const newMsg = res?.message || res;
      setMessages(prev => [...prev, newMsg]);
    } catch {} finally { setSending(false); }
  };

  const renderMsg = ({ item }: { item: Message }) => {
    const isMine = item.sender_id === user?.id;
    return (
      <View style={{ flexDirection: isMine ? 'row-reverse' : 'row', gap: 8, marginBottom: 12, paddingHorizontal: 14 }}>
        {!isMine && <Avatar name={name ?? '?'} uri={item.sender?.profile_picture || avatar} size={30} />}
        <View style={{
          maxWidth: '74%', backgroundColor: isMine ? '#4f46e5' : '#13131a',
          borderRadius: 18, borderBottomRightRadius: isMine ? 4 : 18,
          borderBottomLeftRadius: isMine ? 18 : 4,
          paddingHorizontal: 14, paddingVertical: 10,
          borderWidth: isMine ? 0 : 1, borderColor: '#1e1e2e',
        }}>
          <Text style={{ color: isMine ? '#fff' : '#e2e8f0', fontSize: 14, lineHeight: 20 }}>{item.body}</Text>
          {item.created_at ? (
            <Text style={{
              color: isMine ? 'rgba(255,255,255,0.7)' : '#52525b',
              fontSize: 10,
              alignSelf: isMine ? 'flex-end' : 'flex-start',
              marginTop: 4,
            }}>
              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0f' }}>
      {/* Header */}
      <View style={{ paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16, backgroundColor: '#0f0f14', borderBottomWidth: 1, borderBottomColor: '#1e1e2e', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#1e1e2e', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#e2e8f0', fontSize: 18 }}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push(`/user/${id}` as any)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}
        >
          <Avatar name={name ?? '?'} uri={avatar} size={38} />
          <View>
            <Text style={{ color: '#e2e8f0', fontWeight: '800', fontSize: 15 }}>{name}</Text>
            <Text style={{ color: '#6366f1', fontSize: 11, fontWeight: '600' }}>Tap to view profile</Text>
          </View>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#6366f1" size="large" />
        </View>
      ) : (
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={m => String(m.id)}
          renderItem={renderMsg}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 8 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>👋</Text>
              <Text style={{ color: '#e2e8f0', fontWeight: '700', fontSize: 16 }}>Say hi to {name}!</Text>
              <Text style={{ color: '#3f3f46', fontSize: 13, marginTop: 4 }}>This is the start of your conversation.</Text>
            </View>
          }
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      {/* Input bar */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ flexDirection: 'row', gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: '#1e1e2e', alignItems: 'flex-end', backgroundColor: '#0f0f14' }}>
          <View style={{ flex: 1, backgroundColor: '#13131a', borderRadius: 20, borderWidth: 1, borderColor: '#1e1e2e', paddingHorizontal: 16, paddingVertical: 10, maxHeight: 100 }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={`Message ${name}...`}
              placeholderTextColor="#3f3f46"
              multiline
              style={{ color: '#e2e8f0', fontSize: 14 }}
            />
          </View>
          <TouchableOpacity
            onPress={onSend}
            disabled={sending || !text.trim()}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: text.trim() ? '#6366f1' : '#1e1e2e', alignItems: 'center', justifyContent: 'center' }}
          >
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={{ fontSize: 18 }}>➤</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}