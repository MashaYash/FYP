import { ScrollView, StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

type HeaderTab = 'home' | 'report' | 'about' | 'cross' | 'assistant';

type AppHeaderProps = {
  activeTab: HeaderTab;
  actionLabel?: string;
  actionHref?: '/home' | '/front' | '/about' | '/crossAllergen' | '/chatbot';
};

export function AppHeader({ activeTab, actionLabel = 'Assistant', actionHref = '/chatbot' }: AppHeaderProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < 900;

  const tabStyle = (tab: HeaderTab) => (tab === activeTab ? styles.navItemActive : styles.navItem);

  return (
    <ThemedView style={[styles.header, isCompact && styles.headerCompact]}>
      <View style={[styles.topRow, isCompact && styles.topRowCompact]}>
        <View style={[styles.leftBrand, isCompact && styles.leftBrandCompact]}>
          <View style={styles.logoBadge}>
            <View style={styles.logoCrossVertical} />
            <View style={styles.logoCrossHorizontal} />
          </View>
          <ThemedText style={[styles.brand, isCompact && styles.brandCompact]}>AllergyGenie</ThemedText>
        </View>

        <TouchableOpacity style={[styles.actionButton, isCompact && styles.actionButtonCompact]} onPress={() => router.push(actionHref)}>
          <ThemedText style={styles.actionText}>{actionLabel}</ThemedText>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.centerNav, isCompact && styles.centerNavCompact]}
      >
        <TouchableOpacity onPress={() => router.push('/home')}>
          <ThemedText style={[tabStyle('home'), isCompact && styles.navItemCompact]}>Home</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/front')}>
          <ThemedText style={[tabStyle('report'), isCompact && styles.navItemCompact]}>Report Analyser</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/crossAllergen')}>
          <ThemedText style={[tabStyle('cross'), isCompact && styles.navItemCompact]}>Cross Allergy</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/chatbot')}>
          <ThemedText style={[tabStyle('assistant'), isCompact && styles.navItemCompact]}>Assistant</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/about')}>
          <ThemedText style={[tabStyle('about'), isCompact && styles.navItemCompact]}>About</ThemedText>
        </TouchableOpacity>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#dce8ea',
    minHeight: 78,
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
  },
  headerCompact: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topRowCompact: {
    gap: 8,
  },
  leftBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  leftBrandCompact: {
    flexShrink: 1,
  },
  logoBadge: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: '#dff3f6',
    borderWidth: 1,
    borderColor: '#b8e1e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCrossVertical: {
    position: 'absolute',
    width: 5,
    height: 14,
    borderRadius: 3,
    backgroundColor: '#0d8ba0',
  },
  logoCrossHorizontal: {
    width: 14,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#0d8ba0',
  },
  brand: {
    color: '#0b7f90',
    fontSize: 28,
    fontWeight: '800',
  },
  brandCompact: {
    fontSize: 22,
  },
  centerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
    paddingRight: 8,
  },
  centerNavCompact: {
    gap: 14,
    paddingVertical: 4,
  },
  navItem: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  navItemActive: {
    fontSize: 16,
    color: '#007f8c',
    fontWeight: '700',
  },
  navItemCompact: {
    fontSize: 14,
  },
  actionButton: {
    backgroundColor: '#0b8fa1',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  actionButtonCompact: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  actionText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});
