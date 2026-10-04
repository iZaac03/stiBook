import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import '../../global.css';

export default function SignupScreen() {
  const { handleRegister } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({
    name: '', username: '', email: '', password: '', confirmPassword: '',
  });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);

  const update = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const onRegister = async () => {
    const { name, username, email, password, confirmPassword } = form;
    if (!name || !username || !email || !password || !confirmPassword) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await handleRegister(name.trim(), username.trim(), email.trim(), password);
    } catch (err: any) {
      const errors = err?.response?.data;
      if (errors && typeof errors === 'object') {
        const messages = Object.values(errors).flat().join('\n');
        Alert.alert('Registration Failed', messages);
      } else {
        Alert.alert('Registration Failed', 'Something went wrong. Please try again.');
      }
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

        <View className="flex-1 px-8 pt-12 pb-10">

          {/* Back + heading */}
          <TouchableOpacity onPress={() => router.back()} className="mb-6">
            <Text className="text-indigo-400 text-sm">← Back to Sign In</Text>
          </TouchableOpacity>

          <View className="w-14 h-14 rounded-2xl bg-indigo-600 items-center justify-center mb-5">
            <Text className="text-white text-2xl font-bold">S</Text>
          </View>
          <Text className="text-white text-4xl font-bold tracking-tight leading-tight mb-1">
            Join us{'\n'}today.
          </Text>
          <Text className="text-zinc-400 text-base mb-8">Create your account</Text>

          {/* Full Name */}
          <View className="mb-4">
            <Text className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-2">Full Name</Text>
            <TextInput
              className="bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-4 text-base"
              placeholder="John Doe"
              placeholderTextColor="#52525b"
              value={form.name}
              onChangeText={(v) => update('name', v)}
            />
          </View>

          {/* Username */}
          <View className="mb-4">
            <Text className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-2">Username</Text>
            <TextInput
              className="bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-4 text-base"
              placeholder="johndoe"
              placeholderTextColor="#52525b"
              autoCapitalize="none"
              autoCorrect={false}
              value={form.username}
              onChangeText={(v) => update('username', v)}
            />
          </View>

          {/* Email */}
          <View className="mb-4">
            <Text className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-2">Email</Text>
            <TextInput
              className="bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-4 text-base"
              placeholder="you@example.com"
              placeholderTextColor="#52525b"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={form.email}
              onChangeText={(v) => update('email', v)}
            />
          </View>

          {/* Password */}
          <View className="mb-4">
            <Text className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-2">Password</Text>
            <View className="flex-row items-center bg-zinc-900 border border-zinc-800 rounded-xl px-4">
              <TextInput
                className="flex-1 text-white py-4 text-base"
                placeholder="Min. 6 characters"
                placeholderTextColor="#52525b"
                secureTextEntry={!showPass}
                value={form.password}
                onChangeText={(v) => update('password', v)}
              />
              <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                <Text className="text-zinc-500 text-sm">{showPass ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm Password */}
          <View className="mb-8">
            <Text className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-2">Confirm Password</Text>
            <TextInput
              className="bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-4 text-base"
              placeholder="Re-enter password"
              placeholderTextColor="#52525b"
              secureTextEntry={!showPass}
              value={form.confirmPassword}
              onChangeText={(v) => update('confirmPassword', v)}
            />
          </View>

          {/* Register button */}
          <TouchableOpacity
            onPress={onRegister}
            disabled={loading}
            className="bg-indigo-600 rounded-xl py-4 items-center"
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text className="text-white font-bold text-base tracking-wide">Create Account</Text>
            }
          </TouchableOpacity>

          <Text className="text-zinc-600 text-xs text-center mt-8">
            By registering, you agree to our Terms &amp; Privacy Policy.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}