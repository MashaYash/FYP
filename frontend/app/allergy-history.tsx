import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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

function positiveCount(allergies?: Record<string, AllergyResult>) {
  if (!allergies) return 0;
  return Object.values(allergies).filter(a => a.result === 'positive').length;
}

function overallRisk(allergies?: Record<string, AllergyResult>): { label: string; color: string; bg: string; border: string } {
  const pos = positiveCount(allergies);
  const total = Object.keys(allergies ?? {}).length;
  if (pos === 0)           return { label: 'Clear',  color: C.success, bg: C.successBg,  border: '#6ee7b7' };
  if (pos / total > 0.5)  return { label: 'High',   color: C.danger,  bg: C.dangerBg,   border: C.dangerBorder };
  return                          { label: 'Medium', color: C.warning, bg: C.warningBg,  border: '#fde68a' };
}

function refNo(id: number) {
  return `RPT-${String(id).padStart(6, '0')}`;
}

// ── Allergy History Card ───────────────────────────────────────────────────────
function HistoryCard({ item, index }: { item: ReportRecord; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const allergies = item.report?.allergies ?? {};
  const positives = Object.entries(allergies).filter(([, v]) => v.result === 'positive');
  const negatives = Object.entries(allergies).filter(([, v]) => v.result === 'negative');
  const risk      = overallRisk(allergies);
  const pos       = positiveCount(allergies);
  const total     = Object.keys(allergies).length;

  return (
    <View style={styles.card}>
      {/* ── Card header ── */}
      <TouchableOpacity
        style={styles.cardHeader}
        onPress={() => setExpanded(e => !e)}
        accessibilityRole="button"
        accessibilityLabel={`Record ${index + 1}, ${formatDate(item.report_date)}`}
      >
        {/* Index circle */}
        <View style={styles.indexCircle}>
          <Text style={styles.indexText}>{index + 1}</Text>
        </View>

        {/* Meta */}
        <View style={styles.cardMeta}>
          {/* Row 1: ref + risk badge */}
          <View style={styles.cardMetaTop}>
            <Text style={styles.refNo}>{refNo(item.id)}</Text>
            <View style={[styles.riskBadge, { backgroundColor: risk.bg, borderColor: risk.border }]}>
              <View style={[styles.riskDot, { backgroundColor: risk.color }]} />
              <Text style={[styles.riskLabel, { color: risk.color }]}>{risk.label} Risk</Text>
            </View>
          </View>
          {/* Row 2: date */}
          <Text style={styles.cardDate}>{formatDate(item.report_date)}</Text>
          {/* Row 3: allergen summary */}
          <Text style={styles.cardSub}>
            {total} allergen{total !== 1 ? 's' : ''} tested
            {pos > 0 ? `  ·  ${pos} positive` : '  ·  All clear'}
          </Text>
        </View>

        {/* Chevron */}
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {/* ── Expanded body ── */}
      {expanded && (
        <View style={styles.cardBody}>
          <View style={styles.divider} />

          {/* Positive allergens */}
          {positives.length > 0 && (
            <View style={styles.allergenGroup}>
              <Text style={styles.groupLabel}>Positive Allergens</Text>
              {positives.map(([name, val]) => (
                <View key={name} style={styles.allergenRow}>
                  <View style={[styles.dot, { backgroundColor: C.danger }]} />
                  <Text style={styles.allergenName}>{name}</Text>
                  {val.wheal_diameter != null && (
                    <View style={styles.mmBadge}>
                      <Text style={styles.mmText}>{val.wheal_diameter} mm</Text>
                    </View>
                  )}
                  <View style={[styles.resultPill, { backgroundColor: C.dangerBg, borderColor: C.dangerBorder }]}>
                    <Text style={[styles.resultPillText, { color: C.danger }]}>Positive</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Negative allergens */}
          {negatives.length > 0 && (
            <View style={styles.allergenGroup}>
              <Text style={[styles.groupLabel, { color: C.success }]}>Negative Allergens</Text>
              <View style={styles.pillsRow}>
                {negatives.map(([name]) => (
                  <View key={name} style={styles.negativePill}>
                    <Text style={styles.negativePillText}>{name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {total === 0 && (
            <Text style={styles.noData}>No allergen data found in this record.</Text>
          )}

          {/* Footer meta */}
          <View style={styles.cardFooter}>
            <Text style={styles.footerItem}>Report Ref: <Text style={styles.footerBold}>{refNo(item.id)}</Text></Text>
            <Text style={styles.footerItem}>Saved: <Text style={styles.footerBold}>{formatDate(item.created_at)}</Text></Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function AllergyHistoryScreen() {
  const router    = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < 900;
  const BASE_URL  = getApiBaseUrl();

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<ReportRecord[]>([]);
  const [error,   setError]   = useState('');

  useEffect(() => {
    (async () => {
      const user = await UserStorage.getUser();
      if (!user?.id) { router.replace('/login'); return; }
      try {
        const res  = await fetch(`${BASE_URL}/reportHistory?user_id=${user.id}`);
        const data = await res.json();
        if (data.success) {
          setRecords(data.reports || []);
        } else {
          setError(data.message || 'Unable to load your allergy history.');
        }
      } catch {
        setError('Network error while loading history.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalPositive = records.reduce((sum, r) => sum + positiveCount(r.report?.allergies), 0);
  const mostRecent    = records.length > 0 ? formatDate(records[0].report_date) : '—';

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageContent}
      showsVerticalScrollIndicator={false}
    >
      <AppHeader activeTab="report" />

      {/* ── Banner ── */}
      <View style={[styles.banner, isCompact && styles.bannerSm]}>
        <View style={styles.bannerText}>
          <View style={styles.bannerBadge}>
            <View style={styles.bannerBadgeDot} />
            <Text style={styles.bannerBadgeLabel}>Allergy Records  ·  Risk Levels  ·  Report References</Text>
          </View>
          <Text style={[styles.bannerTitle, isCompact && styles.bannerTitleSm]}>
            Allergy{'\n'}History
          </Text>
          <Text style={[styles.bannerDesc, isCompact && styles.bannerDescSm]}>
            A complete log of every allergy test report you have uploaded. Each record shows the
            date, overall risk level, allergen breakdown, and a unique report reference number.
          </Text>
        </View>
      </View>

      <View style={[styles.body, isCompact && styles.bodySm]}>

        {/* ── Stats strip ── */}
        {!loading && records.length > 0 && (
          <View style={styles.statsStrip}>
            {[
              { val: String(records.length),  label: 'Total records' },
              { val: String(totalPositive),    label: 'Positive results' },
              { val: mostRecent,               label: 'Most recent test' },
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
            <Text style={styles.loadingText}>Loading your allergy history…</Text>
          </View>
        )}

        {/* ── Error ── */}
        {!loading && error !== '' && (
          <View style={styles.errorCard}>
            <View style={styles.errorDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => router.push('/front')} style={styles.errorAction}>
                <Text style={styles.errorActionText}>Upload a report →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Empty state ── */}
        {!loading && !error && records.length === 0 && (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconBox} />
            <Text style={styles.emptyTitle}>No history yet</Text>
            <Text style={styles.emptySub}>
              Upload your first allergy test report using the Report Analyser. Each processed
              report is automatically saved here.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/front')}>
              <Text style={styles.primaryBtnText}>Go to Report Analyser</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Records list ── */}
        {!loading && records.length > 0 && (
          <>
            <Text style={styles.listLabel}>
              {records.length} record{records.length !== 1 ? 's' : ''} found
            </Text>
            {records.map((item, i) => (
              <HistoryCard key={item.id} item={item} index={i} />
            ))}
          </>
        )}

        {/* ── Back button ── */}
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
  bannerSm:         { flexDirection: 'column', paddingHorizontal: S.lg, paddingTop: 32, paddingBottom: 32, gap: 24 },
  bannerText:       { flex: 1, gap: S.lg },
  bannerBadge:      { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  bannerBadgeDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: C.teal },
  bannerBadgeLabel: { fontSize: 12, fontWeight: '700', color: C.teal, letterSpacing: 1.2, textTransform: 'uppercase' },
  bannerTitle:      { fontSize: 52, fontWeight: '900', color: C.navy, lineHeight: 58, letterSpacing: -1 },
  bannerTitleSm:    { fontSize: 34, lineHeight: 40 },
  bannerDesc:       { fontSize: 15, color: C.slate, lineHeight: 25, maxWidth: 560 },
  bannerDescSm:     { fontSize: 14 },

  // ── Body ──
  body:    { paddingHorizontal: 48, paddingTop: S.xl, gap: S.lg },
  bodySm:  { paddingHorizontal: S.lg, paddingTop: S.lg },

  // ── Stats strip ──
  statsStrip: {
    flexDirection: 'row', flexWrap: 'wrap',
    backgroundColor: C.statBg,
    borderRadius: R.lg,
    padding: S.xl,
    justifyContent: 'space-around',
    gap: S.md,
  },
  statTile: { alignItems: 'center', gap: S.xs },
  statVal:  { fontSize: 26, fontWeight: '900', color: C.white },
  statLbl:  { fontSize: 12, color: 'rgba(255,255,255,0.72)', fontWeight: '500', textAlign: 'center' },

  // ── Loading / error / empty ──
  centreRow:   { alignItems: 'center', gap: S.sm, paddingVertical: S.xxl },
  loadingText: { fontSize: 14, color: C.slateLight },

  errorCard: {
    backgroundColor: C.dangerBg,
    borderRadius: R.md, borderWidth: 1, borderColor: C.dangerBorder,
    padding: S.lg, gap: S.md,
    flexDirection: 'row', alignItems: 'flex-start',
  },
  errorDot:       { width: 12, height: 12, borderRadius: 6, backgroundColor: C.danger, marginTop: 2 },
  errorText:      { color: C.danger, fontWeight: '600', fontSize: 14 },
  errorAction:    { marginTop: S.sm },
  errorActionText:{ color: C.teal, fontWeight: '700', fontSize: 13 },

  emptyCard: {
    backgroundColor: C.bgWhite,
    borderRadius: R.lg, borderWidth: 1, borderColor: C.border,
    padding: S.xxl, gap: S.md, alignItems: 'center',
  },
  emptyIconBox: {
    width: 64, height: 64, borderRadius: R.lg,
    backgroundColor: C.tealLight, borderWidth: 2, borderColor: C.tealMid,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: C.navy },
  emptySub:   { fontSize: 14, color: C.slateLight, textAlign: 'center', maxWidth: 360, lineHeight: 22 },

  primaryBtn: {
    backgroundColor: C.teal, borderRadius: R.pill,
    paddingHorizontal: S.xxl, paddingVertical: S.md, marginTop: S.sm,
  },
  primaryBtnText: { color: C.white, fontWeight: '700', fontSize: 14 },

  listLabel: {
    fontSize: 13, fontWeight: '700', color: C.slateLight,
    textTransform: 'uppercase', letterSpacing: 1,
  },

  // ── History card ──
  card: {
    backgroundColor: C.bgWhite,
    borderRadius: R.lg, borderWidth: 1, borderColor: C.borderCard,
    overflow: 'hidden',
    shadowColor: C.black, shadowOpacity: 0.04, shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: S.xl, gap: S.md,
  },
  indexCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.tealLight, borderWidth: 1.5, borderColor: C.tealMid,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  indexText: { fontSize: 14, fontWeight: '900', color: C.teal },

  cardMeta:    { flex: 1, gap: 4 },
  cardMetaTop: { flexDirection: 'row', alignItems: 'center', gap: S.sm, flexWrap: 'wrap' },
  refNo:       { fontSize: 13, fontWeight: '800', color: C.teal, letterSpacing: 0.5 },
  riskBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: R.pill, borderWidth: 1,
    paddingHorizontal: S.md, paddingVertical: 3,
  },
  riskDot:   { width: 7, height: 7, borderRadius: 4 },
  riskLabel: { fontSize: 12, fontWeight: '700' },

  cardDate: { fontSize: 16, fontWeight: '800', color: C.navy },
  cardSub:  { fontSize: 12, color: C.slateLight },

  chevron: { fontSize: 12, color: C.slateLight, fontWeight: '700', flexShrink: 0 },

  // ── Card body ──
  cardBody:    { paddingHorizontal: S.xl, paddingBottom: S.xl, gap: S.lg },
  divider:     { height: 1, backgroundColor: C.border, marginBottom: S.xs },

  allergenGroup: { gap: S.sm },
  groupLabel: {
    fontSize: 12, fontWeight: '700', color: C.danger,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  allergenRow: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    backgroundColor: C.bg,
    borderRadius: R.md, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: S.lg, paddingVertical: S.md,
  },
  dot:          { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  allergenName: { flex: 1, fontSize: 14, fontWeight: '600', color: C.navy },
  mmBadge: {
    backgroundColor: C.tealLight, borderRadius: R.pill,
    borderWidth: 1, borderColor: C.tealMid,
    paddingHorizontal: S.sm, paddingVertical: 2,
  },
  mmText:       { fontSize: 11, fontWeight: '700', color: C.teal },
  resultPill: {
    borderRadius: R.pill, borderWidth: 1,
    paddingHorizontal: S.sm, paddingVertical: 2,
  },
  resultPillText: { fontSize: 11, fontWeight: '700' },

  pillsRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  negativePill: {
    backgroundColor: C.successBg, borderRadius: R.pill,
    borderWidth: 1, borderColor: '#6ee7b7',
    paddingHorizontal: S.md, paddingVertical: 3,
  },
  negativePillText: { fontSize: 12, color: C.success, fontWeight: '600' },
  noData:           { fontSize: 13, color: C.slateXLight, fontStyle: 'italic' },

  cardFooter: {
    flexDirection: 'row', flexWrap: 'wrap', gap: S.xl,
    paddingTop: S.sm, borderTopWidth: 1, borderTopColor: C.border,
    marginTop: S.xs,
  },
  footerItem: { fontSize: 12, color: C.slateLight },
  footerBold: { fontWeight: '700', color: C.navy },

  // ── Back button ──
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
