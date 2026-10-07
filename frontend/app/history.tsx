import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';

import { AppHeader } from '@/components/app-header';
import { UserStorage } from '@/components/utils/storage';
import { getApiBaseUrl } from '@/constants/api';
import { C, R, S } from '@/constants/theme';
import { usePageTransition } from '@/hooks/use-page-transition';

// ── Types ─────────────────────────────────────────────────────────────────────
type AllergyResult = { result: string; wheal_diameter?: number };
type ReportRecord = {
  id: number;
  report_date: string;
  created_at: string;
  report: {
    patient?: Record<string, string>;
    allergies?: Record<string, AllergyResult>;
  };
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(raw: string) {
  try {
    return new Date(raw).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return raw; }
}

function riskColor(result: string) {
  if (result === 'positive') return C.danger;
  if (result === 'negative') return C.success;
  return C.slateXLight;
}

function positiveCount(allergies?: Record<string, AllergyResult>) {
  if (!allergies) return 0;
  return Object.values(allergies).filter(a => a.result === 'positive').length;
}

// ── Expandable report card ────────────────────────────────────────────────────
function ReportCard({ item, index }: { item: ReportRecord; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const allergies = item.report?.allergies ?? {};
  const positives = Object.entries(allergies).filter(([, v]) => v.result === 'positive');
  const negatives = Object.entries(allergies).filter(([, v]) => v.result === 'negative');
  const pos = positiveCount(allergies);

  return (
    <View style={styles.reportCard}>
      {/* Card header */}
      <TouchableOpacity
        style={styles.reportCardHeader}
        onPress={() => setExpanded(e => !e)}
        accessibilityRole="button"
        accessibilityLabel={`Report ${index + 1}, ${formatDate(item.report_date)}`}
      >
        <View style={styles.reportCardLeft}>
          <View style={styles.reportIndexCircle}>
            <Text style={styles.reportIndexText}>{index + 1}</Text>
          </View>
          <View style={styles.reportCardMeta}>
            <Text style={styles.reportCardDate}>
              {formatDate(item.report_date)}
            </Text>
            <Text style={styles.reportCardSub}>
              {Object.keys(allergies).length} allergens tested
            </Text>
          </View>
        </View>
        <View style={styles.reportCardRight}>
          {pos > 0 && (
            <View style={styles.positiveSummaryBadge}>
              <Text style={styles.positiveSummaryText}>{pos} positive</Text>
            </View>
          )}
          {pos === 0 && Object.keys(allergies).length > 0 && (
            <View style={styles.allClearBadge}>
              <Text style={styles.allClearText}>All clear</Text>
            </View>
          )}
          <Text style={styles.expandChevron}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>

      {/* Expanded detail */}
      {expanded && (
        <View style={styles.reportCardBody}>
          <View style={styles.divider} />

          {/* Positive allergens */}
          {positives.length > 0 && (
            <View style={styles.allergenSection}>
              <Text style={styles.allergenSectionLabel}>Positive Allergens</Text>
              {positives.map(([name, val]) => (
                <View key={name} style={styles.allergenRow}>
                  <View style={[styles.resultDot, { backgroundColor: riskColor('positive') }]} />
                  <Text style={styles.allergenName}>{name}</Text>
                  {val.wheal_diameter != null && (
                    <View style={styles.whealBadge}>
                      <Text style={styles.whealText}>{val.wheal_diameter} mm</Text>
                    </View>
                  )}
                  <View style={[styles.resultBadge, { backgroundColor: C.dangerBg, borderColor: C.dangerBorder }]}>
                    <Text style={[styles.resultBadgeText, { color: C.danger }]}>Positive</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Negative allergens */}
          {negatives.length > 0 && (
            <View style={styles.allergenSection}>
              <Text style={[styles.allergenSectionLabel, { color: C.success }]}>Negative Allergens</Text>
              <View style={styles.negativePillsRow}>
                {negatives.map(([name]) => (
                  <View key={name} style={styles.negativePill}>
                    <Text style={styles.negativePillText}>{name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* No data */}
          {Object.keys(allergies).length === 0 && (
            <Text style={styles.noDataText}>No allergen data found in this report.</Text>
          )}

          {/* Timestamp */}
          <Text style={styles.savedAt}>Saved: {formatDate(item.created_at)}</Text>
        </View>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function HistoryScreen() {
  const router   = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < 900;
  const BASE_URL  = getApiBaseUrl();

  const [loading,  setLoading]  = useState(true);
  const [reports,  setReports]  = useState<ReportRecord[]>([]);
  const [error,    setError]    = useState('');

  useEffect(() => {
    (async () => {
      const user = await UserStorage.getUser();
      if (!user?.id) { router.replace('/login'); return; }
      try {
        const res  = await fetch(`${BASE_URL}/reportHistory?user_id=${user.id}`);
        const data = await res.json();
        if (data.success) {
          setReports(data.reports || []);
        } else {
          setError(data.message || 'Unable to load your report history.');
        }
      } catch {
        setError('Network error while loading history.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalPositive = reports.reduce(
    (sum, r) => sum + positiveCount(r.report?.allergies), 0
  );

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageContent}
      showsVerticalScrollIndicator={false}
    >
      <AppHeader activeTab="report" />

      {/* ── Hero ── */}
      <View style={[styles.hero, isCompact && styles.heroSm]}>
        <Text style={styles.heroEyebrow}>Your Medical Records</Text>
        <Text style={[styles.heroTitle, isCompact && styles.heroTitleSm]}>
          Report History
        </Text>
        <Text style={[styles.heroSub, isCompact && styles.heroSubSm]}>
          Every allergy test report you've uploaded is saved here. Tap any card to view the full
          allergen breakdown, wheal measurements, and test dates.
        </Text>
      </View>

      <View style={[styles.body, isCompact && styles.bodySm]}>

        {/* ── Stats strip ── */}
        {!loading && reports.length > 0 && (
          <View style={styles.statsRow}>
            {[
              { val: String(reports.length), label: 'Total reports' },
              { val: String(totalPositive),  label: 'Positive results' },
              { val: formatDate(reports[0].report_date), label: 'Most recent test' },
            ].map(s => (
              <View key={s.label} style={styles.statTile}>
                <Text style={styles.statVal}>{s.val}</Text>
                <Text style={styles.statLbl}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Loading ── */}
        {loading && (
          <View style={styles.centreRow}>
            <ActivityIndicator size="large" color={C.teal} />
            <Text style={styles.loadingText}>Loading your history…</Text>
          </View>
        )}

        {/* ── Error ── */}
        {!loading && error !== '' && (
          <View style={styles.errorCard}>
            <View style={styles.errorIconDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => router.push('/front')} style={styles.errorAction}>
                <Text style={styles.errorActionText}>Upload a report →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Empty state ── */}
        {!loading && error === '' && reports.length === 0 && (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>No reports yet</Text>
            <Text style={styles.emptySub}>
              Upload your first allergy test report using the Report Analyser to see your history here.
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/front')}>
              <Text style={styles.emptyBtnText}>Go to Report Analyser</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Report list ── */}
        {!loading && reports.length > 0 && (
          <>
            <Text style={styles.listHeading}>
              {reports.length} report{reports.length !== 1 ? 's' : ''} found
            </Text>
            {reports.map((item, i) => (
              <ReportCard key={item.id} item={item} index={i} />
            ))}
          </>
        )}

        {/* ── Back link ── */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.push('/front')}>
          <Text style={styles.backBtnText}>← Back to Report Analyser</Text>
        </TouchableOpacity>

      </View>
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  page:        { flex: 1, backgroundColor: C.bg },
  pageContent: { paddingBottom: 56 },

  hero: {
    backgroundColor: C.bgWhite,
    paddingHorizontal: S.xxl + 8,
    paddingTop: S.xxl,
    paddingBottom: S.xxl,
    gap: S.md,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  heroSm:      { paddingHorizontal: S.lg, paddingTop: S.xl, paddingBottom: S.xl },
  heroEyebrow: { fontSize: 12, fontWeight: '700', color: C.teal, textTransform: 'uppercase', letterSpacing: 1.5 },
  heroTitle:   { fontSize: 36, fontWeight: '900', color: C.navy, lineHeight: 44 },
  heroTitleSm: { fontSize: 24, lineHeight: 32 },
  heroSub:     { fontSize: 15, color: C.slate, lineHeight: 24, maxWidth: 560 },
  heroSubSm:   { fontSize: 14 },

  body:    { paddingHorizontal: S.xxl + 8, paddingTop: S.xl, gap: S.lg },
  bodySm:  { paddingHorizontal: S.lg, paddingTop: S.lg },

  // Stats
  statsRow: {
    flexDirection: 'row', gap: S.md, flexWrap: 'wrap',
    backgroundColor: C.statBg,
    borderRadius: R.lg,
    padding: S.xl,
    justifyContent: 'space-around',
  },
  statTile:  { alignItems: 'center', gap: S.xs },
  statVal:   { fontSize: 26, fontWeight: '900', color: C.white },
  statLbl:   { fontSize: 12, color: 'rgba(255,255,255,0.72)', fontWeight: '500', textAlign: 'center' },

  // States
  centreRow:   { alignItems: 'center', gap: S.sm, paddingVertical: S.xxl },
  loadingText: { fontSize: 14, color: C.slateLight },

  errorCard: {
    backgroundColor: C.dangerBg,
    borderRadius: R.md, borderWidth: 1, borderColor: C.dangerBorder,
    padding: S.lg, gap: S.sm,
    flexDirection: 'row', alignItems: 'flex-start',
  },
  errorIconDot:     { width: 12, height: 12, borderRadius: 6, backgroundColor: C.danger, marginTop: 2 },
  errorText:        { color: C.danger, fontWeight: '600', fontSize: 14 },
  errorAction:      { marginTop: S.sm },
  errorActionText:  { color: C.teal, fontWeight: '700', fontSize: 13 },

  emptyCard: {
    backgroundColor: C.bgWhite,
    borderRadius: R.lg, borderWidth: 1, borderColor: C.border,
    padding: S.xxl, gap: S.md, alignItems: 'center',
  },
  emptyIcon:  { width: 56, height: 56, borderRadius: 12, backgroundColor: C.tealLight, borderWidth: 2, borderColor: C.tealMid },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: C.navy },
  emptySub:   { fontSize: 14, color: C.slateLight, textAlign: 'center', maxWidth: 340 },
  emptyBtn: {
    backgroundColor: C.teal, borderRadius: R.pill,
    paddingHorizontal: S.xxl, paddingVertical: S.md, marginTop: S.sm,
  },
  emptyBtnText: { color: C.white, fontWeight: '700', fontSize: 14 },

  listHeading: { fontSize: 13, fontWeight: '700', color: C.slateLight, textTransform: 'uppercase', letterSpacing: 1 },

  // Report card
  reportCard: {
    backgroundColor: C.bgWhite,
    borderRadius: R.lg, borderWidth: 1, borderColor: C.borderCard,
    overflow: 'hidden',
    shadowColor: C.black, shadowOpacity: 0.04, shadowRadius: 8,
    elevation: 2,
  },
  reportCardHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    padding: S.xl, gap: S.md,
  },
  reportCardLeft:     { flexDirection: 'row', alignItems: 'center', gap: S.md, flex: 1 },
  reportIndexCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.tealLight, borderWidth: 1.5, borderColor: C.tealMid,
    alignItems: 'center', justifyContent: 'center',
  },
  reportIndexText:    { fontSize: 14, fontWeight: '900', color: C.teal },
  reportCardMeta:     { gap: 2 },
  reportCardDate:     { fontSize: 16, fontWeight: '800', color: C.navy },
  reportCardSub:      { fontSize: 12, color: C.slateLight },
  reportCardRight:    { flexDirection: 'row', alignItems: 'center', gap: S.sm },

  positiveSummaryBadge: {
    backgroundColor: C.dangerBg, borderRadius: R.pill,
    borderWidth: 1, borderColor: C.dangerBorder,
    paddingHorizontal: S.md, paddingVertical: 3,
  },
  positiveSummaryText: { fontSize: 12, fontWeight: '700', color: C.danger },
  allClearBadge: {
    backgroundColor: C.successBg, borderRadius: R.pill,
    borderWidth: 1, borderColor: '#6ee7b7',
    paddingHorizontal: S.md, paddingVertical: 3,
  },
  allClearText:  { fontSize: 12, fontWeight: '700', color: C.success },
  expandChevron: { fontSize: 12, color: C.slateLight, fontWeight: '700' },

  reportCardBody: { paddingHorizontal: S.xl, paddingBottom: S.xl, gap: S.lg },
  divider:        { height: 1, backgroundColor: C.border, marginBottom: S.xs },

  allergenSection: { gap: S.sm },
  allergenSectionLabel: {
    fontSize: 12, fontWeight: '700', color: C.danger,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  allergenRow: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    backgroundColor: C.bg, borderRadius: R.md,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: S.lg, paddingVertical: S.md,
  },
  resultDot:   { width: 8, height: 8, borderRadius: 4 },
  allergenName:{ flex: 1, fontSize: 14, fontWeight: '600', color: C.navy },
  whealBadge: {
    backgroundColor: C.tealLight, borderRadius: R.pill,
    borderWidth: 1, borderColor: C.tealMid,
    paddingHorizontal: S.sm, paddingVertical: 2,
  },
  whealText:  { fontSize: 11, fontWeight: '700', color: C.teal },
  resultBadge:{
    borderRadius: R.pill, borderWidth: 1,
    paddingHorizontal: S.sm, paddingVertical: 2,
  },
  resultBadgeText: { fontSize: 11, fontWeight: '700' },

  negativePillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  negativePill: {
    backgroundColor: C.successBg, borderRadius: R.pill,
    borderWidth: 1, borderColor: '#6ee7b7',
    paddingHorizontal: S.md, paddingVertical: 3,
  },
  negativePillText: { fontSize: 12, color: C.success, fontWeight: '600' },
  noDataText:       { fontSize: 13, color: C.slateXLight, fontStyle: 'italic' },
  savedAt:          { fontSize: 11, color: C.slateXLight, marginTop: S.xs },

  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: S.md, paddingHorizontal: S.lg,
    borderRadius: R.pill,
    borderWidth: 1.5, borderColor: C.borderCard,
    backgroundColor: C.bgWhite,
    marginTop: S.sm,
  },
  backBtnText: { fontSize: 13, fontWeight: '700', color: C.slate },
});
