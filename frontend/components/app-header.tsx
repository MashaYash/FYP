import {
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
  Text,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C, R, S } from '@/constants/theme';

// ── Types ─────────────────────────────────────────────────────────────────────
export type HeaderTab = 'home' | 'report' | 'about' | 'cross' | 'assistant' | 'profile';

type AppHeaderProps = {
  activeTab: HeaderTab;
  actionLabel?: string;
  actionHref?: '/home' | '/front' | '/about' | '/crossAllergen' | '/chatbot' | '/profile';
};

// Centre nav items (matches home page navbar)
const NAV_ITEMS: { tab: HeaderTab; label: string; href: string }[] = [
  { tab: 'home',      label: 'Home',                    href: '/home' },
  { tab: 'report',    label: 'Report Analyser',          href: '/front' },
  { tab: 'cross',     label: 'Cross Allergen Detector',  href: '/crossAllergen' },
  { tab: 'assistant', label: 'AI Assistant',             href: '/chatbot' },
];

// ── Component ─────────────────────────────────────────────────────────────────
export function AppHeader({
  activeTab,
  actionLabel,
  actionHref  = '/front',
}: AppHeaderProps) {
  const router    = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < 900;

  const [user, setUser] = useState<{ first_name: string; last_name: string } | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('user').then(raw => {
      if (raw) setUser(JSON.parse(raw));
    });
  }, []);

  const initials = user
    ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase()
    : null;

  return (
    <View style={[styles.navbar, isCompact && styles.navbarCompact]}>

      {/* ── Brand (left) ── */}
      <TouchableOpacity
        style={styles.brand}
        onPress={() => router.push('/home')}
        accessibilityRole="link"
        accessibilityLabel="AllergyGenie home"
      >
        <View style={styles.logoMark}>
          <View style={styles.logoV} />
          <View style={styles.logoH} />
        </View>
        <Text style={[styles.brandText, isCompact && styles.brandTextSm]}>AllergyGenie</Text>
        <Text style={[styles.brandAi, isCompact && styles.brandTextSm]}> AI</Text>
      </TouchableOpacity>

      {/* ── Centre nav links — visible on desktop only ── */}
      {!isCompact && (
        <View style={styles.navLinks}>
          {NAV_ITEMS.map(({ tab, label, href }) => (
            <TouchableOpacity key={tab} onPress={() => router.push(href as any)}>
              <Text style={tab === activeTab ? styles.navLinkActive : styles.navLink}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
          {/* Profile — separated, only when logged in */}
          {user && (
            <TouchableOpacity
              onPress={() => router.push('/profile')}
              style={styles.navItemSeparated}
            >
              <Text style={activeTab === 'profile' ? styles.navLinkActive : styles.navLink}>
                Profile
              </Text>
            </TouchableOpacity>
          )}
          {/* About Us — always last, separated */}
          <TouchableOpacity
            onPress={() => router.push('/about')}
            style={user ? undefined : styles.navItemSeparated}
          >
            <Text style={activeTab === 'about' ? styles.navLinkActive : styles.navLink}>
              About Us
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Right side ── */}
      <View style={styles.navRight}>
        {user ? (
          /* Logged-in: avatar → profile */
          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => router.push('/profile')}
            accessibilityRole="button"
            accessibilityLabel="View profile"
          >
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            {!isCompact && (
              <Text style={styles.avatarName} numberOfLines={1}>
                {user.first_name} {user.last_name}
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          /* Logged-out: Login + Sign up */
          <>
            <TouchableOpacity
              style={styles.loginBtn}
              onPress={() => router.push('/login')}
              accessibilityRole="button"
            >
              <Text style={styles.loginBtnText}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.signupBtn}
              onPress={() => router.push('/register')}
              accessibilityRole="button"
            >
              <Text style={styles.signupBtnText}>Sign up</Text>
            </TouchableOpacity>
          </>
        )}

        {/* CTA action button */}
        {actionLabel && (
          <TouchableOpacity
            style={[styles.actionBtn, isCompact && styles.actionBtnSm]}
            onPress={() => router.push(actionHref)}
            accessibilityRole="button"
          >
            <Text style={styles.actionBtnText}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Mobile: scrollable nav tabs ── */}
      {isCompact && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.mobileNav}
          style={styles.mobileNavScroll}
        >
          {NAV_ITEMS.map(({ tab, label, href }) => (
            <TouchableOpacity key={tab} onPress={() => router.push(href as any)}>
              <Text style={tab === activeTab ? styles.mobileNavActive : styles.mobileNavItem}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
          {/* Profile — separated, only when logged in */}
          {user && (
            <TouchableOpacity
              onPress={() => router.push('/profile')}
              style={styles.mobileNavItemSeparated}
            >
              <Text style={activeTab === 'profile' ? styles.mobileNavActive : styles.mobileNavItem}>
                Profile
              </Text>
            </TouchableOpacity>
          )}
          {/* About Us — always last, separated */}
          <TouchableOpacity
            onPress={() => router.push('/about')}
            style={user ? undefined : styles.mobileNavItemSeparated}
          >
            <Text style={activeTab === 'about' ? styles.mobileNavActive : styles.mobileNavItem}>
              About Us
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  // ── Navbar shell ── (sticky on web/native)
  navbar: {
    backgroundColor: C.bgWhite,
    borderBottomWidth: 1,
    borderBottomColor: '#ddf0f4',
    paddingHorizontal: 28,
    paddingVertical: 14,
    flexWrap: 'wrap',
    gap: 8,
    zIndex: 100,
    // Sticky positioning
    position: Platform.OS === 'web' ? ('sticky' as any) : 'relative',
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Shadow for depth when sticky
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  navbarCompact: { paddingHorizontal: 14, paddingVertical: 10 },

  // Brand
  brand:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logoMark: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: C.tealLight,
    borderWidth: 1.5, borderColor: C.tealMid,
    alignItems: 'center', justifyContent: 'center',
  },
  logoV:        { position: 'absolute', width: 5, height: 15, borderRadius: 3, backgroundColor: C.teal },
  logoH:        { width: 15, height: 5, borderRadius: 3, backgroundColor: C.teal },
  brandText:    { fontSize: 22, fontWeight: '800', color: C.teal },
  brandAi:      { fontSize: 22, fontWeight: '800', color: C.navy },
  brandTextSm:  { fontSize: 17 },

  // Centre nav (desktop)
  navLinks:     { flexDirection: 'row', gap: 28, alignItems: 'center' },
  navLink:      { fontSize: 15, color: C.slateLight, fontWeight: '500' },
  navLinkActive:{ fontSize: 15, color: C.teal,       fontWeight: '700' },
  // Extra spacing before "About Us" and "Profile" tabs
  navItemSeparated: { marginLeft: 16 },

  // Right side
  navRight:     { flexDirection: 'row', alignItems: 'center', gap: 10 },

  // Avatar
  avatarBtn:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatarCircle: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.teal,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText:   { color: C.white, fontWeight: '800', fontSize: 13 },
  avatarName:   { fontSize: 13, fontWeight: '600', color: C.slate, maxWidth: 120 },

  // Login / Sign up
  loginBtn:     { paddingHorizontal: 16, paddingVertical: 8, borderRadius: R.pill },
  loginBtnText: { fontSize: 14, fontWeight: '600', color: C.navy },
  signupBtn: {
    paddingHorizontal: 18, paddingVertical: 9,
    borderRadius: R.pill,
    borderWidth: 1.5, borderColor: C.navy,
  },
  signupBtnText: { fontSize: 14, fontWeight: '700', color: C.navy },

  // Action / CTA button
  actionBtn: {
    backgroundColor: C.teal,
    borderRadius: R.pill,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  actionBtnSm:  { paddingHorizontal: 12, paddingVertical: 7 },
  actionBtnText:{ color: C.white, fontWeight: '700', fontSize: 14 },

  // Mobile nav strip
  mobileNavScroll: { width: '100%' },
  mobileNav: {
    flexDirection: 'row',
    gap: 20,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  mobileNavItem:  { fontSize: 14, color: C.slateLight, fontWeight: '500', paddingBottom: 4 },
  mobileNavActive:{
    fontSize: 14, color: C.teal, fontWeight: '700',
    paddingBottom: 4,
    borderBottomWidth: 2, borderBottomColor: C.teal,
  },
  // Extra spacing before "About Us" and "Profile" on mobile strip
  mobileNavItemSeparated: { marginLeft: 14 },
});
