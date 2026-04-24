import { ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function AboutScreen() {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <AppHeader activeTab="about" actionLabel="Assistant" actionHref="/chatbot" />

      <ThemedView style={styles.heroCard}>
        <ThemedText style={styles.heroEyebrow}>About Our Platform</ThemedText>
        <ThemedText style={styles.heroTitle}>Building Safer Daily Food Decisions with AI</ThemedText>
        <ThemedText style={styles.heroText}>
          AllergyGenie combines report analysis, cross-allergen detection, and a guided assistant experience
          to help users understand allergy risk clearly and act safely in real life.
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.card}>
        <ThemedText style={styles.sectionTitle}>What AllergyGenie Does</ThemedText>
        <ThemedText style={styles.bullet}>• Report Analyser: extracts meaningful allergy findings from uploaded reports.</ThemedText>
        <ThemedText style={styles.bullet}>• Cross Allergy: identifies likely cross-reactive food risks and patterns.</ThemedText>
        <ThemedText style={styles.bullet}>• Assistant: provides user-friendly, safety-focused guidance and Q&A.</ThemedText>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#d9f0f2',
  },
  pageContent: {
    paddingBottom: 30,
    gap: 14,
  },
  heroCard: {
    marginHorizontal: 18,
    marginTop: 4,
    borderRadius: 16,
    backgroundColor: '#d4eef1',
    borderWidth: 1,
    borderColor: '#bfe3e8',
    padding: 18,
    gap: 8,
  },
  heroEyebrow: {
    color: '#2693a3',
    fontWeight: '700',
    fontSize: 16,
  },
  heroTitle: {
    color: '#0e2344',
    fontSize: 40,
    lineHeight: 48,
    fontWeight: '900',
  },
  heroText: {
    color: '#334155',
    fontSize: 17,
    lineHeight: 24,
  },
  card: {
    marginHorizontal: 18,
    backgroundColor: '#f8fafb',
    borderWidth: 1,
    borderColor: '#d8dde3',
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#12284b',
  },
  bullet: {
    color: '#1f2937',
    fontSize: 16,
    lineHeight: 24,
  },
});
