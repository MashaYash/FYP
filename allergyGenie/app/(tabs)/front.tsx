import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  View,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';

import { AppHeader } from '@/components/app-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getApiBaseUrl } from '@/constants/api';

export default function FrontScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < 900;
  const scrollRef = useRef<ScrollView>(null);
  const [reportSectionY, setReportSectionY] = useState(0);
  const [image, setImage] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState('');

  const BASE_URL = getApiBaseUrl();

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const res = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!res.canceled) setImage(res.assets[0]);
  };

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 1 });
    if (!res.canceled) setImage(res.assets[0]);
  };

  const handleWebUpload = (event: any) => {
    const file = event.target.files[0];
    if (!file) return;
    setImage({ uri: URL.createObjectURL(file), file });
  };

  const processImage = async () => {
    if (!image) return;
    setLoading(true);
    const formData = new FormData();
    if (Platform.OS === 'web') {
      formData.append('file', image.file);
    } else {
      formData.append('file', { uri: image.uri, name: 'image.jpg', type: 'image/jpeg' } as any);
    }

    try {
      const res = await fetch(`${BASE_URL}/imageToText`, { method: 'POST', body: formData });
      const data = await res.json();
      setSummary(data.text || 'No text found');
    } catch (err) {
      console.error(err);
      setSummary('Error processing image');
    }
    setLoading(false);
  };

  const handleStartNow = async () => {
    if (!image) {
      Alert.alert('No image selected', 'Please upload an image first.');
      return;
    }
    await processImage();
  };

  const scrollToReport = () => {
    scrollRef.current?.scrollTo({ y: reportSectionY, animated: true });
  };

  return (
    <ScrollView ref={scrollRef} style={styles.page} contentContainerStyle={styles.pageContent}>
      <AppHeader activeTab="report" actionLabel="Assistant" actionHref="/chatbot" />

      <ThemedView style={[styles.heroCard, isCompact && styles.heroCardCompact]}>
        <View style={styles.heroLeft}>
          <ThemedText style={styles.heroTagline}>Smarter Allergy Care Starts Here</ThemedText>
          <ThemedText style={[styles.heroTitle, isCompact && styles.heroTitleCompact]}>
            Your AI-Powered Path to Allergy-Safe Living
          </ThemedText>
          <ThemedText style={[styles.heroSubText, isCompact && styles.heroSubTextCompact]}>
            AllerSense AI analyzes your skin prick test report, detects hidden cross-allergens, and guides your
            daily food choices through an intelligent assistant.
          </ThemedText>
          <TouchableOpacity style={styles.tryButton} onPress={scrollToReport}>
            <ThemedText style={styles.tryButtonText}>Try Now</ThemedText>
          </TouchableOpacity>
        </View>
        <View style={[styles.heroArt, isCompact && styles.heroArtCompact]}>
          <ThemedText style={[styles.heroArtIcon, isCompact && styles.heroArtIconCompact]}>🤖</ThemedText>
        </View>
      </ThemedView>

      <View style={[styles.chipsRow, isCompact && styles.chipsRowCompact]}>
        <TouchableOpacity style={styles.featureChip} onPress={() => router.push('/chatbot')}>
          <ThemedText style={styles.featureChipText}>AI Chat Assistant</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.featureChip}>
          <ThemedText style={styles.featureChipText}>Smart & Reliable Recommendations</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.featureChip} onPress={() => router.push('/crossAllergen')}>
          <ThemedText style={styles.featureChipText}>Cross-Allergen Detection</ThemedText>
        </TouchableOpacity>
      </View>

      <View onLayout={(event) => setReportSectionY(event.nativeEvent.layout.y)}>
        <ThemedText style={[styles.sectionTitle, isCompact && styles.sectionTitleCompact]}>Report Analysis</ThemedText>
      </View>

      <ThemedView style={styles.uploadCard}>
        <View style={styles.uploadInnerBox}>
          <ThemedText style={styles.uploadHint}>Choose a file or drag & drop it here</ThemedText>
          <ThemedText style={styles.uploadHintSmall}>DOC, PDF, JPG</ThemedText>
          {Platform.OS === 'web' ? (
            <input type="file" accept="image/*,.pdf,.doc,.docx" onChange={handleWebUpload} />
          ) : (
            <View style={[styles.nativePickerButtons, isCompact && styles.nativePickerButtonsCompact]}>
              <TouchableOpacity style={styles.secondaryButton} onPress={takePhoto}>
                <ThemedText style={styles.secondaryButtonText}>Take Photo</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={pickImage}>
                <ThemedText style={styles.secondaryButtonText}>Browse File</ThemedText>
              </TouchableOpacity>
            </View>
          )}
        </View>
        <View style={styles.startButtonRow}>
          <TouchableOpacity style={styles.startButton} onPress={handleStartNow}>
            <ThemedText style={styles.startButtonText}>Start Now</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>

      {image && <Image source={{ uri: image.uri }} style={[styles.preview, isCompact && styles.previewCompact]} contentFit="contain" />}

      <ThemedView style={styles.summaryCard}>
        <ThemedText style={[styles.summaryTitle, isCompact && styles.summaryTitleCompact]}>Report Summary</ThemedText>
        <TextInput
          placeholder="AI-generated summary will appear here after processing."
          placeholderTextColor="#6b7280"
          value={summary}
          onChangeText={setSummary}
          style={[styles.summaryInput, isCompact && styles.summaryInputCompact]}
          multiline
        />
      </ThemedView>

      {loading && <ActivityIndicator style={styles.loader} size="small" color="#0b8fa1" />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#d9f0f2' },
  pageContent: { paddingBottom: 34, gap: 14 },
  heroCard: {
    marginHorizontal: 18,
    borderRadius: 16,
    backgroundColor: '#d4eef1',
    borderWidth: 1,
    borderColor: '#bfe3e8',
    padding: 18,
    flexDirection: 'row',
    gap: 12,
  },
  heroCardCompact: {
    marginHorizontal: 10,
    padding: 12,
    flexDirection: 'column',
  },
  heroLeft: { flex: 1, gap: 8 },
  heroTagline: { color: '#2693a3', fontWeight: '700', fontSize: 16 },
  heroTitle: { color: '#0e2344', fontSize: 46, lineHeight: 54, fontWeight: '900' },
  heroTitleCompact: { fontSize: 30, lineHeight: 36 },
  heroSubText: { color: '#334155', fontSize: 17, lineHeight: 25 },
  heroSubTextCompact: { fontSize: 15, lineHeight: 22 },
  tryButton: { alignSelf: 'flex-start', marginTop: 4, backgroundColor: '#0b8fa1', borderRadius: 22, paddingHorizontal: 22, paddingVertical: 10 },
  tryButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  heroArt: { width: 280, borderRadius: 20, backgroundColor: '#0b8fa1', alignItems: 'center', justifyContent: 'center' },
  heroArtCompact: { width: '100%', minHeight: 120 },
  heroArtIcon: { fontSize: 84 },
  heroArtIconCompact: { fontSize: 54 },
  chipsRow: { marginHorizontal: 18, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chipsRowCompact: { marginHorizontal: 10 },
  featureChip: { backgroundColor: '#0b8fa1', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11 },
  featureChipText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  sectionTitle: { marginHorizontal: 18, fontSize: 38, fontWeight: '800', color: '#0b6b7b' },
  sectionTitleCompact: { marginHorizontal: 10, fontSize: 28 },
  uploadCard: {
    marginHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#f8fbfc',
    borderWidth: 1,
    borderColor: '#d8dde3',
    padding: 14,
    gap: 12,
  },
  uploadInnerBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#d9dfe5',
    borderRadius: 14,
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  uploadHint: { color: '#667085', fontSize: 15 },
  uploadHintSmall: { color: '#94a3b8', fontSize: 13 },
  nativePickerButtons: { flexDirection: 'row', gap: 10 },
  nativePickerButtonsCompact: { flexDirection: 'column', width: '90%' },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#bfc8d3',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  secondaryButtonText: { color: '#1f2937', fontWeight: '600' },
  startButtonRow: { alignItems: 'flex-end' },
  startButton: { backgroundColor: '#0b8fa1', borderRadius: 10, paddingHorizontal: 30, paddingVertical: 12 },
  startButtonText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  preview: { marginHorizontal: 10, width: undefined, height: 360, borderRadius: 8, backgroundColor: '#ffffff' },
  previewCompact: { height: 260 },
  summaryCard: {
    marginHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d8dde3',
    backgroundColor: '#f8fafb',
    padding: 14,
    minHeight: 210,
  },
  summaryTitle: { color: '#0b6b7b', fontSize: 32, fontWeight: '800' },
  summaryTitleCompact: { fontSize: 24 },
  summaryInput: { marginTop: 10, fontSize: 17, color: '#1f2937', textAlignVertical: 'top', minHeight: 140 },
  summaryInputCompact: { fontSize: 15, minHeight: 120 },
  loader: { marginTop: 6, marginHorizontal: 10 },
});
