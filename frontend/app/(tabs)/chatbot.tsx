import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

import { AppHeader } from '@/components/app-header';
import { getApiBaseUrl } from '@/constants/api';
import {
  cleanDisplayText,
  formatAssistantResponse,
  formatCrossAllergenSummary,
} from '@/components/utils/formatDisplayText';
import { C, R, S } from '@/constants/theme';

const BASE_URL = getApiBaseUrl();

// ── Types ─────────────────────────────────────────────────────────────────────
type RiskLevel  = 'High' | 'Medium' | 'Low';
type IntentType = 'Food Safety' | 'Cross Allergen' | 'Emergency' | 'Meal Plan' | 'General';

type Message = {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  intent?: IntentType;
  risk?: RiskLevel;
  isEmergency?: boolean;
};

// ── Quick prompts ─────────────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  'Check this ingredient list for allergens',
  'What are my cross-reactive foods?',
  'Load my cross allergen report',
  'Suggest a safe breakfast plan for me',
  'What symptoms need emergency care?',
  'Give me dietary guidance for this meal: grilled fish and salad',
  'How can I eat safely at restaurants?',
  'Create my travel allergy card',
];

// ── Detection helpers ─────────────────────────────────────────────────────────
const EMERGENCY_KEYWORDS = [
  'difficulty breathing','trouble breathing','wheezing','throat closing',
  'swollen tongue','swollen throat','anaphylaxis','fainting','passed out',
];
const HIGH_RISK_WORDS   = ['avoid','danger','severe','anaphylaxis','high risk','unsafe'];
const MEDIUM_RISK_WORDS = ['caution','moderate','cross-reactive','possible reaction'];

function detectEmergency(q: string) { return EMERGENCY_KEYWORDS.some(k => q.toLowerCase().includes(k)); }

function detectIntent(q: string): IntentType {
  const l = q.toLowerCase();
  if (detectEmergency(l))                                          return 'Emergency';
  if (l.includes('cross') || l.includes('reactive'))              return 'Cross Allergen';
  if (l.includes('meal') || l.includes('diet') || l.includes('breakfast') || l.includes('lunch')) return 'Meal Plan';
  if (l.includes('ingredient') || l.includes('eat') || l.includes('safe')) return 'Food Safety';
  return 'General';
}

function detectRisk(text: string): RiskLevel {
  const l = text.toLowerCase();
  if (HIGH_RISK_WORDS.some(w => l.includes(w)))   return 'High';
  if (MEDIUM_RISK_WORDS.some(w => l.includes(w))) return 'Medium';
  return 'Low';
}

// ── Risk chip style ───────────────────────────────────────────────────────────
function riskChipStyle(risk?: RiskLevel): { bg: string; text: string; border: string } {
  if (risk === 'High')   return { bg: C.dangerBg,  text: C.danger,  border: C.dangerBorder };
  if (risk === 'Medium') return { bg: C.warningBg, text: C.warning, border: '#fde68a' };
  return { bg: C.successBg, text: C.success, border: '#6ee7b7' };
}

// ── Intent label colour ───────────────────────────────────────────────────────
const INTENT_COLOURS: Record<IntentType, string> = {
  Emergency:      '#ef4444',
  'Cross Allergen': '#7c3aed',
  'Food Safety':  '#0891b2',
  'Meal Plan':    '#059669',
  General:        '#475569',
};

let messageSequence = 0;
const createMessageId = () => `${Date.now()}-${++messageSequence}`;

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ChatbotScreen() {
  const { width } = useWindowDimensions();
  const isCompact  = width < 900;
  const messagesRef = useRef<FlatList<Message> | null>(null);

  const [messages, setMessages] = useState<Message[]>([{
    id: '1',
    text: 'Hi! I\'m your AllergyGenie assistant. Ask me about food safety, cross-allergens, ingredients, or emergency signs.',
    sender: 'bot',
    intent: 'General',
    risk: 'Low',
  }]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);

  const canExport = useMemo(() => messages.length > 1, [messages.length]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const addBotMsg = (msg: Omit<Message, 'id'>) =>
    setMessages(prev => [...prev, { ...msg, id: createMessageId() }]);

  const handleClearChat = () =>
    setMessages([{
      id: createMessageId(),
      text: 'Chat cleared. Ask me anything about food allergens.',
      sender: 'bot', intent: 'General', risk: 'Low',
    }]);

  const clearLoadedReport = async () => {
    try {
      const res  = await fetch(`${BASE_URL}/clearReport`, { method: 'POST' });
      const data = await res.json();
      addBotMsg({
        sender: 'bot', intent: 'General',
        risk: data.success ? 'Low' : 'Medium',
        text: data.success
          ? 'Report cleared. Upload a new report before report-based queries.'
          : data?.message || 'Failed to clear report context.',
      });
    } catch {
      addBotMsg({ sender: 'bot', intent: 'General', risk: 'Medium', text: 'Network error while clearing report.' });
    }
  };

  const exportChat = () => {
    const content = messages
      .map(m => `${m.sender.toUpperCase()}${m.intent ? ` [${m.intent}]` : ''}: ${m.text}`)
      .join('\n\n');
    if (Platform.OS === 'web') {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `allergygenie-chat-${Date.now()}.txt`; a.click();
      URL.revokeObjectURL(url);
    } else {
      Alert.alert('Export', 'Use the web version to export chat as a text file.');
    }
  };

  const fetchCrossAllergenSummary = async () => {
    setMessages(prev => [...prev, { id: createMessageId(), text: 'Load my cross allergen report', sender: 'user', intent: 'Cross Allergen' }]);
    setLoading(true);
    try {
      const res  = await fetch(`${BASE_URL}/crossAllergens`);
      const data = await res.json();
      if (!data.success) {
        addBotMsg({ sender: 'bot', intent: 'Cross Allergen', risk: 'Medium',
          text: data.message || 'Cross allergen data not ready. Process a report first.' });
      } else {
        const txt = formatCrossAllergenSummary(data.cross_allergens || [], data.summary || '');
        addBotMsg({ sender: 'bot', intent: 'Cross Allergen', risk: detectRisk(txt), text: txt });
      }
    } catch {
      addBotMsg({ sender: 'bot', intent: 'Cross Allergen', risk: 'Medium', text: 'Unable to load cross allergen report.' });
    }
    setLoading(false);
  };

  const sendMessage = async (presetText?: string) => {
    const raw = (presetText ?? input).trim();
    if (!raw) return;
    if (raw.toLowerCase() === 'load my cross allergen report') { await fetchCrossAllergenSummary(); return; }

    const userIntent = detectIntent(raw);
    setMessages(prev => [...prev, { id: createMessageId(), text: raw, sender: 'user', intent: userIntent }]);
    setInput('');

    if (detectEmergency(raw)) {
      addBotMsg({
        sender: 'bot', intent: 'Emergency', risk: 'High', isEmergency: true,
        text: 'URGENT: Possible severe allergic reaction detected. If there is trouble breathing, throat swelling, dizziness, or fainting — seek emergency care immediately. Use prescribed emergency medication (e.g. epinephrine) and call emergency services now.',
      });
      return;
    }

    setLoading(true);
    try {
      const res  = await fetch(`${BASE_URL}/assistantQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: raw }),
      });
      const data = await res.json();
      const txt  = cleanDisplayText(formatAssistantResponse(data.response || data.text || 'No response'));
      addBotMsg({ sender: 'bot', intent: (data.intent as IntentType) || userIntent, risk: detectRisk(txt), text: txt });
    } catch {
      addBotMsg({ sender: 'bot', intent: 'General', risk: 'Medium', text: 'Error connecting to server.' });
    }
    setLoading(false);
  };

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
    >
      <AppHeader activeTab="assistant" actionHref="/front" />

      {/* ── Hero ── */}
      <View style={[styles.banner, isCompact && styles.bannerSm]}>
        <View style={styles.bannerText}>
          <View style={styles.bannerBadge}>
            <View style={styles.bannerBadgeDot} />
            <Text style={styles.bannerBadgeLabel}>Food Safety  ·  Ingredient Checks  ·  Emergency Alerts</Text>
          </View>
          <Text style={[styles.bannerTitle, isCompact && styles.bannerTitleSm]}>
            AI Food-Allergen{'\n'}Assistant
          </Text>
          <Text style={[styles.bannerDesc, isCompact && styles.bannerDescSm]}>
            Domain-focused chatbot for food safety, ingredient checks, cross-reactive foods, and emergency alerts.
          </Text>
          <TouchableOpacity
            style={styles.bannerCta}
            onPress={() => {}}
            accessibilityRole="button"
          >
            <Text style={styles.bannerCtaText}>Ask a Question ↓</Text>
          </TouchableOpacity>
        </View>
        {!isCompact && (
          <Image
            source={require('../../assets/images/bot.webp')}
            style={styles.bannerImage}
            resizeMode="contain"
            accessibilityLabel="AI assistant illustration"
          />
        )}
      </View>

      <View style={[styles.body, isCompact && styles.bodySm]}>

        {/* ── Quick prompts ── */}
        <View style={styles.quickRow}>
          {QUICK_PROMPTS.map(p => (
            <TouchableOpacity key={p} style={styles.quickChip} onPress={() => sendMessage(p)} accessibilityRole="button">
              <Text style={styles.quickChipText}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Toolbar ── */}
        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.toolBtn} onPress={handleClearChat} accessibilityRole="button">
            <Text style={styles.toolBtnText}>Clear Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={clearLoadedReport} accessibilityRole="button">
            <Text style={styles.toolBtnText}>Clear Report</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toolBtn, !canExport && styles.toolBtnDisabled]}
            onPress={exportChat}
            disabled={!canExport}
            accessibilityRole="button"
          >
            <Text style={styles.toolBtnText}>Export</Text>
          </TouchableOpacity>
        </View>

        {/* ── Messages ── */}
        <View style={styles.chatWrap}>
          <FlatList
            ref={messagesRef}
            data={messages}
            keyExtractor={item => item.id}
            style={styles.messages}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => messagesRef.current?.scrollToEnd({ animated: true })}
            contentContainerStyle={styles.messagesList}
            renderItem={({ item }) => {
              const rs = riskChipStyle(item.risk);
              const ic = item.intent ? INTENT_COLOURS[item.intent] : C.slateLight;
              const isEmergency = item.isEmergency;
              return (
                <View style={[
                  styles.bubble,
                  item.sender === 'user' ? styles.bubbleUser : styles.bubbleBot,
                  isEmergency && styles.bubbleEmergency,
                ]}>
                  {item.sender === 'bot' && item.intent && (
                    <View style={styles.metaRow}>
                      <View style={[styles.intentBadge, { backgroundColor: ic + '22', borderColor: ic + '55' }]}>
                        <Text style={[styles.intentText, { color: ic }]}>{item.intent}</Text>
                      </View>
                      {item.risk && (
                        <View style={[styles.riskBadge, { backgroundColor: rs.bg, borderColor: rs.border }]}>
                          <Text style={[styles.riskText, { color: rs.text }]}>{item.risk} Risk</Text>
                        </View>
                      )}
                    </View>
                  )}
                  <Text style={item.sender === 'user' ? styles.userText : styles.botText}>
                    {item.text}
                  </Text>
                </View>
              );
            }}
          />

          {loading && (
            <View style={styles.thinkingRow}>
              <ActivityIndicator size="small" color={C.teal} />
              <Text style={styles.thinkingText}>Thinking…</Text>
            </View>
          )}

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Ask about food safety, ingredients, or cross-allergens…"
                placeholderTextColor={C.slateXLight}
                value={input}
                onChangeText={setInput}
                onSubmitEditing={() => sendMessage()}
                blurOnSubmit={false}
                returnKeyType="send"
                accessibilityLabel="Chat input"
              />
              <Pressable style={styles.sendBtn} onPress={() => sendMessage()} accessibilityRole="button">
                <Text style={styles.sendBtnText}>Send</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  pageContent: { paddingBottom: 32 },
  body: { paddingHorizontal: S.xl, paddingTop: S.lg, gap: S.md },
  bodySm: { paddingHorizontal: S.lg },

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

  // Quick prompts
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  quickChip: {
    backgroundColor: C.teal,
    borderRadius: R.pill,
    paddingHorizontal: S.md, paddingVertical: S.sm,
  },
  quickChipText: { color: C.white, fontSize: 12, fontWeight: '600' },

  // Toolbar
  toolbar:        { flexDirection: 'row', gap: S.sm, justifyContent: 'flex-end' },
  toolBtn: {
    backgroundColor: C.bgWhite,
    borderRadius: R.md,
    borderWidth: 1, borderColor: C.borderCard,
    paddingHorizontal: S.md, paddingVertical: S.sm,
  },
  toolBtnDisabled: { opacity: 0.4 },
  toolBtnText:     { color: C.slate, fontSize: 12, fontWeight: '600' },

  // Chat area
  chatWrap: {
    minHeight: 480,
    backgroundColor: C.bgWhite,
    borderRadius: R.lg,
    borderWidth: 1, borderColor: C.borderCard,
    padding: S.md, gap: S.sm,
    shadowColor: C.black, shadowOpacity: 0.04, shadowRadius: 8,
    elevation: 2,
  },
  messages: { height: 360, flexGrow: 0 },
  messagesList: { paddingBottom: S.sm, gap: S.md },

  // Bubbles
  bubble: {
    padding: S.lg,
    borderRadius: R.md,
    maxWidth: '88%',
    gap: S.sm,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: C.teal,
  },
  bubbleBot: {
    alignSelf: 'flex-start',
    backgroundColor: C.tealLight,
    borderWidth: 1, borderColor: C.tealMid,
  },
  bubbleEmergency: {
    backgroundColor: C.dangerBg,
    borderWidth: 1, borderColor: C.dangerBorder,
  },
  metaRow: { flexDirection: 'row', gap: S.sm, flexWrap: 'wrap' },
  intentBadge: {
    borderRadius: R.pill, borderWidth: 1,
    paddingHorizontal: S.sm, paddingVertical: 2,
  },
  intentText: { fontSize: 11, fontWeight: '700' },
  riskBadge: {
    borderRadius: R.pill, borderWidth: 1,
    paddingHorizontal: S.sm, paddingVertical: 2,
  },
  riskText:   { fontSize: 11, fontWeight: '700' },
  userText:   { color: C.white, fontSize: 14, lineHeight: 21 },
  botText:    { color: C.navy,  fontSize: 14, lineHeight: 21 },

  // Thinking
  thinkingRow: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    backgroundColor: C.tealLight,
    borderRadius: R.md, borderWidth: 1, borderColor: C.tealMid,
    paddingHorizontal: S.md, paddingVertical: S.sm,
    alignSelf: 'flex-start', marginTop: S.xs,
  },
  thinkingText: { fontSize: 13, color: C.slateMid },

  // Input row
  inputRow: {
    flexDirection: 'row', gap: S.sm, alignItems: 'center',
    paddingTop: S.sm,
    borderTopWidth: 1, borderTopColor: C.border,
    marginTop: S.xs,
  },
  input: {
    flex: 1,
    borderWidth: 1.5, borderColor: C.borderInput,
    borderRadius: R.md,
    paddingHorizontal: S.lg, paddingVertical: S.md,
    fontSize: 14, color: C.navy,
    backgroundColor: C.bgCard,
  },
  sendBtn: {
    backgroundColor: C.teal,
    paddingHorizontal: S.xl, paddingVertical: S.md,
    borderRadius: R.md,
  },
  sendBtnText: { color: C.white, fontWeight: '700', fontSize: 14 },
});
