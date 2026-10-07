import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
  Text,
} from 'react-native';
import { useRouter } from 'expo-router';
import { AppHeader } from '@/components/app-header';

import { C } from '@/constants/theme';

// ─── Stat row data ─────────────────────────────────────────────────────────────
const STATS = [
  { value: '10,000+', label: 'Report analyses', highlight: true },
  { value: '1,000+',  label: 'Users per day' },
  { value: '3x',      label: 'Faster Allergy Insights' },
  { value: '500+',    label: 'Cross-allergens mapped' },
  { value: '98%',     label: 'Accuracy rate' },
];

// ─── Feature cards ─────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: '01',
    title: 'Report Analyser',
    desc:  'Upload your skin-prick test report. Our OCR engine extracts findings and presents structured risk output instantly.',
    cta:   'Open Analyser',
    href:  '/front' as const,
    color: '#e6f7fa',
    border:'#a8dde6',
  },
  {
    icon: '02',
    title: 'Cross Allergen Detector',
    desc:  'Identify hidden cross-reactive foods based on your allergen profile and review detailed risk summaries.',
    cta:   'Open Detector',
    href:  '/crossAllergen' as const,
    color: '#eaf9f4',
    border:'#9de0cc',
  },
  {
    icon: '03',
    title: 'AI Assistant',
    desc:  'Ask personalised allergy questions and get practical daily-life guidance powered by advanced AI.',
    cta:   'Open Assistant',
    href:  '/chatbot' as const,
    color: '#f0f0ff',
    border:'#c4c4f0',
  },
];

// ─── Animated stat counter ─────────────────────────────────────────────────────
function StatCard({ value, label, highlight, delay }: { value: string; label: string; highlight?: boolean; delay: number }) {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 500, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.statCard, highlight && styles.statCardHighlight, { opacity: fade, transform: [{ translateY: slide }] }]}>
      <Text style={[styles.statValue, highlight && styles.statValueHighlight]}>{value}</Text>
      <Text style={[styles.statLabel, highlight && styles.statLabelHighlight]}>{label}</Text>
    </Animated.View>
  );
}

// ─── Feature card ──────────────────────────────────────────────────────────────
function FeatureCard({ item, onPress, delay, isCompact }: { item: typeof FEATURES[0]; onPress: () => void; delay: number; isCompact: boolean }) {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 550, delay, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 550, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.featureCard, isCompact && styles.featureCardCompact, { backgroundColor: item.color, borderColor: item.border, opacity: fade, transform: [{ translateY: slide }] }]}>
      <View style={styles.featureIconNum}><Text style={styles.featureIconNumText}>{item.icon}</Text></View>
      <Text style={[styles.featureTitle, isCompact && styles.featureTitleCompact]}>{item.title}</Text>
      <Text style={[styles.featureDesc, isCompact && styles.featureDescCompact]}>{item.desc}</Text>
      <TouchableOpacity style={styles.featureCta} onPress={onPress} accessibilityRole="button" accessibilityLabel={item.cta}>
        <Text style={styles.featureCtaText}>{item.cta} →</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Home screen ───────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < 900;

  // hero entrance animation
  const heroFade  = useRef(new Animated.Value(0)).current;
  const heroSlide = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroFade,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(heroSlide, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>

      {/* ── NAV BAR ── */}
      <AppHeader activeTab="home" actionLabel="Get Started" actionHref="/front" />

      {/* ── HERO SECTION ── */}
      <View style={[styles.hero, isCompact && styles.heroCompact]}>
        {/* Decorative teal shapes */}
        <View style={styles.shapeBottomLeft} />
        <View style={styles.shapeBottomLeft2} />

        <Animated.View style={[styles.heroLeft, { opacity: heroFade, transform: [{ translateY: heroSlide }] }]}>
          <Text style={[styles.heroTitle, isCompact && styles.heroTitleCompact]}>
            Your AI-Powered Path{'\n'}to Allergy-Safe Living
          </Text>
          <Text style={[styles.heroSub, isCompact && styles.heroSubCompact]}>
            AllergyGenie AI analyzes your skin prick test report, detects hidden cross-allergens, and guides
            your daily food choices through an intelligent chatbot.
          </Text>
          <View style={[styles.heroButtons, isCompact && styles.heroButtonsCompact]}>
            <TouchableOpacity style={styles.getStartedBtn} onPress={() => router.push('/front')} accessibilityRole="button">
              <Text style={styles.getStartedText}>Get Started</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.watchDemoBtn} onPress={() => router.push('/chatbot')} accessibilityRole="button">
              <View style={styles.watchDemoCircle} />
              <Text style={styles.watchDemoText}>Try Assistant</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Hero illustration */}
        <Animated.View style={[styles.heroRight, isCompact && styles.heroRightCompact, { opacity: heroFade }]}>
          <Image
            source={require('../assets/images/background.jpeg')}
            style={styles.heroImage}
            resizeMode="contain"
            accessibilityLabel="AI chatbot assistant illustration"
          />
        </Animated.View>
      </View>

      {/* ── STATS STRIP ── */}
      <View style={styles.statsStrip}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
          {STATS.map((s, i) => (
            <StatCard key={i} {...s} delay={i * 100} />
          ))}
        </ScrollView>
      </View>

      {/* ── FEATURE CARDS ── */}
      <View style={styles.featuresSection}>
        <Text style={[styles.sectionLabel, isCompact && styles.sectionLabelCompact]}>What We Offer</Text>
        <Text style={[styles.sectionTitle, isCompact && styles.sectionTitleCompact]}>
          Everything you need for allergy-safe living
        </Text>
        <View style={[styles.featureGrid, isCompact && styles.featureGridCompact]}>
          {FEATURES.map((f, i) => (
            <FeatureCard
              key={i}
              item={f}
              onPress={() => router.push(f.href)}
              delay={200 + i * 150}
              isCompact={isCompact}
            />
          ))}
        </View>
      </View>

      {/* ── HOW IT WORKS ── */}
      <View style={styles.howSection}>
        <Text style={[styles.sectionLabel, isCompact && styles.sectionLabelCompact]}>Process</Text>
        <Text style={[styles.sectionTitle, isCompact && styles.sectionTitleCompact]}>
          Three steps to allergy clarity
        </Text>
        <View style={[styles.stepsRow, isCompact && styles.stepsRowCompact]}>
          {[
            { n: '1', title: 'Upload Report', desc: 'Take a photo or upload your allergy test PDF.' },
            { n: '2', title: 'AI Analysis',   desc: 'Our engine reads the report and maps your allergen risks.' },
            { n: '3', title: 'Safe Choices',  desc: 'Get food guidance and cross-allergen alerts daily.' },
          ].map((step, i) => (
            <View key={i} style={[styles.stepCard, isCompact && styles.stepCardCompact]}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{step.n}</Text></View>
              <Text style={[styles.stepTitle, isCompact && styles.stepTitleCompact]}>{step.title}</Text>
              <Text style={[styles.stepDesc,  isCompact && styles.stepDescCompact]}>{step.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── BOTTOM CTA BANNER ── */}
      <View style={styles.ctaBanner}>
        <Text style={[styles.ctaBannerTitle, isCompact && styles.ctaBannerTitleCompact]}>
          Ready to take control of your allergies?
        </Text>
        <Text style={styles.ctaBannerSub}>
          Join thousands of users who manage their allergy risks smarter with AllergyGenie AI.
        </Text>
        <TouchableOpacity style={styles.ctaBannerBtn} onPress={() => router.push('/register')} accessibilityRole="button">
          <Text style={styles.ctaBannerBtnText}>Create Free Account</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  // page
  page:        { flex: 1, backgroundColor: C.bg },
  pageContent: { paddingBottom: 0 },

  // ── HERO ──
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.white,
    paddingHorizontal: 56,
    paddingTop: 60,
    paddingBottom: 80,
    minHeight: 440,
    overflow: 'hidden',
    position: 'relative',
  },
  heroCompact: {
    flexDirection: 'column',
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 48,
    alignItems: 'flex-start',
  },

  // decorative teal shapes bottom-left (matching design)
  shapeBottomLeft: {
    position: 'absolute',
    bottom: -30,
    left: -20,
    width: 220,
    height: 120,
    backgroundColor: C.accent,
    opacity: 0.35,
    borderRadius: 12,
    transform: [{ rotate: '-8deg' }],
  },
  shapeBottomLeft2: {
    position: 'absolute',
    bottom: -50,
    left: 40,
    width: 140,
    height: 90,
    backgroundColor: C.tealDark,
    opacity: 0.55,
    borderRadius: 10,
    transform: [{ rotate: '-5deg' }],
  },

  heroLeft:   { flex: 1, maxWidth: 560, gap: 16 },
  heroTitle: {
    fontSize: 48, fontWeight: '900', color: C.navy,
    lineHeight: 58, letterSpacing: -0.5,
  },
  heroTitleCompact: { fontSize: 30, lineHeight: 38 },
  heroSub:    { fontSize: 16, color: C.slate, lineHeight: 26, maxWidth: 480 },
  heroSubCompact: { fontSize: 14, lineHeight: 22 },

  heroButtons:        { flexDirection: 'row', gap: 14, marginTop: 8, alignItems: 'center' },
  heroButtonsCompact: { flexDirection: 'column', alignItems: 'flex-start' },

  getStartedBtn: {
    backgroundColor: C.teal,
    paddingHorizontal: 26, paddingVertical: 14,
    borderRadius: 10,
  },
  getStartedText: { color: C.white, fontWeight: '700', fontSize: 15 },

  watchDemoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  watchDemoCircle: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 2, borderColor: C.slate,
  },
  watchDemoText: { color: C.slate, fontWeight: '600', fontSize: 15 },

  // hero illustration
  heroRight: {
    width: 420,
    height: 420,
    marginLeft: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroRightCompact: { width: '100%', height: 280, marginLeft: 0, marginTop: 20 },
  heroImage: {
    width: '100%',
    height: '100%',
  },

  // ── STATS STRIP ──
  statsStrip: {
    backgroundColor: C.statBg,
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  statsRow: {
    flexDirection: 'row', gap: 24,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statCard: {
    alignItems: 'center', gap: 4,
    paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    minWidth: 130,
  },
  statCardHighlight: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  statValue:          { fontSize: 30, fontWeight: '900', color: C.white, lineHeight: 36 },
  statValueHighlight: { fontSize: 34 },
  statLabel:          { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500', textAlign: 'center' },
  statLabelHighlight: { color: 'rgba(255,255,255,0.9)' },

  // ── FEATURES ──
  featuresSection: {
    paddingHorizontal: 32,
    paddingTop: 52,
    paddingBottom: 52,
    backgroundColor: C.bg,
    gap: 10,
  },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: C.teal, textTransform: 'uppercase', letterSpacing: 1.5 },
  sectionLabelCompact: { fontSize: 12 },
  sectionTitle: { fontSize: 34, fontWeight: '900', color: C.navy, lineHeight: 42, marginBottom: 14 },
  sectionTitleCompact: { fontSize: 24, lineHeight: 32 },

  featureGrid:        { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  featureGridCompact: { flexDirection: 'column' },

  featureCard: {
    flex: 1, minWidth: 240,
    borderRadius: 18, borderWidth: 1.5,
    padding: 24, gap: 10,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10,
    elevation: 3,
  },
  featureCardCompact: { minWidth: 'auto' as any },
  featureIconNum: { width: 40, height: 40, borderRadius: 8, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' },
  featureIconNumText: { color: C.white, fontWeight: '900', fontSize: 14 },
  featureTitle: { fontSize: 20, fontWeight: '800', color: C.navyLight },
  featureTitleCompact: { fontSize: 17 },
  featureDesc:  { fontSize: 14, color: C.slate, lineHeight: 22, flex: 1 },
  featureDescCompact: { fontSize: 13 },
  featureCta:   { alignSelf: 'flex-start', marginTop: 4 },
  featureCtaText: { fontSize: 14, fontWeight: '700', color: C.teal },

  // ── HOW IT WORKS ──
  howSection: {
    backgroundColor: C.white,
    paddingHorizontal: 32,
    paddingTop: 52, paddingBottom: 52,
    gap: 10,
  },
  stepsRow:        { flexDirection: 'row', gap: 16, flexWrap: 'wrap', marginTop: 8 },
  stepsRowCompact: { flexDirection: 'column' },

  stepCard: {
    flex: 1, minWidth: 200,
    backgroundColor: C.heroGrad1,
    borderRadius: 18, borderWidth: 1, borderColor: C.tealMid,
    padding: 24, gap: 8,
    alignItems: 'flex-start',
  },
  stepCardCompact: { minWidth: 'auto' as any },
  stepNumber: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.teal,
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumberText: { color: C.white, fontWeight: '900', fontSize: 16 },
  stepTitle:      { fontSize: 17, fontWeight: '800', color: C.navy },
  stepTitleCompact: { fontSize: 15 },
  stepDesc:       { fontSize: 14, color: C.slate, lineHeight: 21 },
  stepDescCompact: { fontSize: 13 },

  // ── BOTTOM CTA BANNER ──
  ctaBanner: {
    backgroundColor: C.tealDark,
    paddingHorizontal: 32, paddingVertical: 52,
    alignItems: 'center', gap: 14,
  },
  ctaBannerTitle: {
    fontSize: 32, fontWeight: '900', color: C.white,
    textAlign: 'center', lineHeight: 40,
  },
  ctaBannerTitleCompact: { fontSize: 22, lineHeight: 30 },
  ctaBannerSub: {
    fontSize: 16, color: 'rgba(255,255,255,0.78)',
    textAlign: 'center', lineHeight: 24, maxWidth: 500,
  },
  ctaBannerBtn: {
    marginTop: 8,
    backgroundColor: C.white,
    paddingHorizontal: 30, paddingVertical: 14,
    borderRadius: 10,
  },
  ctaBannerBtnText: { color: C.tealDark, fontWeight: '800', fontSize: 16 },
});
