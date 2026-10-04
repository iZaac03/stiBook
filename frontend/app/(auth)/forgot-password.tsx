import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { forgotPassword } from '../../api/axios';

type Step = 'email' | 'sent';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep]       = useState<Step>('email');

  const onSubmit = async () => {
    if (!email.trim()) { Alert.alert('Enter your email address.'); return; }
    setLoading(true);
    try {
      await forgotPassword({ email: email.trim() });
      setStep('sent');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Could not send reset link. Check the email address.');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0a0a0f' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={{ height: 3, backgroundColor: '#6366f1' }} />

      <View style={{ flex: 1, paddingHorizontal: 28, paddingTop: 60 }}>

        {/* Back */}
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 36 }}>
          <Text style={{ color: '#6366f1', fontSize: 14 }}>← Back to Sign In</Text>
        </TouchableOpacity>

        {/* Logo */}
        <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: '#312e81', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <Text style={{ color: '#c7d2fe', fontSize: 22, fontWeight: '900' }}>S</Text>
        </View>

        {step === 'email' ? (
          <>
            <Text style={{ color: '#f1f5f9', fontSize: 34, fontWeight: '900', lineHeight: 40, marginBottom: 8 }}>
              Reset your{'\n'}password.
            </Text>
            <Text style={{ color: '#52525b', fontSize: 14, marginBottom: 36, lineHeight: 22 }}>
              Enter the email address linked to your account and we'll send you a reset link.
            </Text>

            <Text style={{ color: '#52525b', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 }}>EMAIL ADDRESS</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#3f3f46"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                backgroundColor: '#13131a', borderRadius: 14, borderWidth: 1,
                borderColor: email.length > 0 ? '#4f46e5' : '#1e1e2e',
                paddingHorizontal: 16, paddingVertical: 16, color: '#e2e8f0', fontSize: 15,
                marginBottom: 24,
              }}
            />

            <TouchableOpacity
              onPress={onSubmit}
              disabled={loading || !email.trim()}
              style={{
                backgroundColor: email.trim() ? '#6366f1' : '#1e1e2e',
                borderRadius: 16, paddingVertical: 16, alignItems: 'center',
                shadowColor: '#6366f1', shadowOpacity: email.trim() ? 0.35 : 0, shadowRadius: 14, elevation: 6,
              }}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: email.trim() ? '#fff' : '#3f3f46', fontWeight: '800', fontSize: 15 }}>Send Reset Link</Text>
              }
            </TouchableOpacity>
          </>
        ) : (
          /* ── Success state ── */
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#052e16', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <Text style={{ fontSize: 40 }}>📬</Text>
            </View>
            <Text style={{ color: '#f1f5f9', fontSize: 26, fontWeight: '900', textAlign: 'center', marginBottom: 12 }}>
              Check your inbox!
            </Text>
            <Text style={{ color: '#52525b', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 8 }}>
              We sent a password reset link to
            </Text>
            <Text style={{ color: '#a5b4fc', fontWeight: '700', fontSize: 15, marginBottom: 32 }}>{email}</Text>
            <Text style={{ color: '#3f3f46', fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
              Didn't get it? Check your spam folder or{' '}
            </Text>
            <TouchableOpacity onPress={() => setStep('email')}>
              <Text style={{ color: '#6366f1', fontWeight: '700', fontSize: 13, marginTop: 4 }}>Try a different email</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.replace('/(auth)/login')}
              style={{ marginTop: 36, borderWidth: 1, borderColor: '#1e1e2e', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 40 }}
            >
              <Text style={{ color: '#94a3b8', fontWeight: '700' }}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}