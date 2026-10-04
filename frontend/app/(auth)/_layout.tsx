import { Stack } from 'expo-router';
import API, { clearToken } from '../../api/axios';
import { useAuth } from '../context/AuthContext';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}