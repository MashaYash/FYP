import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { AppHeader } from '@/components/app-header';
import { getApiBaseUrl } from '@/constants/api';
import { cleanDisplayText } from '@/components/utils/formatDisplayText';
import { C, R, S } from '@/constants/theme';

// ── Types ─────────────────────────────────────────────────────────────────────
type CrossAllergenItem = {
  primary?: string;
  risk?: string;
  cross_reactive?: string[];
  notes?: string;
  in_knowledge_base?: boolean;
};

type PredictedFood = {
  food: string;
  likelihood: number;
  reason?: string;
};

// ── Risk colour helper ─────────────────────────────────────────────────────────
function riskColor(risk?: string): string {
  const r = (risk ?? '').toLowerCase();
  if (r.includes('high'))   return C.danger;
  if (r.includes('medium') || r.includes('moderate')) return C.warning;
  return C.success;
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function CrossAllergenScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < 900;
  const BASE_URL  = getApiBaseUrl();

  const [loading,       setLoading]       = useState(true);
  const [errorMessage,  setErrorMessage]  = useState('');
  const [crossAllergens,setCrossAllergens]= useState<CrossAllergenItem[]>([]);

  const [predictQuery,  setPredictQuery]  = useState('');
  const [predicting,    setPredicting]    = useState(false);
  const [predictMessage,setPredictMessage]= useState('');
  const [predictions,   setPredictions]  = useState<PredictedFood[]>([]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchCrossAllergens = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${BASE_URL}/crossAllergens`);
      const data = await res.json();
      if (!data.success) {
        setErrorMessage(data.message || 'Please upload and process a report first.');
        setCrossAllergens([]);
      } else {
        setCrossAllergens(data.cross_allergens || []);
        setErrorMessage('');
      }
    } catch {
      setErrorMessage('Network error while loading cross allergens.');
    } finally {
      setLoading(false);
    }
  }, [BASE_URL]);

  useFocusEffect(useCallback(() => { fetchCrossAllergens(); }, [fetchCrossAllergens]));

  // ── Clear report ───────────────────────────────────────────────────────────
  const clearReport = async () => {
    try {
      const res  = await fetch(`${BASE_URL}/clearReport`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) { setErrorMessage(data?.message || 'Failed to clear report.'); return; }
      setCrossAllergens([]);
      setErrorMessage('Report cleared. Upload and process a new report.');
    } catch {
      setErrorMessage('Network error while clearing report.');
    }
  };

  // ── ML predict ─────────────────────────────────────────────────────────────
  const runPrediction = async () => {
    const query = predictQuery.trim();
    if (!query) { setPredictMessage('Enter a food or allergen to predict.'); setPredictions([]); return; }
    setPredicting(true); setPredictMessage(''); setPredictions([]);
    try {
      const res  = await fetch(`${BASE_URL}/predictCrossAllergy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, top_k: 6 }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setPredictMessage(data?.detail || data?.message || 'Prediction failed.'); return; }
      const next = (data.predictions || []) as PredictedFood[];
      setPredictions(next);
      if (next.length === 0) setPredictMessage('No likely cross-reactive foods could be predicted.');
    } catch {
      setPredictMessage('Network error while running prediction.');
    } finally {
      setPredicting(false);
    }
  };

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageContent}
      showsVerticalScrollIndicator={false}
    >
      <AppHeader activeTab="cross" />

      {/* ── TOP BANNER ── */}
      <View style={[styles.banner, isCompact && styles.bannerSm]}>
        <View style={styles.bannerText}>
          <View style={styles.bannerBadge}>
            <View style={styles.bannerBadgeDot} />
            <Text style={styles.bannerBadgeLabel}>Cross-Reactivity  ·  Risk Mapping  ·  Food Safety</Text>
          </View>
          <Text style={[styles.bannerTitle, isCompact && styles.bannerTitleSm]}>
            Cross-Allergen{'\n'}Detection
          </Text>
          <Text style={[styles.bannerDesc, isCompact && styles.bannerDescSm]}>
            We map hidden food cross-reactivity patterns based on your report and highlight the safest
            choices for your daily life.
          </Text>
          <TouchableOpacity
            style={styles.bannerCta}
            onPress={fetchCrossAllergens}
            accessibilityRole="button"
          >
            <Text style={styles.bannerCtaText}>View My Results ↓</Text>
          </TouchableOpacity>
        </View>
        {!isCompact && (
          <Image
            source={require('../../assets/images/cross.png')}
            style={styles.bannerImage}
            resizeMode="contain"
            accessibilityLabel="Cross allergen illustration"
          />
        )}
      </View>

      <View style={[styles.body, isCompact && styles.bodySm]}>

        {/* ── Actions ── */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.outlineBtn} onPress={clearReport} accessibilityRole="button">
            <Text style={styles.outlineBtnText}>Clear Report</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} onPress={fetchCrossAllergens} accessibilityRole="button">
            <Text style={styles.primaryBtnText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {/* ── Loading ── */}
        {loading && (
          <View style={styles.centreRow}>
            <ActivityIndicator size="large" color={C.teal} />
            <Text style={styles.loadingText}>Loading allergen data…</Text>
          </View>
        )}

        {/* ── Error ── */}
        {!loading && errorMessage !== '' && (
          <View style={styles.errorCard}>
            <View style={styles.errorIconDot} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* ── Allergen cards ── */}
        {!loading && errorMessage === '' && (
          <>
            {crossAllergens.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>🔍</Text>
                <Text style={styles.emptyText}>No cross allergens found.</Text>
                <Text style={styles.emptySub}>Upload and process a report to see your data.</Text>
              </View>
            ) : (
              crossAllergens.map((item, index) => {
                const foods = (item.cross_reactive || []).filter(f => f && f.toLowerCase() !== 'nan');
                const inKb  = item.in_knowledge_base !== false && foods.length > 0;
                const rc    = riskColor(item.risk);
                return (
                  <View key={`${item.primary}-${index}`} style={styles.allergenCard}>
                    <View style={styles.allergenHeader}>
                      <Text style={styles.allergenTitle}>{item.primary || `Allergen ${index + 1}`}</Text>
                      {inKb && item.risk ? (
                        <View style={[styles.riskBadge, { backgroundColor: rc + '22', borderColor: rc + '55' }]}>
                          <Text style={[styles.riskText, { color: rc }]}>{item.risk} Risk</Text>
                        </View>
                      ) : !inKb ? (
                        <View style={[styles.riskBadge, { backgroundColor: C.warning + '22', borderColor: C.warning + '55' }]}>
                          <Text style={[styles.riskText, { color: C.warning }]}>Not in knowledge base</Text>
                        </View>
                      ) : null}
                    </View>

                    <Text style={styles.allergenLabel}>Cross-Reactive Foods</Text>
                    <View style={styles.foodsWrap}>
                      {foods.length > 0
                        ? foods.map((food, i) => (
                            <View key={`${food}-${i}`} style={styles.foodPill}>
                              <Text style={styles.foodPillText}>{food}</Text>
                            </View>
                          ))
                        : <Text style={styles.noFoods}>
                            {inKb ? 'No items listed' : 'No mapped foods yet for this allergen.'}
                          </Text>
                      }
                    </View>

                    {item.notes ? (
                      <Text style={styles.allergenNotes}>
                        <Text style={styles.allergenLabel}>Notes: </Text>
                        {cleanDisplayText(item.notes)}
                      </Text>
                    ) : null}
                  </View>
                );
              })
            )}

          </>
        )}

        {/* ── ML Prediction ── */}
        {!loading && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>ML Cross-Allergy Predictor</Text>
            <Text style={styles.cardSub}>
              Enter any food or allergen — our trained model predicts which cross-reactive foods are
              most likely, even if they're not in your report.
            </Text>

            <TextInput
              style={styles.predictInput}
              value={predictQuery}
              onChangeText={setPredictQuery}
              placeholder="e.g. chickpea, shellfish, buckwheat"
              placeholderTextColor={C.slateXLight}
              accessibilityLabel="Food or allergen to predict"
              onSubmitEditing={runPrediction}
            />

            <TouchableOpacity
              style={[styles.primaryBtn, styles.predictButton, predicting && styles.btnDisabled]}
              onPress={runPrediction}
              disabled={predicting}
              accessibilityRole="button"
            >
              {predicting
                ? <ActivityIndicator size="small" color={C.white} />
                : <Text style={styles.primaryBtnText}>Predict Likely Foods</Text>
              }
            </TouchableOpacity>

            {predictMessage ? <Text style={styles.predictMsg}>{predictMessage}</Text> : null}

            {predictions.length > 0 && (
              <View style={styles.predictList}>
                {predictions.map((item, i) => (
                  <View key={`${item.food}-${i}`} style={styles.predictItem}>
                    <View style={styles.predictItemLeft}>
                      <Text style={styles.predictFood}>{item.food}</Text>
                      {item.reason ? <Text style={styles.predictReason}>{item.reason}</Text> : null}
                    </View>
                    <View style={styles.likelihoodBadge}>
                      <Text style={styles.likelihoodText}>{item.likelihood}%</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page:        { flex: 1, backgroundColor: C.bg },
  pageContent: { paddingBottom: 48 },

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

  bannerText:       { flex: 1, gap: S.lg },
  bannerBadge:      { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  bannerBadgeDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: C.teal },
  bannerBadgeLabel: { fontSize: 12, fontWeight: '700', color: C.teal, letterSpacing: 1.2, textTransform: 'uppercase' },
  bannerTitle:      { fontSize: 52, fontWeight: '900', color: C.navy, lineHeight: 58, letterSpacing: -1 },
  bannerTitleSm:    { fontSize: 34, lineHeight: 40 },
  bannerDesc:       { fontSize: 15, color: C.slate, lineHeight: 25, maxWidth: 440 },
  bannerDescSm:     { fontSize: 14 },
  bannerCta: {
    alignSelf: 'flex-start',
    backgroundColor: C.teal,
    paddingHorizontal: S.xl, paddingVertical: S.md,
    borderRadius: R.pill,
  },
  bannerCtaText: { color: C.white, fontWeight: '800', fontSize: 14 },
  bannerImage:   { width: 320, height: 260, borderRadius: R.lg },

  // Body
  body:    { paddingHorizontal: S.xxl + 8, paddingTop: S.xl, gap: S.lg },
  bodySm:  { paddingHorizontal: S.lg, paddingTop: S.lg },

  // Actions
  actionsRow:     { flexDirection: 'row', gap: S.md, justifyContent: 'flex-end' },
  outlineBtn: {
    borderWidth: 1.5, borderColor: C.borderCard,
    borderRadius: R.pill,
    paddingHorizontal: S.lg, paddingVertical: S.md,
    backgroundColor: C.bgWhite,
  },
  outlineBtnText: { color: C.slate, fontWeight: '700', fontSize: 13 },
  primaryBtn: {
    backgroundColor: C.teal,
    borderRadius: R.pill,
    paddingHorizontal: S.lg, paddingVertical: S.md,
  },
  predictButton: { alignSelf: 'flex-start' },
  primaryBtnText: { color: C.white, fontWeight: '700', fontSize: 13 },
  btnDisabled:    { opacity: 0.6 },

  // States
  centreRow:   { alignItems: 'center', gap: S.sm, paddingVertical: S.xl },
  loadingText: { fontSize: 14, color: C.slateLight },
  errorCard: {
    backgroundColor: C.dangerBg,
    borderRadius: R.md,
    borderWidth: 1, borderColor: C.dangerBorder,
    padding: S.lg, gap: S.sm,
    flexDirection: 'row', alignItems: 'center',
  },
  errorIconDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.danger, marginTop: 2, flexShrink: 0 },
  errorText:   { flex: 1, color: C.danger, fontWeight: '600', fontSize: 14 },
  emptyCard: {
    backgroundColor: C.bgWhite,
    borderRadius: R.md,
    borderWidth: 1, borderColor: C.border,
    padding: S.xl, gap: S.sm,
    alignItems: 'center',
  },
  emptyIcon:   { fontSize: 32 },
  emptyText:   { fontSize: 16, fontWeight: '700', color: C.navy },
  emptySub:    { fontSize: 13, color: C.slateLight, textAlign: 'center' },

  // Allergen card
  allergenCard: {
    backgroundColor: C.bgWhite,
    borderRadius: R.lg,
    borderWidth: 1, borderColor: C.borderCard,
    padding: S.xxl, gap: S.lg,
    shadowColor: C.black, shadowOpacity: 0.04, shadowRadius: 8,
    elevation: 2,
  },
  allergenHeader: { flexDirection: 'row', alignItems: 'center', gap: S.md, flexWrap: 'wrap' },
  allergenTitle:  { fontSize: 23, fontWeight: '800', color: C.navy, flex: 1 },
  riskBadge: {
    borderRadius: R.pill,
    borderWidth: 1,
    paddingHorizontal: S.md, paddingVertical: 3,
  },
  riskText:     { fontSize: 14, fontWeight: '700' },
  allergenLabel:{ fontSize: 13, fontWeight: '700', color: C.teal, textTransform: 'uppercase', letterSpacing: 1 },
  foodsWrap:    { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  foodPill: {
    backgroundColor: C.tealLight,
    borderRadius: R.pill,
    borderWidth: 1, borderColor: C.tealMid,
    paddingHorizontal: S.lg, paddingVertical: S.sm,
  },
  foodPillText: { fontSize: 16, color: C.tealDark, fontWeight: '600' },
  noFoods:      { fontSize: 13, color: C.slateXLight, fontStyle: 'italic' },
  allergenNotes:{ fontSize: 15, color: C.slate, lineHeight: 24 },

  // Generic card
  card: {
    backgroundColor: C.bgWhite,
    borderRadius: R.lg,
    borderWidth: 1, borderColor: C.borderCard,
    padding: S.xl, gap: S.md,
    shadowColor: C.black, shadowOpacity: 0.04, shadowRadius: 8,
    elevation: 2,
  },
  cardTitle:          { fontSize: 20, fontWeight: '800', color: C.navy },
  cardSub:            { fontSize: 13, color: C.slateLight, marginTop: -S.sm },
  divider:            { height: 1, backgroundColor: C.border },

  // Predict
  predictInput: {
    borderWidth: 1.5, borderColor: C.borderInput,
    borderRadius: R.md,
    paddingHorizontal: S.lg, paddingVertical: S.md,
    fontSize: 15, color: C.navy,
    backgroundColor: C.bgCard,
  },
  predictMsg:  { fontSize: 13, color: C.warning, fontWeight: '600' },
  predictList: { gap: S.sm },
  predictItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.bg,
    borderRadius: R.md, borderWidth: 1, borderColor: C.border,
    padding: S.lg, gap: S.md,
  },
  predictItemLeft: { flex: 1, gap: S.xs },
  predictFood:     { fontSize: 16, fontWeight: '700', color: C.navy },
  predictReason:   { fontSize: 12, color: C.slateLight },
  likelihoodBadge: {
    backgroundColor: C.tealLight, borderRadius: R.pill,
    borderWidth: 1, borderColor: C.tealMid,
    paddingHorizontal: S.md, paddingVertical: S.xs,
  },
  likelihoodText:  { fontSize: 13, fontWeight: '800', color: C.teal },
});
