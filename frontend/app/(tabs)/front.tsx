import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import axios, { AxiosError } from 'axios';

import { AppHeader } from '@/components/app-header';
import { getApiBaseUrl } from '@/constants/api';
import { Storage, UserStorage } from '@/components/utils/storage';
import { cleanDisplayText } from '@/components/utils/formatDisplayText';
import { C, R, S } from '@/constants/theme';
import { NotificationPopup } from '@/components/ui/notification-popup';

// ── How-it-works steps ──────────────────────────────────────────────────────
const STEPS = [
  { n: '01', title: 'Upload',  desc: 'Take a photo or pick a PDF / image of your allergy test report.' },
  { n: '02', title: 'Extract', desc: 'Our OCR engine reads every value, allergen name, and result level.' },
  { n: '03', title: 'Analyse', desc: 'AI maps findings to cross-reactive foods and risk categories.' },
  { n: '04', title: 'Report',  desc: 'Receive a structured summary with clear action points.' },
];

export default function FrontScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < 900;
  const scrollRef = useRef<ScrollView>(null);

  const [uploadSectionY, setUploadSectionY] = useState(0);
  const [image,   setImage]   = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState('');
  const [done,    setDone]    = useState(false);
  const [actionPopup, setActionPopup] = useState<{ title: string; message: string } | null>(null);
  const [reportUploaded, setReportUploaded] = useState(false);

  const BASE_URL = getApiBaseUrl();
  const showActionPopup = (title: string, message: string) => setActionPopup({ title, message });

  // ── Delete data ─────────────────────────────────────────────────────────────
  const handleDeleteData = async () => {
    try {
      const id = await UserStorage.getUser().then(u => u?.id);
      if (!id) return;
      const res = await axios.post(`${BASE_URL}/deleteUserData`, { user_id: id });
      if (!res.data?.success) console.log('Delete failed:', res.data);
    } catch (error) {
      const err = error as AxiosError;
      console.log('Delete error:', err.response?.data || err.message);
    }
  };

  const handleDeletePress = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Delete all your stored data? This cannot be undone.')) handleDeleteData();
      return;
    }
    Alert.alert('Delete My Data', 'This will permanently remove all your stored data.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: handleDeleteData },
    ]);
  };

  // ── Picking ──────────────────────────────────────────────────────────────────
  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      showActionPopup('Camera permission needed', 'Allow camera access to take a photo of your report.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!res.canceled) { setImage(res.assets[0]); setDone(false); setSummary(''); }
  };

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 1 });
    if (!res.canceled) { setImage(res.assets[0]); setDone(false); setSummary(''); }
  };

  const handleWebUpload = (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    setImage({ uri: URL.createObjectURL(file), file });
    setDone(false);
    setSummary('');
  };

  // ── Process ──────────────────────────────────────────────────────────────────
  const processImage = async () => {
    if (!image) return;
    setLoading(true);
    setSummary('');
    setDone(false);

    const formData = new FormData();
    if (Platform.OS === 'web') {
      formData.append('file', image.file);
    } else {
      formData.append('file', { uri: image.uri, name: 'image.jpg', type: 'image/jpeg' } as any);
    }

    const token = await Storage.getToken();
    const id    = await UserStorage.getUser().then(u => u?.id);
    if (!token) {
      setLoading(false);
      showActionPopup('Sign in required', 'Please sign in again before analyzing a report.');
      return;
    }

    formData.append('user_token', token);
    formData.append('user_id',    String(id));

    try {
      const res  = await fetch(`${BASE_URL}/imageToText`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || 'Unable to process selected file.');
      setSummary(cleanDisplayText(data.summary || data.text || 'No summary available.'));
      setDone(true);
      setReportUploaded(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error processing image.';
      setSummary(message);
      showActionPopup('Could not analyze report', message);
    }
    setLoading(false);
  };

  const handleRun = async () => {
    if (!image) {
      showActionPopup('Report needed', 'Upload a report file before running the analysis.');
      return;
    }
    await processImage();
    scrollRef.current?.scrollTo({ y: uploadSectionY + 400, animated: true });
  };

  // ── UI ────────────────────────────────────────────────────────────────────────
  return (
    <>
    <ScrollView
      ref={scrollRef}
      style={styles.page}
      contentContainerStyle={styles.pageContent}
      showsVerticalScrollIndicator={false}
    >
      <AppHeader activeTab="report" />

      {/* ── TOP BANNER ── */}
      <View style={[styles.banner, isCompact && styles.bannerSm]}>
        {/* Left text block */}
        <View style={styles.bannerText}>
          <View style={styles.bannerBadge}>
            <View style={styles.bannerBadgeDot} />
            <Text style={styles.bannerBadgeLabel}>OCR  ·  AI Analysis  ·  Risk Mapping</Text>
          </View>
          <Text style={[styles.bannerTitle, isCompact && styles.bannerTitleSm]}>
            Report{'\n'}Analyser
          </Text>
          <Text style={[styles.bannerDesc, isCompact && styles.bannerDescSm]}>
            Drop your skin-prick test report and get a structured breakdown of allergen levels,
            risk categories, and cross-reactive foods — in seconds.
          </Text>
          <TouchableOpacity
            style={styles.bannerCta}
            onPress={() => scrollRef.current?.scrollTo({ y: uploadSectionY, animated: true })}
            accessibilityRole="button"
          >
            <Text style={styles.bannerCtaText}>Upload Report ↓</Text>
          </TouchableOpacity>
        </View>

        {/* Right — report image */}
        {!isCompact && (
          <Image
            source={require('../../assets/images/report.png')}
            style={styles.bannerImage}
            contentFit="contain"
            accessibilityLabel="Report analyser illustration"
          />
        )}
      </View>

      {/* ── HOW IT WORKS ── */}
      <View style={[styles.section, isCompact && styles.sectionSm]}>
        <Text style={styles.sectionEye}>Process</Text>
        <Text style={[styles.sectionTitle, isCompact && styles.sectionTitleSm]}>
          From photo to insight in 4 steps
        </Text>
        <View style={[styles.stepsRow, isCompact && styles.stepsCol]}>
          {STEPS.map((step, i) => (
            <View key={step.n} style={styles.stepCard}>
              {/* Step connector line */}
              {i < STEPS.length - 1 && !isCompact && <View style={styles.stepConnector} />}
              <View style={styles.stepNumWrap}>
                <Text style={styles.stepNum}>{step.n}</Text>
              </View>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDesc}>{step.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── UPLOAD WORKSPACE ── */}
      <View
        style={[styles.section, isCompact && styles.sectionSm]}
        onLayout={e => setUploadSectionY(e.nativeEvent.layout.y)}
      >
        <Text style={styles.sectionEye}>Step 1</Text>
        <Text style={[styles.sectionTitle, isCompact && styles.sectionTitleSm]}>
          Upload your report
        </Text>

        <View style={[styles.uploadRow, isCompact && styles.uploadCol]}>
          {/* Drop zone */}
          <View style={styles.dropZone}>
            <View style={styles.dropZoneInner}>
              <Text style={styles.dropZoneIcon}>📂</Text>
              <Text style={styles.dropZoneTitle}>Drop your file here</Text>
              <Text style={styles.dropZoneTypes}>Supports PDF · JPG · PNG · DOCX</Text>

              {Platform.OS === 'web' ? (
                <View style={styles.webInputWrap}>
                  <input
                    type="file"
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={handleWebUpload}
                    style={{
                      marginTop: 12,
                      padding: '8px 16px',
                      borderRadius: 20,
                      border: '1.5px solid #0d8fa1',
                      color: '#0d8fa1',
                      backgroundColor: '#e8f8fa',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  />
                </View>
              ) : (
                <View style={[styles.nativeBtns, isCompact && styles.nativeBtnsCol]}>
                  <TouchableOpacity style={styles.nativeBtn} onPress={takePhoto} accessibilityRole="button">
                    <Text style={styles.nativeBtnIcon}>Cam</Text>
                    <Text style={styles.nativeBtnText}>Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.nativeBtn} onPress={pickImage} accessibilityRole="button">
                    <Text style={styles.nativeBtnIcon}>Lib</Text>
                    <Text style={styles.nativeBtnText}>Gallery</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* File status strip */}
            {image && (
              <View style={styles.fileStrip}>
                <View style={styles.fileStripDot} />
                <Text style={styles.fileStripText} numberOfLines={1}>
                  File ready · tap Analyse to process
                </Text>
              </View>
            )}
          </View>

          {/* Preview panel */}
          <View style={styles.previewPanel}>
            {image ? (
              <Image
                source={{ uri: image.uri }}
                style={styles.previewImg}
                contentFit="contain"
                accessibilityLabel="Uploaded report preview"
              />
            ) : (
              <View style={styles.previewEmpty}>
                <Text style={styles.previewEmptyIcon}>🖼️</Text>
                <Text style={styles.previewEmptyText}>Preview appears here</Text>
              </View>
            )}
          </View>
        </View>

        {/* Analyse button + delete */}
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={[styles.analyseBtn, (!image || loading) && styles.analyseBtnDisabled]}
            onPress={handleRun}
            disabled={!image || loading}
            accessibilityRole="button"
          >
            {loading
              ? <><ActivityIndicator size="small" color={C.white} /><Text style={styles.analyseBtnText}> Analysing…</Text></>
              : <Text style={styles.analyseBtnText}>Run Analysis</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDeletePress} accessibilityRole="button">
            <Text style={styles.deleteBtnText}>Clear My Data</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── RESULTS ── */}
      <View style={[styles.section, isCompact && styles.sectionSm]}>
        <View style={styles.resultsHeader}>
          <View>
            <Text style={styles.sectionEye}>Step 2</Text>
            <Text style={[styles.sectionTitle, isCompact && styles.sectionTitleSm]}>
              Analysis Results
            </Text>
          </View>
          {done && (
            <View style={styles.doneBadge}>
              <Text style={styles.doneBadgeText}>Complete</Text>
            </View>
          )}
        </View>

        <View style={styles.resultBox}>
          {loading && (
            <View style={styles.resultLoading}>
              <ActivityIndicator size="large" color={C.teal} />
              <Text style={styles.resultLoadingText}>Reading your report…</Text>
            </View>
          )}
          {!loading && !summary && (
            <View style={styles.resultEmpty}>
              <Text style={styles.resultEmptyTitle}>No results yet</Text>
              <Text style={styles.resultEmptyDesc}>Upload a report and run the analysis above.</Text>
            </View>
          )}
          {!loading && !!summary && (
            <View style={styles.resultContent}>
              <View style={styles.resultContentHeader}>
                <View style={styles.resultContentDot} />
                <Text style={styles.resultContentLabel}>AI-Generated Summary</Text>
              </View>
              {summary.split('\n').map((line, i) => {
                const trimmed = line.trim();
                if (!trimmed) return <View key={i} style={{ height: 6 }} />;

                // POSITIVE: allergen line — red highlighted card
                if (/^POSITIVE:/i.test(trimmed)) {
                  return (
                    <View key={i} style={styles.positiveLineWrap}>
                      <Text style={styles.positiveLineText}>{trimmed}</Text>
                    </View>
                  );
                }

                // Section heading line ending with colon (e.g. "Your Allergy Overview:")
                if (/^[A-Z][^a-z]{0,4}.*:$/.test(trimmed) || /^(Your |POSITIVE |Negative |What |Action )/i.test(trimmed) && trimmed.endsWith(':')) {
                  return <Text key={i} style={styles.sectionHeadingText}>{trimmed}</Text>;
                }

                return <Text key={i} style={styles.regularLineText}>{trimmed}</Text>;
              })}
            </View>
          )}
        </View>
      </View>

    </ScrollView>
      <Modal
        transparent
        visible={actionPopup !== null}
        animationType="fade"
        onRequestClose={() => setActionPopup(null)}
      >
        <View style={styles.popupBackdrop}>
          <View style={styles.popupCard}>
            <Text style={styles.popupTitle}>{actionPopup?.title}</Text>
            <Text style={styles.popupMessage}>{actionPopup?.message}</Text>
            <Pressable
              style={styles.popupButton}
              onPress={() => setActionPopup(null)}
              accessibilityRole="button"
            >
              <Text style={styles.popupButtonText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <NotificationPopup
        visible={reportUploaded}
        title="Report uploaded"
        message="Your report has been analyzed successfully. The results are ready below."
        onClose={() => setReportUploaded(false)}
      />
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  page:        { flex: 1, backgroundColor: C.bg },
  pageContent: { paddingBottom: 56 },

  // ── Banner ──
  banner: {
    backgroundColor: C.tealSoft,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 48,
    paddingTop: 48,
    paddingBottom: 48,
    gap: 40,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  bannerSm: { flexDirection: 'column', paddingHorizontal: S.lg, paddingTop: 32, paddingBottom: 32, gap: 24 },

  bannerText:    { flex: 1, gap: S.lg },
  bannerBadge:   { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  bannerBadgeDot:{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.teal },
  bannerBadgeLabel: { fontSize: 12, fontWeight: '700', color: C.teal, letterSpacing: 1.2, textTransform: 'uppercase' },

  bannerTitle:   { fontSize: 52, fontWeight: '900', color: C.navy, lineHeight: 58, letterSpacing: -1 },
  bannerTitleSm: { fontSize: 34, lineHeight: 40 },
  bannerDesc:    { fontSize: 15, color: C.slate, lineHeight: 25, maxWidth: 440 },
  bannerDescSm:  { fontSize: 14 },
  bannerCta: {
    alignSelf: 'flex-start',
    backgroundColor: C.teal,
    paddingHorizontal: S.xl, paddingVertical: S.md,
    borderRadius: R.pill,
  },
  bannerCtaText: { color: C.white, fontWeight: '800', fontSize: 14 },

  bannerImage: {
    width: 320,
    height: 260,
    borderRadius: R.lg,
  },

  // ── Sections ──
  section:      { paddingHorizontal: 48, paddingTop: 24, paddingBottom: 8, gap: S.xl },
  sectionSm:    { paddingHorizontal: S.lg, paddingTop: 16 },
  sectionEye: {
    fontSize: 11, fontWeight: '800', color: C.teal,
    textTransform: 'uppercase', letterSpacing: 2,
  },
  sectionTitle:   { fontSize: 28, fontWeight: '900', color: C.navy, lineHeight: 44, marginTop: S.sm },
  sectionTitleSm: { fontSize: 22, lineHeight: 34 },

  // ── Steps ──
  stepsRow: { flexDirection: 'row', gap: S.lg },
  stepsCol: { flexDirection: 'column' },
  stepCard: {
    flex: 1,
    backgroundColor: C.bgWhite,
    borderRadius: R.lg, borderWidth: 1, borderColor: C.borderCard,
    padding: S.xl, gap: S.sm,
    shadowColor: C.black, shadowOpacity: 0.04, shadowRadius: 8,
    elevation: 2,
    position: 'relative',
    overflow: 'visible',
  },
  stepConnector: {
    position: 'absolute',
    right: -S.lg - 1,
    top: '50%' as any,
    width: S.lg * 2,
    height: 2,
    backgroundColor: C.tealMid,
    zIndex: 1,
  },
  stepNumWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.teal,
    alignItems: 'center', justifyContent: 'center',
  },
  stepNum:   { fontSize: 12, fontWeight: '900', color: C.white },
  stepTitle: { fontSize: 16, fontWeight: '800', color: C.navy },
  stepDesc:  { fontSize: 13, color: C.slate, lineHeight: 20 },

  // ── Upload ──
  uploadRow: { flexDirection: 'row', gap: S.xl },
  uploadCol: { flexDirection: 'column' },

  dropZone: {
    flex: 1,
    backgroundColor: C.bgWhite,
    borderRadius: R.lg, borderWidth: 1, borderColor: C.borderCard,
    overflow: 'hidden', minHeight: 240,
    shadowColor: C.black, shadowOpacity: 0.04, shadowRadius: 8,
    elevation: 2,
  },
  dropZoneInner: {
    padding: S.xl, gap: S.md,
    alignItems: 'center',
    borderWidth: 2, borderStyle: 'dashed', borderColor: C.teal,
    borderRadius: R.md, margin: S.sm,
    backgroundColor: C.tealLight,
    minHeight: 200, justifyContent: 'center',
  },
  dropZoneIcon:  { fontSize: 40 },
  dropZoneTitle: { fontSize: 16, fontWeight: '700', color: C.navy },
  dropZoneTypes: { fontSize: 12, color: C.slateLight },
  webInputWrap:  { alignItems: 'center' },

  nativeBtns:    { flexDirection: 'row', gap: S.md, marginTop: S.sm },
  nativeBtnsCol: { flexDirection: 'column', width: '100%' },
  nativeBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm,
    backgroundColor: C.bgWhite,
    borderRadius: R.pill, borderWidth: 1.5, borderColor: C.teal,
    paddingHorizontal: S.lg, paddingVertical: S.md,
  },
  nativeBtnIcon: { fontSize: 12, fontWeight: '800', color: C.teal },
  nativeBtnText: { color: C.teal, fontWeight: '700', fontSize: 14 },

  fileStrip: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    backgroundColor: C.successBg,
    paddingHorizontal: S.lg, paddingVertical: S.sm,
    borderTopWidth: 1, borderTopColor: '#6ee7b7',
  },
  fileStripDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: C.success },
  fileStripText: { fontSize: 13, color: C.success, fontWeight: '600', flex: 1 },

  previewPanel: {
    width: 280,
    backgroundColor: C.bgWhite,
    borderRadius: R.lg, borderWidth: 1, borderColor: C.borderCard,
    overflow: 'hidden', minHeight: 240,
    shadowColor: C.black, shadowOpacity: 0.04, shadowRadius: 8,
    elevation: 2,
  },
  previewImg:   { width: '100%', height: '100%', minHeight: 240 },
  previewEmpty: { flex: 1, minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: S.sm, backgroundColor: C.bg },
  previewEmptyIcon: { fontSize: 40, opacity: 0.3 },
  previewEmptyText: { fontSize: 13, color: C.slateXLight },

  actionBar: {
    flexDirection: 'row', gap: S.md, alignItems: 'center', flexWrap: 'wrap',
  },
  analyseBtn: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    backgroundColor: C.teal,
    borderRadius: R.pill,
    paddingHorizontal: S.xxl, paddingVertical: S.lg,
    shadowColor: C.teal, shadowOpacity: 0.3, shadowRadius: 10,
    elevation: 4,
  },
  analyseBtnDisabled: { opacity: 0.45, shadowOpacity: 0 },
  analyseBtnText:     { color: C.white, fontWeight: '800', fontSize: 16 },

  deleteBtn: {
    borderRadius: R.pill,
    borderWidth: 1.5, borderColor: C.dangerBorder,
    paddingHorizontal: S.xl, paddingVertical: S.lg,
    backgroundColor: C.dangerBg,
  },
  deleteBtnText: { color: C.danger, fontWeight: '700', fontSize: 14 },

  // ── Results ──
  resultsHeader: {
    flexDirection: 'row', alignItems: 'flex-end',
    justifyContent: 'space-between', flexWrap: 'wrap', gap: S.md,
  },
  doneBadge: {
    backgroundColor: C.successBg,
    borderRadius: R.pill, borderWidth: 1, borderColor: '#6ee7b7',
    paddingHorizontal: S.lg, paddingVertical: S.sm,
  },
  doneBadgeText: { color: C.success, fontWeight: '800', fontSize: 13 },

  resultBox: {
    backgroundColor: C.bgWhite,
    borderRadius: R.lg, borderWidth: 1, borderColor: C.borderCard,
    minHeight: 220, overflow: 'hidden',
    shadowColor: C.black, shadowOpacity: 0.04, shadowRadius: 8,
    elevation: 2,
  },
  resultLoading: { flex: 1, minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: S.md },
  resultLoadingText: { color: C.slateLight, fontSize: 14, fontWeight: '500' },

  resultEmpty: { flex: 1, minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: S.sm },
  resultEmptyIcon:  {},
  resultEmptyTitle: { fontSize: 16, fontWeight: '700', color: C.navy },
  resultEmptyDesc:  { fontSize: 13, color: C.slateXLight, textAlign: 'center', maxWidth: 260 },

  resultContent: { padding: S.xl, gap: S.lg },
  resultContentHeader: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    paddingBottom: S.md, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  resultContentDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: C.teal },
  resultContentLabel: { fontSize: 12, fontWeight: '700', color: C.teal, textTransform: 'uppercase', letterSpacing: 1.2 },
  resultText:         { fontSize: 15, color: C.navy, lineHeight: 26 },

  // Positive allergen highlight line
  positiveLineWrap: {
    backgroundColor: '#fff1f2',
    borderLeftWidth: 4, borderLeftColor: C.danger,
    borderRadius: R.sm,
    paddingHorizontal: S.md, paddingVertical: S.sm,
    marginVertical: 3,
  },
  positiveLineText: {
    fontSize: 15, fontWeight: '800', color: C.danger, lineHeight: 24,
  },
  // Section heading line (e.g. "Your Allergy Overview:")
  sectionHeadingText: {
    fontSize: 15, fontWeight: '800', color: C.navy, lineHeight: 26,
    marginTop: S.sm,
  },
  // Regular summary line
  regularLineText: { fontSize: 15, color: C.navy, lineHeight: 26 },

  popupBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(14, 34, 68, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: S.xl,
  },
  popupCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: C.bgWhite,
    borderRadius: R.lg,
    padding: S.xl,
    gap: S.md,
    borderWidth: 1,
    borderColor: C.borderCard,
  },
  popupTitle: { fontSize: 19, fontWeight: '800', color: C.navy },
  popupMessage: { fontSize: 15, lineHeight: 22, color: C.slate },
  popupButton: {
    alignSelf: 'flex-end',
    marginTop: S.sm,
    backgroundColor: C.teal,
    borderRadius: R.pill,
    paddingHorizontal: S.xl,
    paddingVertical: S.sm,
  },
  popupButtonText: { color: C.white, fontSize: 14, fontWeight: '700' },
});
