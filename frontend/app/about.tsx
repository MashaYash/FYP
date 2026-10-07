import { Animated, ScrollView, StyleSheet, View, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';

import { AppHeader } from '@/components/app-header';
import { C, R, S } from '@/constants/theme';
import { usePageTransition } from '@/hooks/use-page-transition';

const FEATURES = [
  {
    icon: '01',
    title: 'Report Analyser',
    desc:  'Extracts meaningful allergy findings from uploaded skin-prick test reports using OCR and AI.',
    href:  '/front',
  },
  {
    icon: '02',
    title: 'Cross Allergen Detector',
    desc:  'Identifies likely cross-reactive food risks and patterns based on your personal allergen profile.',
    href:  '/crossAllergen',
  },
  {
    icon: '03',
    title: 'AI Assistant',
    desc:  'Provides user-friendly, safety-focused guidance and Q&A to help you navigate daily life.',
    href:  '/chatbot',
  },
];

const TEAM_VALUES = [
  { title: 'Accuracy',    desc: 'AI-driven analysis grounded in clinical allergy science.' },
  { title: 'Safety',      desc: 'Every recommendation is designed with your safety first.' },
  { title: 'Simplicity',  desc: 'Complex medical data presented in plain, actionable language.' },
  { title: 'Privacy',     desc: 'Your health data stays private and is never sold.' },
];

export default function AboutScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < 900;
  const { opacity, translateY } = usePageTransition();

  return (
    <Animated.View style={{ flex: 1, opacity, transform: [{ translateY }] }}>
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageContent}
      showsVerticalScrollIndicator={false}
    >
      <AppHeader activeTab="about" />

      {/* ── Hero banner ── */}
      <View style={[styles.hero, isCompact && styles.heroSm]}>
        <Text style={[styles.heroEyebrow]}>About AllergyGenie AI</Text>
        <Text style={[styles.heroTitle, isCompact && styles.heroTitleSm]}>
          Building Safer Daily Food{'\n'}Decisions with AI
        </Text>
        <Text style={[styles.heroSub, isCompact && styles.heroSubSm]}>
          AllergyGenie AI combines report analysis, cross-allergen detection, and a guided assistant
          experience to help you understand allergy risk clearly and act safely in real life.
        </Text>
        <TouchableOpacity
          style={styles.heroCta}
          onPress={() => router.push('/front')}
          accessibilityRole="button"
        >
          <Text style={styles.heroCtaText}>Get Started →</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.body, isCompact && styles.bodySm]}>

        {/* ── Mission ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Our Mission</Text>
          <Text style={[styles.sectionTitle, isCompact && styles.sectionTitleSm]}>
            Empowering people to live allergy-safe lives
          </Text>
          <Text style={styles.sectionBody}>
            Millions of people worldwide live with food allergies — yet understanding allergy test results
            and avoiding hidden cross-reactive foods remains genuinely difficult. AllergyGenie AI was built
            to change that, putting hospital-grade analysis in the palm of your hand.
          </Text>
        </View>

        {/* ── What we do ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>What We Do</Text>
          <Text style={[styles.sectionTitle, isCompact && styles.sectionTitleSm]}>
            Three powerful tools, one platform
          </Text>
          <View style={[styles.featureGrid, isCompact && styles.featureGridSm]}>
            {FEATURES.map(f => (
              <TouchableOpacity
                key={f.href}
                style={styles.featureCard}
                onPress={() => router.push(f.href as any)}
                accessibilityRole="button"
              >
                <View style={styles.featureIconWrap}>
                  <Text style={styles.featureIconText}>{f.icon}</Text>
                </View>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
                <Text style={styles.featureLink}>Open →</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Values ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Our Values</Text>
          <Text style={[styles.sectionTitle, isCompact && styles.sectionTitleSm]}>
            Built on principles you can trust
          </Text>
          <View style={[styles.valuesGrid, isCompact && styles.valuesGridSm]}>
            {TEAM_VALUES.map(v => (
              <View key={v.title} style={styles.valueCard}>
                <Text style={styles.valueTitle}>{v.title}</Text>
                <Text style={styles.valueDesc}>{v.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Stats strip ── */}
        <View style={styles.statsStrip}>
          {[
            { value: '10,000+', label: 'Reports analysed' },
            { value: '1,000+',  label: 'Daily active users' },
            { value: '98%',     label: 'Accuracy rate' },
            { value: '500+',    label: 'Cross-allergens mapped' },
          ].map(s => (
            <View key={s.label} style={styles.statItem}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* ── CTA ── */}
        <View style={styles.ctaBanner}>
          <Text style={[styles.ctaTitle, isCompact && styles.ctaTitleSm]}>
            Ready to take control?
          </Text>
          <Text style={styles.ctaSub}>
            Upload your first report and get your personalised allergy insights in seconds.
          </Text>
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => router.push('/front')}
            accessibilityRole="button"
          >
            <Text style={styles.ctaBtnText}>Analyse My Report</Text>
          </TouchableOpacity>
        </View>

      </View>
    </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  page:        { flex: 1, backgroundColor: C.bg },
  pageContent: { paddingBottom: 0 },

  // Hero
  hero: {
    backgroundColor: C.teal,
    paddingHorizontal: S.xxl + 8,
    paddingTop: S.xxl + 8,
    paddingBottom: S.xxl + 16,
    gap: S.md,
  },
  heroSm:      { paddingHorizontal: S.lg, paddingTop: S.xl, paddingBottom: S.xxl },
  heroEyebrow: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.78)', textTransform: 'uppercase', letterSpacing: 1.5 },
  heroTitle:   { fontSize: 44, fontWeight: '900', color: C.white, lineHeight: 52 },
  heroTitleSm: { fontSize: 28, lineHeight: 36 },
  heroSub:     { fontSize: 16, color: 'rgba(255,255,255,0.85)', lineHeight: 26, maxWidth: 560 },
  heroSubSm:   { fontSize: 14, lineHeight: 22 },
  heroCta: {
    alignSelf: 'flex-start',
    marginTop: S.sm,
    backgroundColor: C.white,
    paddingHorizontal: S.xl,
    paddingVertical: S.md,
    borderRadius: R.pill,
  },
  heroCtaText: { color: C.tealDark, fontWeight: '800', fontSize: 15 },

  // Body
  body:     { paddingHorizontal: S.xxl + 8, paddingTop: S.xl, gap: S.lg },
  bodySm:   { paddingHorizontal: S.lg, paddingTop: S.lg },

  // Section card
  sectionCard: {
    backgroundColor: C.bgWhite,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.borderCard,
    padding: S.xl,
    gap: S.lg,
    shadowColor: C.black,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: C.teal,
    textTransform: 'uppercase', letterSpacing: 1.5,
  },
  sectionTitle:   { fontSize: 28, fontWeight: '900', color: C.navy, lineHeight: 36 },
  sectionTitleSm: { fontSize: 22, lineHeight: 30 },
  sectionBody:    { fontSize: 15, color: C.slate, lineHeight: 24 },

  // Features
  featureGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: S.md },
  featureGridSm:  { flexDirection: 'column' },
  featureCard: {
    flex: 1, minWidth: 220,
    backgroundColor: C.bg,
    borderRadius: R.md,
    borderWidth: 1, borderColor: C.border,
    padding: S.lg, gap: S.sm,
  },
  featureIconWrap: { width: 36, height: 36, borderRadius: 8, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' },
  featureIconText: { color: C.white, fontWeight: '900', fontSize: 12 },
  featureTitle: { fontSize: 17, fontWeight: '800', color: C.navy },
  featureDesc:  { fontSize: 14, color: C.slate, lineHeight: 21, flex: 1 },
  featureLink:  { fontSize: 13, fontWeight: '700', color: C.teal, marginTop: S.xs },

  // Values
  valuesGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: S.md },
  valuesGridSm: { flexDirection: 'column' },
  valueCard: {
    flex: 1, minWidth: 160,
    backgroundColor: C.tealLight,
    borderRadius: R.md,
    borderWidth: 1, borderColor: C.tealMid,
    padding: S.lg, gap: S.xs,
    alignItems: 'flex-start',
  },
  valueTitle: { fontSize: 15, fontWeight: '800', color: C.navy },
  valueDesc:  { fontSize: 13, color: C.slate, lineHeight: 20 },

  // Stats
  statsStrip: {
    backgroundColor: C.statBg,
    borderRadius: R.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: S.xl,
    gap: S.xl,
    justifyContent: 'space-around',
  },
  statItem:  { alignItems: 'center', gap: S.xs },
  statValue: { fontSize: 30, fontWeight: '900', color: C.white },
  statLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },

  // CTA banner
  ctaBanner: {
    backgroundColor: C.tealDark,
    borderRadius: R.lg,
    padding: S.xxl,
    alignItems: 'center',
    gap: S.md,
    marginBottom: S.xxl,
  },
  ctaTitle:   { fontSize: 28, fontWeight: '900', color: C.white, textAlign: 'center' },
  ctaTitleSm: { fontSize: 22 },
  ctaSub:     { fontSize: 15, color: 'rgba(255,255,255,0.78)', textAlign: 'center', lineHeight: 23, maxWidth: 440 },
  ctaBtn: {
    marginTop: S.sm,
    backgroundColor: C.white,
    paddingHorizontal: S.xxl,
    paddingVertical: S.md,
    borderRadius: R.pill,
  },
  ctaBtnText: { color: C.tealDark, fontWeight: '800', fontSize: 15 },
});
