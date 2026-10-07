import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Link, router } from 'expo-router';
import LoginForm from '../components/auth/login-form';
import { Storage, UserStorage } from '../components/utils/storage';
import { C, R, S } from '../constants/theme';
import { getApiBaseUrl } from '../constants/api';
import { NotificationPopup } from '@/components/ui/notification-popup';

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loginComplete, setLoginComplete] = useState(false);
  const { width } = useWindowDimensions();
  const isCompact = width < 768;

  const handleLogin = async (data: { email: string; password: string }) => {
    setLoading(true);
    setErrorMessage('');
    try {
      const response = await fetch(`${getApiBaseUrl()}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || result.message || 'Login failed');
      await Storage.setToken(result.access_token);
      await UserStorage.setUser(result.user);
      setLoginComplete(true);
    } catch (error: any) {
      const message = String(error?.message || 'Login failed. Please try again.');
      setErrorMessage(/invalid email or password/i.test(message)
        ? 'Invalid email or password. Use the email address registered to your account.'
        : message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.pageContent, isCompact && styles.pageContentSm]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.layout, isCompact && styles.layoutSm]}>

        {/* Left hero panel */}
        <View style={[styles.heroPanel, isCompact && styles.heroPanelSm]}>
          <View style={styles.logoBadge}>
            <View style={styles.logoMark}>
              <View style={styles.logoV} />
              <View style={styles.logoH} />
            </View>
            <Text style={styles.logoText}>AllergyGenie</Text>
            <Text style={styles.logoAi}> AI</Text>
          </View>
          <Text style={[styles.heroTitle, isCompact && styles.heroTitleSm]}>
            Allergy-Safe Living,{`\n`}Powered by AI
          </Text>
          <Text style={styles.heroSub}>
            Upload your allergy test report, detect hidden cross-reactive foods, and get
            personalised daily food guidance through an intelligent assistant.
          </Text>
          <View style={styles.featureList}>
            {[
              'Instant report analysis with OCR',
              'Cross-allergen detection and mapping',
              'AI-powered food safety assistant',
              'Private and secure health data',
            ].map(item => (
              <View key={item} style={styles.featureItem}>
                <View style={styles.featureDot} />
                <Text style={styles.featureText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Right form card */}
        <View style={[styles.formCard, isCompact && styles.formCardSm]}>
          <Text style={styles.formHeading}>Welcome back</Text>
          <Text style={styles.formSub}>Sign in to your AllergyGenie account.</Text>

          <LoginForm onSubmit={handleLogin} />

          {loading && <ActivityIndicator size="large" color={C.teal} style={styles.spinner} />}

          {errorMessage !== '' && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <View style={styles.linkRow}>
            <Text style={styles.linkLabel}>Don't have an account? </Text>
            <Link href="/register" asChild>
              <Pressable>
                <Text style={styles.linkText}>Create one here</Text>
              </Pressable>
            </Link>
          </View>
        </View>

      </View>
    </ScrollView>
    <NotificationPopup
      visible={loginComplete}
      title="Welcome back"
      message="You’re signed in successfully."
      buttonLabel="Continue"
      onClose={() => {
        setLoginComplete(false);
        router.replace('/home');
      }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  pageContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: S.xxl,
    paddingHorizontal: S.xl,
  },
  pageContentSm: { paddingHorizontal: S.lg, paddingVertical: S.xl },

  layout: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 960,
    borderRadius: R.xl,
    overflow: 'hidden',
    shadowColor: C.black, shadowOpacity: 0.1, shadowRadius: 24,
    elevation: 8,
  },
  layoutSm: { flexDirection: 'column' },

  // Hero panel
  heroPanel: {
    flex: 1,
    backgroundColor: C.teal,
    padding: S.xxl + S.lg,
    gap: S.lg,
    justifyContent: 'center',
  },
  heroPanelSm: { padding: S.xl },

  logoBadge: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: S.md },
  logoMark: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoV: { position: 'absolute', width: 5, height: 15, borderRadius: 3, backgroundColor: C.white },
  logoH: { width: 15, height: 5, borderRadius: 3, backgroundColor: C.white },
  logoText: { fontSize: 20, fontWeight: '800', color: C.white },
  logoAi: { fontSize: 20, fontWeight: '800', color: 'rgba(255,255,255,0.75)' },

  heroTitle: { fontSize: 32, fontWeight: '900', color: C.white, lineHeight: 40 },
  heroTitleSm: { fontSize: 26, lineHeight: 34 },
  heroSub: { fontSize: 15, color: 'rgba(255,255,255,0.85)', lineHeight: 24 },

  featureList: { gap: S.sm, marginTop: S.sm },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  featureDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.75)' },
  featureText: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '500', flex: 1 },

  // Form card
  formCard: {
    flex: 1,
    backgroundColor: C.bgWhite,
    padding: S.xxl + S.lg,
    justifyContent: 'center',
    gap: S.md,
  },
  formCardSm: { padding: S.xl },

  formHeading: { fontSize: 26, fontWeight: '900', color: C.navy, marginBottom: S.xs },
  formSub: { fontSize: 14, color: C.slateLight, marginBottom: S.md },

  spinner: { marginTop: S.sm },

  errorBox: {
    backgroundColor: C.dangerBg,
    borderRadius: R.md,
    borderWidth: 1, borderColor: C.dangerBorder,
    padding: S.md, marginTop: S.sm,
  },
  errorText: { color: C.danger, fontWeight: '600', fontSize: 14 },

  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: S.md },
  linkLabel: { fontSize: 14, color: C.slateLight },
  linkText: { fontSize: 14, fontWeight: '700', color: C.teal },
});
