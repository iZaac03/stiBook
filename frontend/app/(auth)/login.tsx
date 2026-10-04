import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import '../../global.css';
export default function LoginScreen() {
  const { handleLogin } = useAuth();
  const router = useRouter();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);

  const onLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await handleLogin(email.trim(), password);
      // RouteGuard in _layout.tsx handles redirect automatically
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Login failed. Please try again.';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-zinc-950"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">

        {/* Top accent bar */}
        <View className="h-1.5 w-full bg-indigo-500" />

        <View className="flex-1 px-8 pt-16 pb-10">

          {/* Logo + heading */}
          <View className="mb-12">
            <View className="w-14 h-14 rounded-2xl bg-indigo-600 items-center justify-center mb-6">
              <Text className="text-white text-2xl font-bold">S</Text>
            </View>
            <Text className="text-white text-4xl font-bold tracking-tight leading-tight">
              Welcome{'\n'}back.
            </Text>
            <Text className="text-zinc-400 text-base mt-2">Sign in to continue</Text>
          </View>

          {/* Email */}
          <View className="mb-4">
            <Text className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-2">
              Email
            </Text>
            <TextInput
              className="bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-4 text-base"
              placeholder="you@example.com"
              placeholderTextColor="#52525b"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {/* Password */}
          <View className="mb-2">
            <Text className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-2">
              Password
            </Text>
            <View className="flex-row items-center bg-zinc-900 border border-zinc-800 rounded-xl px-4">
              <TextInput
                className="flex-1 text-white py-4 text-base"
                placeholder="••••••••"
                placeholderTextColor="#52525b"
                secureTextEntry={!showPass}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                <Text className="text-zinc-500 text-sm">{showPass ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity className="self-end mb-8">
            <Text className="text-indigo-400 text-sm">Forgot password?</Text>
          </TouchableOpacity>

          {/* Sign In button */}
          <TouchableOpacity
            onPress={onLogin}
            disabled={loading}
            className="bg-indigo-600 rounded-xl py-4 items-center"
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text className="text-white font-bold text-base tracking-wide">Sign In</Text>
            }
          </TouchableOpacity>

          {/* Divider */}
          <View className="flex-row items-center my-7">
            <View className="flex-1 h-px bg-zinc-800" />
            <Text className="text-zinc-600 text-xs mx-3">OR</Text>
            <View className="flex-1 h-px bg-zinc-800" />
          </View>

          {/* Go to signup */}
          <TouchableOpacity
            onPress={() => router.push('/(auth)/signup')}
            className="border border-zinc-700 rounded-xl py-4 items-center"
          >
            <Text className="text-zinc-300 font-semibold text-base">Create an account</Text>
          </TouchableOpacity>

          <Text className="text-zinc-600 text-xs text-center mt-10">
            By signing in, you agree to our Terms &amp; Privacy Policy.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}