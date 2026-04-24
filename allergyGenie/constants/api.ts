import Constants from 'expo-constants';
import { Platform } from 'react-native';

const FALLBACK_MOBILE_HOST = '192.168.1.10';

function extractHost(hostUri?: string): string | null {
  if (!hostUri) return null;
  const trimmed = hostUri.trim();
  if (!trimmed) return null;
  return trimmed.split(':')[0] || null;
}

export function getApiBaseUrl(): string {
  if (Platform.OS === 'web') return 'http://localhost:8000';

  const expoHost =
    extractHost((Constants as any)?.expoConfig?.hostUri) ||
    extractHost((Constants as any)?.manifest2?.extra?.expoClient?.hostUri) ||
    extractHost((Constants as any)?.manifest?.debuggerHost);

  const mobileHost = expoHost || FALLBACK_MOBILE_HOST;
  return `http://${mobileHost}:8000`;
}
