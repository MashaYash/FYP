import { ScrollView, StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';

import { AppHeader } from '@/components/app-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < 900;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <AppHeader activeTab="home" actionLabel="Get Started" actionHref="/front" />

      <View style={[styles.contentWrap, isCompact && styles.contentWrapCompact]}>
        <ThemedView style={[styles.heroCard, isCompact && styles.heroCardCompact]}>
          <View style={styles.heroLeft}>
            <ThemedText style={styles.heroTagline}>Smarter Allergy Care Starts Here</ThemedText>
            <ThemedText style={[styles.heroTitle, isCompact && styles.heroTitleCompact]}>Your AI-Powered Path to Allergy-Safe Living</ThemedText>
            <ThemedText style={[styles.heroSubText, isCompact && styles.heroSubTextCompact]}>
              AllergyGenie helps you understand reports, detect cross-allergen risks, and make safer daily food
              choices with an intelligent assistant.
            </ThemedText>
            <View style={[styles.ctaRow, isCompact && styles.ctaRowCompact]}>
              <TouchableOpacity style={styles.ctaButton} onPress={() => router.push('/front')}>
                <ThemedText style={styles.ctaText}>Start Report Analysis</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryCta} onPress={() => router.push('/chatbot')}>
                <ThemedText style={styles.secondaryCtaText}>Open Assistant</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
          <View style={[styles.heroArt, isCompact && styles.heroArtCompact]}>
            <ThemedText style={[styles.heroArtIcon, isCompact && styles.heroArtIconCompact]}>🤖</ThemedText>
          </View>
        </ThemedView>

        <ThemedText style={[styles.sectionTitle, isCompact && styles.sectionTitleCompact]}>Main Components</ThemedText>
        <View style={styles.grid}>
          <TouchableOpacity style={styles.card} onPress={() => router.push('/front')}>
            <ThemedText style={[styles.cardTitle, isCompact && styles.cardTitleCompact]}>Report Analyser</ThemedText>
            <ThemedText style={[styles.cardText, isCompact && styles.cardTextCompact]}>Upload reports, extract findings, and view structured risk output.</ThemedText>
            <ThemedText style={styles.cardLink}>Open Module</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={() => router.push('/crossAllergen')}>
            <ThemedText style={[styles.cardTitle, isCompact && styles.cardTitleCompact]}>Cross Allergen Detector</ThemedText>
            <ThemedText style={[styles.cardText, isCompact && styles.cardTextCompact]}>Identify hidden cross-reactive foods and review risk summaries.</ThemedText>
            <ThemedText style={styles.cardLink}>Open Module</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={() => router.push('/chatbot')}>
            <ThemedText style={[styles.cardTitle, isCompact && styles.cardTitleCompact]}>AI Assistant</ThemedText>
            <ThemedText style={[styles.cardText, isCompact && styles.cardTextCompact]}>Ask personalized allergy questions and get practical guidance.</ThemedText>
            <ThemedText style={styles.cardLink}>Open Module</ThemedText>
          </TouchableOpacity>
        </View>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#d6eef1' },
  pageContent: { paddingBottom: 34 },
  contentWrap: { paddingHorizontal: 18, paddingTop: 14, gap: 16 },
  contentWrapCompact: { paddingHorizontal: 10, paddingTop: 10 },
  heroCard: {
    borderRadius: 16,
    backgroundColor: '#cbe8ed',
    borderWidth: 1,
    borderColor: '#b7dbe2',
    padding: 18,
    flexDirection: 'row',
    gap: 12,
  },
  heroCardCompact: {
    flexDirection: 'column',
    padding: 12,
  },
  heroLeft: { flex: 1, gap: 8 },
  heroTagline: { color: '#2f9aad', fontWeight: '700', fontSize: 16 },
  heroTitle: { color: '#12284b', fontSize: 44, lineHeight: 52, fontWeight: '900' },
  heroTitleCompact: { fontSize: 30, lineHeight: 36 },
  heroSubText: { color: '#3b4a5f', fontSize: 17, lineHeight: 24 },
  heroSubTextCompact: { fontSize: 15, lineHeight: 21 },
  ctaRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  ctaRowCompact: { flexDirection: 'column', alignItems: 'flex-start' },
  ctaButton: { alignSelf: 'flex-start', backgroundColor: '#0b8fa1', borderRadius: 22, paddingHorizontal: 20, paddingVertical: 10 },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondaryCta: {
    alignSelf: 'flex-start',
    backgroundColor: '#f8fcfd',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#0b8fa1',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  secondaryCtaText: {
    color: '#0b8fa1',
    fontWeight: '700',
    fontSize: 16,
  },
  heroArt: { width: 260, borderRadius: 18, backgroundColor: '#089ab0', alignItems: 'center', justifyContent: 'center' },
  heroArtCompact: { width: '100%', minHeight: 120 },
  heroArtIcon: { fontSize: 72 },
  heroArtIconCompact: { fontSize: 54 },
  sectionTitle: { fontSize: 34, fontWeight: '800', color: '#0b6f80' },
  sectionTitleCompact: { fontSize: 26 },
  grid: { gap: 10 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#c9dde2',
    backgroundColor: '#f8fbfc',
    padding: 16,
    gap: 6,
  },
  cardTitle: { fontSize: 24, fontWeight: '800', color: '#132744' },
  cardTitleCompact: { fontSize: 20 },
  cardText: { color: '#3d4d61', fontSize: 16, lineHeight: 23 },
  cardTextCompact: { fontSize: 14, lineHeight: 20 },
  cardLink: { color: '#0b8fa1', fontSize: 14, fontWeight: '700', marginTop: 2 },
});
