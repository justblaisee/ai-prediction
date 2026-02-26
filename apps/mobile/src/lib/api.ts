import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { AuthPayload, Product, TrainStatus } from '../types';

const baseUrl = (Constants.expoConfig?.extra?.apiUrl as string) || 'http://127.0.0.1:4000';
const API_URL = `${baseUrl}/api`;

const ACCESS_TOKEN_KEY = 'mobile_access_token';
const REFRESH_TOKEN_KEY = 'mobile_refresh_token';

async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

async function request<T>(path: string, init?: RequestInit, withAuth = true): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };

  if (withAuth) {
    const token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 401 && withAuth) {
    const refreshed = await refreshToken();
    if (refreshed) {
      return request<T>(path, init, true);
    }
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function refreshToken(): Promise<boolean> {
  const refresh = await getRefreshToken();
  if (!refresh) return false;

  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh }),
  });

  if (!response.ok) {
    await clearTokens();
    return false;
  }

  const payload = (await response.json()) as { accessToken: string; refreshToken: string };
  await saveTokens(payload.accessToken, payload.refreshToken);
  return true;
}

export const mobileApi = {
  health: () => fetch(`${API_URL}/health`).then((r) => r.json()),
  login: (email: string, password: string) =>
    request<AuthPayload>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
      false
    ),
  me: () => request<{ user: AuthPayload['user']; organization: AuthPayload['organization'] }>('/auth/me'),
  products: () => request<{ products: Product[]; pagination: { total: number } }>('/products?limit=50'),
  train: (productId: string) => request<{ status: string; message: string }>(`/predictions/train/${productId}`, { method: 'POST' }),
  trainStatus: (productId: string) => request<TrainStatus>(`/predictions/train-status/${productId}`),
};
