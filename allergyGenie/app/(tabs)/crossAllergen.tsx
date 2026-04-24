import { useEffect, useState } from 'react';
import { Platform, StyleSheet, ActivityIndicator, TextInput, View, ScrollView, TouchableOpacity } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getApiBaseUrl } from '@/constants/api';

type CrossAllergenItem = {
  primary?: string;
  risk?: string;
  cross_reactive?: string[];
  notes?: string;
};

type PredictedFood = {
  food: string;
  likelihood: number;
  reason?: string;
};

export default function CrossAllergenScreen() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [crossAllergens, setCrossAllergens] = useState<CrossAllergenItem[]>([]);
  const [summary, setSummary] = useState('');
  const [predictQuery, setPredictQuery] = useState('');
  const [predicting, setPredicting] = useState(false);
  const [predictMessage, setPredictMessage] = useState('');
  const [predictions, setPredictions] = useState<PredictedFood[]>([]);

  const BASE_URL = getApiBaseUrl();

  useEffect(() => {
    fetchCrossAllergens();
  }, []);

  const fetchCrossAllergens = async () => {
    try {
      const res = await fetch(`${BASE_URL}/crossAllergens`);
      const data = await res.json();

      if (!data.success) {
        setErrorMessage(data.message || 'Please upload and process a report first.');
        setCrossAllergens([]);
        setSummary('');
      } else {
        setCrossAllergens(data.cross_allergens || []);
        setSummary(data.summary || '');
        setErrorMessage('');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Network error while loading cross allergens.');
    } finally {
      setLoading(false);
    }
  };

  const runPrediction = async () => {
    const query = predictQuery.trim();
    if (!query) {
      setPredictMessage('Enter a food/allergen to predict likely cross-reactive foods.');
      setPredictions([]);
      return;
    }

    setPredicting(true);
    setPredictMessage('');
    setPredictions([]);

    try {
      const res = await fetch(`${BASE_URL}/predictCrossAllergy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, top_k: 6 }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPredictMessage(data?.detail || data?.message || 'Prediction failed.');
        return;
      }

      const nextPredictions = (data.predictions || []) as PredictedFood[];
      setPredictions(nextPredictions);
      if (nextPredictions.length === 0) {
        setPredictMessage('No likely cross-reactive foods could be predicted.');
      }
    } catch (err) {
      console.error(err);
      setPredictMessage('Network error while running prediction.');
    } finally {
      setPredicting(false);
    }
  };

  const clearLoadedReport = async () => {
    try {
      const res = await fetch(`${BASE_URL}/clearReport`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data?.message || 'Failed to clear report context.');
        return;
      }

      setCrossAllergens([]);
      setSummary('');
      setErrorMessage('Report context cleared. Upload and process a new report.');
    } catch (err) {
      console.error(err);
      setErrorMessage('Network error while clearing report context.');
    }
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <AppHeader activeTab="cross" actionLabel="Assistant" actionHref="/chatbot" />

      <View style={styles.contentWrap}>
        <ThemedView style={styles.heroCard}>
          <ThemedText style={styles.heroTitle}>Cross-Allergen Detection</ThemedText>
          <ThemedText style={styles.heroSubtitle}>
            We map hidden food cross-reactivity patterns based on your report and highlight safer decisions.
          </ThemedText>
        </ThemedView>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.secondaryButton} onPress={clearLoadedReport}>
            <ThemedText style={styles.secondaryButtonText}>Clear Report</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.refreshButton} onPress={fetchCrossAllergens}>
            <ThemedText style={styles.refreshButtonText}>Refresh</ThemedText>
          </TouchableOpacity>
        </View>

        {loading && <ActivityIndicator size="large" style={styles.loader} color="#0b8fa1" />}

        {!loading && errorMessage !== '' && (
          <ThemedView style={styles.errorCard}>
            <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
          </ThemedView>
        )}

        {!loading && errorMessage === '' && (
          <>
            {crossAllergens.length === 0 ? (
              <ThemedView style={styles.emptyCard}>
                <ThemedText style={styles.emptyText}>No cross allergens found.</ThemedText>
              </ThemedView>
            ) : (
              crossAllergens.map((item, index) => {
                const foods = (item.cross_reactive || []).filter((food) => food && food.toLowerCase() !== 'nan');
                return (
                  <ThemedView key={`${item.primary || 'allergen'}-${index}`} style={styles.itemCard}>
                    <ThemedText style={styles.itemTitle}>{item.primary || `Allergen ${index + 1}`}</ThemedText>
                    <ThemedText style={styles.itemRisk}>Risk: {item.risk || 'Unknown'}</ThemedText>

                    <ThemedText style={styles.itemLabel}>Cross Reactive Foods</ThemedText>
                    {foods.length > 0 ? (
                      foods.map((food, i) => (
                        <ThemedText key={`${food}-${i}`} style={styles.foodItem}>
                          • {food}
                        </ThemedText>
                      ))
                    ) : (
                      <ThemedText style={styles.foodItem}>• No items listed</ThemedText>
                    )}

                    {item.notes ? (
                      <ThemedText style={styles.notesText}>
                        <ThemedText style={styles.itemLabel}>Notes: </ThemedText>
                        {item.notes}
                      </ThemedText>
                    ) : null}
                  </ThemedView>
                );
              })
            )}

            <ThemedView style={styles.summaryCard}>
              <ThemedText style={styles.summaryTitle}>Summary</ThemedText>
              <ThemedText style={styles.summarySubtitle}>Overall AI interpretation from your latest report</ThemedText>
              <TextInput
                style={styles.textBox}
                multiline
                value={summary}
                onChangeText={setSummary}
                placeholder="Summary will appear here..."
                placeholderTextColor="#6b7280"
              />
            </ThemedView>

          </>
        )}

        {!loading && (
          <ThemedView style={styles.predictionCard}>
            <ThemedText style={styles.predictionTitle}>Unknown Food ML Prediction</ThemedText>
            <ThemedText style={styles.predictionSubtitle}>
              If a food/allergen is missing from your known cross-allergy list, this trained model predicts likely
              cross-reactive foods.
            </ThemedText>

            <TextInput
              style={styles.predictInput}
              value={predictQuery}
              onChangeText={setPredictQuery}
              placeholder="Example: chickpea, shellfish, buckwheat"
              placeholderTextColor="#6b7280"
            />

            <TouchableOpacity style={styles.predictButton} onPress={runPrediction} disabled={predicting}>
              <ThemedText style={styles.predictButtonText}>{predicting ? 'Predicting...' : 'Predict Likely Foods'}</ThemedText>
            </TouchableOpacity>

            {predictMessage ? <ThemedText style={styles.predictMessage}>{predictMessage}</ThemedText> : null}

            {predictions.length > 0 && (
              <View style={styles.predictList}>
                {predictions.map((item, index) => (
                  <View key={`${item.food}-${index}`} style={styles.predictItem}>
                    <ThemedText style={styles.predictFood}>{item.food}</ThemedText>
                    <ThemedText style={styles.predictLikelihood}>Likelihood: {item.likelihood}%</ThemedText>
                  </View>
                ))}
              </View>
            )}
          </ThemedView>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#d9f0f2',
  },
  pageContent: {
    paddingBottom: 36,
  },
  contentWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  heroCard: {
    borderRadius: 16,
    backgroundColor: '#cde9ee',
    borderWidth: 1,
    borderColor: '#b8dce2',
    padding: 16,
    gap: 8,
  },
  heroTitle: {
    color: '#12284b',
    fontSize: 36,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: '#334155',
    fontSize: 17,
  },
  refreshButton: {
    backgroundColor: '#0b8fa1',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  refreshButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  secondaryButton: {
    backgroundColor: '#e2eef1',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#c5dde2',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: '#0f172a',
    fontWeight: '700',
  },
  loader: {
    marginTop: 8,
  },
  errorCard: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    color: '#b91c1c',
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbe3ea',
    borderRadius: 12,
    padding: 14,
  },
  emptyText: {
    color: '#334155',
  },
  itemCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbe3ea',
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  itemTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f766e',
  },
  itemRisk: {
    color: '#334155',
    fontWeight: '600',
  },
  itemLabel: {
    color: '#0f766e',
    fontWeight: '700',
  },
  foodItem: {
    color: '#1f2937',
  },
  notesText: {
    color: '#334155',
    marginTop: 2,
  },
  summaryCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d8dde3',
    backgroundColor: '#f8fafb',
    padding: 14,
    minHeight: 220,
    gap: 4,
  },
  summaryTitle: {
    color: '#0b6b7b',
    fontSize: 32,
    fontWeight: '800',
  },
  summarySubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  textBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    color: '#1f2937',
    borderRadius: 8,
    padding: 10,
    minHeight: 140,
    textAlignVertical: 'top',
    backgroundColor: '#ffffff',
  },
  predictionCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d8dde3',
    backgroundColor: '#f8fafb',
    padding: 14,
    gap: 8,
  },
  predictionTitle: {
    color: '#0b6b7b',
    fontSize: 24,
    fontWeight: '800',
  },
  predictionSubtitle: {
    fontSize: 14,
    color: '#4b5563',
  },
  predictInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    color: '#1f2937',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
  },
  predictButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#0b8fa1',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  predictButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  predictMessage: {
    color: '#92400e',
    fontWeight: '600',
  },
  predictList: {
    gap: 8,
    marginTop: 4,
  },
  predictItem: {
    borderWidth: 1,
    borderColor: '#dbe3ea',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#ffffff',
  },
  predictFood: {
    fontSize: 17,
    color: '#0f766e',
    fontWeight: '700',
  },
  predictLikelihood: {
    color: '#334155',
    marginTop: 2,
  },
});
