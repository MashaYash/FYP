import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import RegisterForm from '../components/auth/register-form';
import { showAlert } from '../components/utils/showAlert';
import { Link, router } from 'expo-router';
import { C, R, S } from '../constants/theme';
import { getApiBaseUrl } from '../constants/api';
import { NotificationPopup } from '@/components/ui/notification-popup';

export default function RegisterScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const [registrationComplete, setRegistrationComplete] = React.useState(false);

  const handleRegister = async (data: {
    firstName: string;
    surname: string;
    email: string;
    password: string;
  }) => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: data.firstName,
          last_name: data.surname,
          email: data.email,
          password: data.password,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.detail || result?.message || 'Registration failed');
      }
      setRegistrationComplete(true);
    } catch (error: any) {
      showAlert('Error', error.message);
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
            Join Thousands Managing{`\n`}Allergies Smarter
          </Text>
          <Text style={styles.heroSub}>
            Create your free account and start understanding your allergy profile today.
          </Text>
          <View style={styles.featureList}>
            {[
              'Free report analysis with OCR',
              'Personalised cross-allergen mapping',
              'AI assistant for daily food safety',
              'Your data stays private and secure',
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
          <Text style={styles.formHeading}>Create account</Text>
          <Text style={styles.formSub}>Start your allergy-safe journey today.</Text>

          <RegisterForm onSubmit={handleRegister} />

          <View style={styles.linkRow}>
            <Text style={styles.linkLabel}>Already have an account? </Text>
            <Link href="/login" asChild>
              <Pressable>
                <Text style={styles.linkText}>Sign in here</Text>
              </Pressable>
            </Link>
          </View>
        </View>

      </View>
    </ScrollView>
    <NotificationPopup
      visible={registrationComplete}
      title="Registration successful"
      message="Your AllergyGenie account is ready. You can now sign in."
      buttonLabel="Go to login"
      onClose={() => {
        setRegistrationComplete(false);
        router.replace('/login');
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

  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: S.md },
  linkLabel: { fontSize: 14, color: C.slateLight },
  linkText: { fontSize: 14, fontWeight: '700', color: C.teal },
});
