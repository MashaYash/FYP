import React, { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';

import { AppHeader } from '@/components/app-header';
import { Storage, UserStorage } from '@/components/utils/storage';
import { showAlert } from '@/components/utils/showAlert';
import { getApiBaseUrl } from '@/constants/api';
import { C, R, S } from '@/constants/theme';
import { usePageTransition } from '@/hooks/use-page-transition';
import { NotificationPopup } from '@/components/ui/notification-popup';

// ── Types ─────────────────────────────────────────────────────────────────────
type UserProfile = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  age?: string;
  gender?: string;
  address?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function initials(u: UserProfile) {
  return `${u.first_name?.[0] ?? ''}${u.last_name?.[0] ?? ''}`.toUpperCase();
}

function SectionCard({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.sectionCard, style]}>{children}</View>;
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

function ReadonlyField({ value }: { value: string }) {
  return (
    <View style={styles.readonlyField}>
      <Text style={styles.readonlyText}>{value}</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < 900;
  const BASE_URL = getApiBaseUrl();
  const { opacity, translateY } = usePageTransition();

  // ── State ──────────────────────────────────────────────────────────────────
  const [user, setUser]         = useState<UserProfile | null>(null);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);

  // Edit form fields
  const [firstName, setFirstName]       = useState('');
  const [lastName,  setLastName]        = useState('');
  const [email,     setEmail]           = useState('');
  const [age,       setAge]             = useState('');
  const [gender,    setGender]          = useState('');
  const [address,   setAddress]         = useState('');
  const [currentPw, setCurrentPw]       = useState('');
  const [newPw,     setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]       = useState('');
  const [showPwSection, setShowPwSection] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [successNotification, setSuccessNotification] = useState<{ title: string; message: string } | null>(null);
  const [logoutComplete, setLogoutComplete] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  // Field errors
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  // ── Load user ──────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const stored = await UserStorage.getUser();
      if (!stored) {
        router.replace('/login');
        return;
      }
      setUser(stored);
      setFirstName(stored.first_name ?? '');
      setLastName(stored.last_name  ?? '');
      setEmail(stored.email         ?? '');
      setAge(stored.age             ?? '');
      setGender(stored.gender       ?? '');
      setAddress(stored.address     ?? '');
      setLoading(false);
    })();
  }, []);

  // ── Validate ───────────────────────────────────────────────────────────────
  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = 'First name is required.';
    if (!lastName.trim())  errs.lastName  = 'Last name is required.';
    if (!email.trim())     errs.email     = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Enter a valid email.';

    if (showPwSection) {
      if (!currentPw) errs.currentPw = 'Enter your current password.';
      if (newPw.length < 6) errs.newPw = 'New password must be at least 6 characters.';
      if (newPw !== confirmPw) errs.confirmPw = 'Passwords do not match.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!validate()) return;
    setSaving(true);

    try {
      const token = await Storage.getToken();

      // Build payload
      const payload: Record<string, any> = {
        user_id:    user?.id,
        first_name: firstName.trim(),
        last_name:  lastName.trim(),
        email:      email.trim().toLowerCase(),
      };
      if (age.trim())     payload.age     = age.trim();
      if (gender.trim())  payload.gender  = gender.trim();
      if (address.trim()) payload.address = address.trim();
      if (showPwSection && newPw) {
        payload.current_password = currentPw;
        payload.new_password     = newPw;
      }

      const res = await fetch(`${BASE_URL}/updateUser`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data?.detail || data?.message || 'Update failed. Please try again.';
        throw new Error(msg);
      }

      const passwordChanged = showPwSection && Boolean(newPw);
      const profileChanged = !!user && (
        firstName.trim() !== user.first_name ||
        lastName.trim() !== user.last_name ||
        email.trim().toLowerCase() !== user.email.toLowerCase() ||
        (age.trim() || '') !== (user.age || '') ||
        (gender.trim() || '') !== (user.gender || '') ||
        (address.trim() || '') !== (user.address || '')
      );

      // Persist updated user locally
      const updated: UserProfile = {
        ...(user as UserProfile),
        first_name: firstName.trim(),
        last_name:  lastName.trim(),
        email:      email.trim().toLowerCase(),
        age:        age.trim() || undefined,
        gender:     gender.trim() || undefined,
        address:    address.trim() || undefined,
        ...data.user ?? {},
      };
      await UserStorage.setUser(updated);
      setUser(updated);

      // Reset password section
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setShowPwSection(false);
      setEditing(false);
      if (passwordChanged && profileChanged) {
        setSuccessNotification({ title: 'Profile and password updated', message: 'Your profile details and password have been saved.' });
      } else if (passwordChanged) {
        setSuccessNotification({ title: 'Password changed', message: 'Your password has been updated successfully.' });
      } else if (profileChanged) {
        setSuccessNotification({ title: 'Profile details saved', message: 'Your profile details have been updated successfully.' });
      } else {
        setSuccessNotification({ title: 'Profile saved', message: 'Your profile has been updated successfully.' });
      }
    } catch (err: any) {
      showAlert('Error', err.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Cancel ─────────────────────────────────────────────────────────────────
  function handleCancel() {
    if (!user) return;
    setFirstName(user.first_name);
    setLastName(user.last_name);
    setEmail(user.email);
    setAge(user.age ?? '');
    setGender(user.gender ?? '');
    setAddress(user.address ?? '');
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    setShowPwSection(false);
    setErrors({});
    setEditing(false);
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  function handleLogout() {
    setLogoutConfirmOpen(true);
  }

  async function confirmLogout() {
    setLogoutConfirmOpen(false);
    await Storage.removeToken();
    // Clear user from both storages
    await UserStorage.setUser(null as any);
    if (Platform.OS === 'web') {
      localStorage.removeItem('user');
    } else {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.removeItem('user');
    }
    setLogoutComplete(true);
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={C.teal} />
      </View>
    );
  }

  if (!user) return null;

  const ini = initials(user);

  return (
    <Animated.View style={{ flex: 1, opacity, transform: [{ translateY }] }}>
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.pageContent, isCompact && styles.pageContentSm]}
      showsVerticalScrollIndicator={false}
    >
      <AppHeader activeTab="profile" />

      {/* ── Page header ── */}
      <View style={[styles.pageHero, isCompact && styles.pageHeroSm]}>
        <View style={styles.pageHeroInner}>
          <Text style={[styles.pageTitle, isCompact && styles.pageTitleSm]}>My Profile</Text>
          <Text style={styles.pageSub}>Manage your account details and security settings.</Text>
        </View>
      </View>

      <View style={[styles.body, isCompact && styles.bodySm]}>

        {/* ── Avatar + name card ── */}
        <SectionCard style={styles.avatarCard}>
          <View style={styles.avatarRow}>
            <View style={[styles.avatarCircle, isCompact && styles.avatarCircleSm]}>
              <Text style={[styles.avatarText, isCompact && styles.avatarTextSm]}>{ini}</Text>
            </View>
            <View style={styles.avatarInfo}>
              <Text style={[styles.avatarName, isCompact && styles.avatarNameSm]}>
                {user.first_name} {user.last_name}
              </Text>
              <Text style={styles.avatarEmail}>{user.email}</Text>
              <View style={styles.memberBadge}>
                <View style={styles.memberDot} />
                <Text style={styles.memberText}>Active Member</Text>
              </View>
            </View>
          </View>

          {/* Edit / Logout buttons */}
          <View style={styles.cardActions}>
            {!editing ? (
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => setEditing(true)}
                accessibilityRole="button"
              >
                <Text style={styles.editBtnText}>Edit Profile</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleLogout}
              accessibilityRole="button"
            >
              <Text style={styles.logoutBtnText}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </SectionCard>

        {/* ── Details / Edit form ── */}
        <SectionCard>
          <Text style={styles.sectionTitle}>
            {editing ? 'Edit Details' : 'Account Details'}
          </Text>

          <View style={styles.fieldsGrid}>
            {/* First name */}
            <View style={styles.fieldWrap}>
              <FieldLabel label="First Name" />
              {editing ? (
                <>
                  <TextInput
                    style={[styles.input, errors.firstName && styles.inputError]}
                    value={firstName}
                    onChangeText={v => { setFirstName(v); setErrors(e => ({ ...e, firstName: '' })); }}
                    placeholder="First name"
                    placeholderTextColor={C.slateXLight}
                    accessibilityLabel="First name"
                  />
                  {errors.firstName ? <Text style={styles.errorText}>{errors.firstName}</Text> : null}
                </>
              ) : (
                <ReadonlyField value={user.first_name} />
              )}
            </View>

            {/* Last name */}
            <View style={styles.fieldWrap}>
              <FieldLabel label="Last Name" />
              {editing ? (
                <>
                  <TextInput
                    style={[styles.input, errors.lastName && styles.inputError]}
                    value={lastName}
                    onChangeText={v => { setLastName(v); setErrors(e => ({ ...e, lastName: '' })); }}
                    placeholder="Last name"
                    placeholderTextColor={C.slateXLight}
                    accessibilityLabel="Last name"
                  />
                  {errors.lastName ? <Text style={styles.errorText}>{errors.lastName}</Text> : null}
                </>
              ) : (
                <ReadonlyField value={user.last_name} />
              )}
            </View>

            {/* Email – full width */}
            <View style={[styles.fieldWrap, styles.fieldFull]}>
              <FieldLabel label="Email Address" />
              {editing ? (
                <>
                  <TextInput
                    style={[styles.input, errors.email && styles.inputError]}
                    value={email}
                    onChangeText={v => { setEmail(v); setErrors(e => ({ ...e, email: '' })); }}
                    placeholder="Email"
                    placeholderTextColor={C.slateXLight}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    accessibilityLabel="Email address"
                  />
                  {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
                </>
              ) : (
                <ReadonlyField value={user.email} />
              )}
            </View>

            {/* Age – optional */}
            <View style={styles.fieldWrap}>
              <FieldLabel label="Age (optional)" />
              {editing ? (
                <TextInput
                  style={styles.input}
                  value={age}
                  onChangeText={setAge}
                  placeholder="e.g. 28"
                  placeholderTextColor={C.slateXLight}
                  keyboardType="numeric"
                  accessibilityLabel="Age"
                />
              ) : (
                <ReadonlyField value={user.age || '—'} />
              )}
            </View>

            {/* Gender – optional */}
            <View style={styles.fieldWrap}>
              <FieldLabel label="Gender (optional)" />
              {editing ? (
                <TextInput
                  style={styles.input}
                  value={gender}
                  onChangeText={setGender}
                  placeholder="e.g. Female"
                  placeholderTextColor={C.slateXLight}
                  accessibilityLabel="Gender"
                />
              ) : (
                <ReadonlyField value={user.gender || '—'} />
              )}
            </View>

            {/* Address – optional, full width */}
            <View style={[styles.fieldWrap, styles.fieldFull]}>
              <FieldLabel label="Address (optional)" />
              {editing ? (
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Street, city, country"
                  placeholderTextColor={C.slateXLight}
                  multiline
                  numberOfLines={2}
                  accessibilityLabel="Address"
                />
              ) : (
                <ReadonlyField value={user.address || '—'} />
              )}
            </View>
          </View>
        </SectionCard>

        {/* ── Change password (only in edit mode) ── */}
        {editing && (
          <SectionCard>
            <TouchableOpacity
              style={styles.pwToggleRow}
              onPress={() => setShowPwSection(p => !p)}
              accessibilityRole="button"
            >
              <Text style={styles.sectionTitle}>Change Password</Text>
              <Text style={styles.pwToggleChevron}>{showPwSection ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            <Text style={styles.sectionSub}>Leave collapsed to keep your current password.</Text>

            {showPwSection && (
              <View style={styles.pwFields}>
                {/* Current password */}
                <View style={styles.fieldWrap}>
                  <FieldLabel label="Current Password" />
                  <View style={styles.passwordInputWrap}>
                    <TextInput
                      style={[styles.input, styles.passwordInput, errors.currentPw && styles.inputError]}
                      value={currentPw}
                      onChangeText={v => { setCurrentPw(v); setErrors(e => ({ ...e, currentPw: '' })); }}
                      placeholder="Current password"
                      placeholderTextColor={C.slateXLight}
                      secureTextEntry={!showCurrentPw}
                      accessibilityLabel="Current password"
                    />
                    <TouchableOpacity
                      style={styles.passwordEye}
                      onPress={() => setShowCurrentPw(visible => !visible)}
                      accessibilityRole="button"
                      accessibilityLabel={showCurrentPw ? 'Hide current password' : 'Show current password'}
                    >
                      <Ionicons name={showCurrentPw ? 'eye-off-outline' : 'eye-outline'} size={21} color={C.slateLight} />
                    </TouchableOpacity>
                  </View>
                  {errors.currentPw ? <Text style={styles.errorText}>{errors.currentPw}</Text> : null}
                </View>

                {/* New password */}
                <View style={styles.fieldWrap}>
                  <FieldLabel label="New Password" />
                  <View style={styles.passwordInputWrap}>
                    <TextInput
                      style={[styles.input, styles.passwordInput, errors.newPw && styles.inputError]}
                      value={newPw}
                      onChangeText={v => { setNewPw(v); setErrors(e => ({ ...e, newPw: '' })); }}
                      placeholder="Min. 6 characters"
                      placeholderTextColor={C.slateXLight}
                      secureTextEntry={!showNewPw}
                      accessibilityLabel="New password"
                    />
                    <TouchableOpacity
                      style={styles.passwordEye}
                      onPress={() => setShowNewPw(visible => !visible)}
                      accessibilityRole="button"
                      accessibilityLabel={showNewPw ? 'Hide new password' : 'Show new password'}
                    >
                      <Ionicons name={showNewPw ? 'eye-off-outline' : 'eye-outline'} size={21} color={C.slateLight} />
                    </TouchableOpacity>
                  </View>
                  {errors.newPw ? <Text style={styles.errorText}>{errors.newPw}</Text> : null}
                </View>

                {/* Confirm password */}
                <View style={styles.fieldWrap}>
                  <FieldLabel label="Confirm New Password" />
                  <View style={styles.passwordInputWrap}>
                    <TextInput
                      style={[styles.input, styles.passwordInput, errors.confirmPw && styles.inputError]}
                      value={confirmPw}
                      onChangeText={v => { setConfirmPw(v); setErrors(e => ({ ...e, confirmPw: '' })); }}
                      placeholder="Repeat new password"
                      placeholderTextColor={C.slateXLight}
                      secureTextEntry={!showConfirmPw}
                      accessibilityLabel="Confirm new password"
                    />
                    <TouchableOpacity
                      style={styles.passwordEye}
                      onPress={() => setShowConfirmPw(visible => !visible)}
                      accessibilityRole="button"
                      accessibilityLabel={showConfirmPw ? 'Hide confirmation password' : 'Show confirmation password'}
                    >
                      <Ionicons name={showConfirmPw ? 'eye-off-outline' : 'eye-outline'} size={21} color={C.slateLight} />
                    </TouchableOpacity>
                  </View>
                  {errors.confirmPw ? <Text style={styles.errorText}>{errors.confirmPw}</Text> : null}
                </View>
              </View>
            )}
          </SectionCard>
        )}

        {/* ── Save / Cancel row ── */}
        {editing && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleCancel}
              disabled={saving}
              accessibilityRole="button"
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
              accessibilityRole="button"
            >
              {saving
                ? <ActivityIndicator size="small" color={C.white} />
                : <Text style={styles.saveBtnText}>Save Changes</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* ── Quick links ── */}
        {!editing && (
          <SectionCard>
            <Text style={styles.sectionTitle}>Quick Navigation</Text>
            <View style={styles.quickLinks}>
              {[
                { icon: '01', label: 'Report Analyser',        href: '/front' },
                { icon: '02', label: 'Cross Allergen Detector', href: '/crossAllergen' },
                { icon: '03', label: 'AI Assistant',            href: '/chatbot' },
                { icon: '04', label: 'About',                  href: '/about' },
              ].map(({ icon, label, href }) => (
                <TouchableOpacity
                  key={href}
                  style={styles.quickLink}
                  onPress={() => router.push(href as any)}
                  accessibilityRole="link"
                >
                  <View style={styles.quickLinkIconWrap}>
                    <Text style={styles.quickLinkIcon}>{icon}</Text>
                  </View>
                  <Text style={styles.quickLinkText}>{label}</Text>
                  <Text style={styles.quickLinkArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          </SectionCard>
        )}

      </View>
    </ScrollView>
    <NotificationPopup
      visible={successNotification !== null}
      title={successNotification?.title || ''}
      message={successNotification?.message || ''}
      onClose={() => setSuccessNotification(null)}
    />
    <NotificationPopup
      visible={logoutConfirmOpen}
      title="Log out?"
      message="Are you sure you want to log out of AllergyGenie?"
      onClose={() => setLogoutConfirmOpen(false)}
      onConfirm={confirmLogout}
      confirmLabel="Log out"
      cancelLabel="Stay here"
    />
    <NotificationPopup
      visible={logoutComplete}
      title="Signed out"
      message="You have been logged out of AllergyGenie."
      buttonLabel="Go to login"
      onClose={() => {
        setLogoutComplete(false);
        router.replace('/login');
      }}
    />
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  page:            { flex: 1, backgroundColor: C.bg },
  pageContent:     { paddingBottom: 48 },
  pageContentSm:   {},
  loadingWrap:     { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },

  // Hero banner
  pageHero: {
    backgroundColor: C.teal,
    paddingHorizontal: S.xxl,
    paddingTop: S.xl,
    paddingBottom: S.xxl,
  },
  pageHeroSm:   { paddingHorizontal: S.lg, paddingTop: S.lg, paddingBottom: S.xl },
  pageHeroInner:{ gap: S.xs },
  pageTitle:    { fontSize: 36, fontWeight: '900', color: C.white, lineHeight: 44 },
  pageTitleSm:  { fontSize: 26, lineHeight: 34 },
  pageSub:      { fontSize: 15, color: 'rgba(255,255,255,0.82)', lineHeight: 22 },

  // Body
  body:    { paddingHorizontal: S.xxl, paddingTop: S.xl, gap: S.lg },
  bodySm:  { paddingHorizontal: S.lg,  paddingTop: S.lg },

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
  sectionTitle: { fontSize: 18, fontWeight: '800', color: C.navy },
  sectionSub:   { fontSize: 13, color: C.slateLight, marginTop: -S.sm },

  // Avatar card
  avatarCard:   { gap: S.lg },
  avatarRow:    { flexDirection: 'row', alignItems: 'center', gap: S.lg },
  avatarCircle: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: C.teal,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: C.tealMid,
  },
  avatarCircleSm: { width: 60, height: 60, borderRadius: 30 },
  avatarText:   { color: C.white, fontWeight: '900', fontSize: 26 },
  avatarTextSm: { fontSize: 20 },
  avatarInfo:   { flex: 1, gap: S.xs },
  avatarName:   { fontSize: 22, fontWeight: '800', color: C.navy },
  avatarNameSm: { fontSize: 18 },
  avatarEmail:  { fontSize: 14, color: C.slateLight },
  memberBadge:  { flexDirection: 'row', alignItems: 'center', gap: S.xs, marginTop: 2 },
  memberDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: C.success },
  memberText:   { fontSize: 12, fontWeight: '600', color: C.success },

  cardActions:  { flexDirection: 'row', gap: S.md, flexWrap: 'wrap' },
  editBtn: {
    backgroundColor: C.teal,
    borderRadius: R.pill,
    paddingHorizontal: S.xl, paddingVertical: S.md,
  },
  editBtnText:  { color: C.white, fontWeight: '700', fontSize: 14 },
  logoutBtn: {
    backgroundColor: C.bgCard,
    borderRadius: R.pill,
    borderWidth: 1.5, borderColor: C.dangerBorder,
    paddingHorizontal: S.xl, paddingVertical: S.md,
  },
  logoutBtnText: { color: C.danger, fontWeight: '700', fontSize: 14 },

  // Fields
  fieldsGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: S.lg },
  fieldWrap:   { flex: 1, minWidth: 200, gap: S.xs },
  fieldFull:   { flexBasis: '100%', flex: 1 },
  fieldLabel:  { fontSize: 12, fontWeight: '700', color: C.slateLight, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: {
    borderWidth: 1.5,
    borderColor: C.borderInput,
    borderRadius: R.md,
    paddingHorizontal: S.lg,
    paddingVertical: S.md,
    fontSize: 15,
    color: C.navy,
    backgroundColor: C.bgCard,
  },
  passwordInputWrap: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 52 },
  passwordEye: { position: 'absolute', right: 14, height: '100%', justifyContent: 'center', padding: 4 },
  inputError:   { borderColor: C.danger },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  errorText:    { fontSize: 12, color: C.danger, fontWeight: '500' },
  readonlyField:{
    backgroundColor: C.bg,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: S.lg,
    paddingVertical: S.md,
  },
  readonlyText: { fontSize: 15, color: C.slate },

  // Password section
  pwToggleRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pwToggleChevron:{ fontSize: 14, color: C.slateLight, fontWeight: '700' },
  pwFields:       { gap: S.lg, marginTop: S.xs },

  // Save/Cancel
  actionRow:  { flexDirection: 'row', gap: S.md, justifyContent: 'flex-end' },
  cancelBtn: {
    paddingHorizontal: S.xl, paddingVertical: S.md,
    borderRadius: R.pill,
    borderWidth: 1.5, borderColor: C.borderCard,
    backgroundColor: C.bgWhite,
  },
  cancelBtnText:    { color: C.slate, fontWeight: '700', fontSize: 15 },
  saveBtn: {
    paddingHorizontal: S.xxl, paddingVertical: S.md,
    borderRadius: R.pill,
    backgroundColor: C.teal,
    minWidth: 140,
    alignItems: 'center',
  },
  saveBtnDisabled:  { opacity: 0.6 },
  saveBtnText:      { color: C.white, fontWeight: '800', fontSize: 15 },

  // Quick links
  quickLinks: { gap: S.xs },
  quickLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    paddingVertical: S.md,
    paddingHorizontal: S.lg,
    borderRadius: R.md,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
  },
  quickLinkIcon:  { fontSize: 11, fontWeight: '900', color: C.white, textAlign: 'center' as const },
  quickLinkIconWrap: { width: 28, height: 28, borderRadius: 6, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' },
  quickLinkText:  { flex: 1, fontSize: 15, fontWeight: '600', color: C.navy },
  quickLinkArrow: { fontSize: 20, color: C.slateLight, fontWeight: '300' },
});
