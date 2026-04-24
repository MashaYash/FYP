import { useMemo, useState } from 'react';
import {
  StyleSheet,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
  View,
  TouchableOpacity,
  Alert,
} from 'react-native';

import { AppHeader } from '@/components/app-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getApiBaseUrl } from '@/constants/api';

const BASE_URL = getApiBaseUrl();

type RiskLevel = 'High' | 'Medium' | 'Low';
type IntentType = 'Food Safety' | 'Cross Allergen' | 'Emergency' | 'Meal Plan' | 'General';

type Message = {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  intent?: IntentType;
  risk?: RiskLevel;
  isEmergency?: boolean;
};

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

const EMERGENCY_KEYWORDS = [
  'difficulty breathing',
  'trouble breathing',
  'wheezing',
  'throat closing',
  'swollen tongue',
  'swollen throat',
  'anaphylaxis',
  'fainting',
  'passed out',
];

const HIGH_RISK_WORDS = ['avoid', 'danger', 'severe', 'anaphylaxis', 'high risk', 'unsafe'];
const MEDIUM_RISK_WORDS = ['caution', 'moderate', 'cross-reactive', 'possible reaction'];

function detectEmergency(query: string): boolean {
  const lower = query.toLowerCase();
  return EMERGENCY_KEYWORDS.some((word) => lower.includes(word));
}

function detectIntent(query: string): IntentType {
  const lower = query.toLowerCase();
  if (detectEmergency(lower)) return 'Emergency';
  if (lower.includes('cross') || lower.includes('reactive')) return 'Cross Allergen';
  if (lower.includes('meal') || lower.includes('diet') || lower.includes('breakfast') || lower.includes('lunch')) {
    return 'Meal Plan';
  }
  if (lower.includes('ingredient') || lower.includes('eat') || lower.includes('safe')) return 'Food Safety';
  return 'General';
}

function formatAssistantResponse(payload: any): string {
  if (!payload) return 'No response available.';
  if (typeof payload === 'string') return payload;
  if (payload.plan && Array.isArray(payload.plan)) {
    const planText = payload.plan
      .map((day: any) => {
        const meals = Object.entries(day.meals || {})
          .map(([mealType, meal]) => `${mealType}: ${meal}`)
          .join('\n');
        return `Day ${day.day}\n${meals}`;
      })
      .join('\n\n');

    const extraGuidance =
      payload.guidance && Array.isArray(payload.guidance) ? `\n\nGuidance:\n${payload.guidance.join('\n')}` : '';
    return `${planText}${extraGuidance}`;
  }
  if (payload.text) return String(payload.text);
  if (Array.isArray(payload.insights)) return payload.insights.join('\n');
  if (payload.recommended_steps) return payload.recommended_steps.join('\n');
  if (payload.guidance && Array.isArray(payload.guidance)) return payload.guidance.join('\n');
  if (payload.card_text) return payload.card_text;
  return JSON.stringify(payload, null, 2);
}

function detectRisk(text: string): RiskLevel {
  const lower = text.toLowerCase();
  if (HIGH_RISK_WORDS.some((word) => lower.includes(word))) return 'High';
  if (MEDIUM_RISK_WORDS.some((word) => lower.includes(word))) return 'Medium';
  return 'Low';
}

function getRiskStyle(risk?: RiskLevel) {
  if (risk === 'High') return { bg: '#fee2e2', text: '#b91c1c' };
  if (risk === 'Medium') return { bg: '#fef3c7', text: '#92400e' };
  return { bg: '#dcfce7', text: '#166534' };
}

export default function ChatbotScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hi! I am your AllergyGenie assistant. Ask about food safety, cross-allergens, ingredients, or emergency signs.',
      sender: 'bot',
      intent: 'General',
      risk: 'Low',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const canExport = useMemo(() => messages.length > 1, [messages.length]);

  const handleClearChat = () => {
    setMessages([
      {
        id: `${Date.now()}`,
        text: 'Chat cleared. Ask me anything about food allergens.',
        sender: 'bot',
        intent: 'General',
        risk: 'Low',
      },
    ]);
  };

  const clearLoadedReport = async () => {
    try {
      const res = await fetch(`${BASE_URL}/clearReport`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setMessages((prev) => [
          {
            id: `${Date.now() + 2}`,
            sender: 'bot',
            intent: 'General',
            risk: 'Medium',
            text: data?.message || 'Failed to clear report context.',
          },
          ...prev,
        ]);
        return;
      }

      setMessages((prev) => [
        {
          id: `${Date.now() + 2}`,
          sender: 'bot',
          intent: 'General',
          risk: 'Low',
          text: 'Report context cleared. Upload and process a new report before report-based queries.',
        },
        ...prev,
      ]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        {
          id: `${Date.now() + 2}`,
          sender: 'bot',
          intent: 'General',
          risk: 'Medium',
          text: 'Network error while clearing report context.',
        },
        ...prev,
      ]);
    }
  };

  const exportChat = () => {
    const content = messages
      .slice()
      .reverse()
      .map((m) => `${m.sender.toUpperCase()}${m.intent ? ` [${m.intent}]` : ''}: ${m.text}`)
      .join('\n\n');

    if (Platform.OS === 'web') {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `allergygenie-chat-${Date.now()}.txt`;
      link.click();
      URL.revokeObjectURL(url);
      return;
    }

    Alert.alert('Export not supported', 'Use web version to export chat as text.');
  };

  const pushEmergencyGuidance = () => {
    const emergencyMessage: Message = {
      id: `${Date.now() + 1}`,
      sender: 'bot',
      intent: 'Emergency',
      risk: 'High',
      isEmergency: true,
      text: 'Possible severe allergic reaction detected. If there is trouble breathing, throat swelling, dizziness, or fainting, seek emergency care immediately. Use prescribed emergency medication (such as epinephrine) and contact local emergency services now.',
    };
    setMessages((prev) => [emergencyMessage, ...prev]);
  };

  const fetchCrossAllergenSummary = async () => {
    const requestMessage: Message = {
      id: `${Date.now()}`,
      text: 'Load my cross allergen report',
      sender: 'user',
      intent: 'Cross Allergen',
    };
    setMessages((prev) => [requestMessage, ...prev]);
    setLoading(true);

    try {
      const res = await fetch(`${BASE_URL}/crossAllergens`);
      const data = await res.json();

      if (!data.success) {
        setMessages((prev) => [
          {
            id: `${Date.now() + 1}`,
            sender: 'bot',
            intent: 'Cross Allergen',
            risk: 'Medium',
            text: data.message || 'Cross allergen data is not ready. Please process a report first.',
          },
          ...prev,
        ]);
      } else {
        const topItems = (data.cross_allergens || []).slice(0, 5);
        const lines = topItems.map((item: any, idx: number) => {
          const foods = (item.cross_reactive || []).filter((f: string) => f && f.toLowerCase() !== 'nan').slice(0, 3);
          return `${idx + 1}. ${item.primary || 'Unknown'} (${item.risk || 'Unknown risk'}) -> ${foods.join(', ') || 'No foods listed'}`;
        });
        const summaryText = lines.length > 0 ? lines.join('\n') : 'No cross allergen items found.';
        setMessages((prev) => [
          {
            id: `${Date.now() + 1}`,
            sender: 'bot',
            intent: 'Cross Allergen',
            risk: detectRisk(summaryText),
            text: `Here is your cross allergen summary:\n${summaryText}`,
          },
          ...prev,
        ]);
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        {
          id: `${Date.now() + 1}`,
          sender: 'bot',
          intent: 'Cross Allergen',
          risk: 'Medium',
          text: 'Unable to load cross allergen report right now.',
        },
        ...prev,
      ]);
    }

    setLoading(false);
  };

  const sendMessage = async (presetText?: string) => {
    const raw = presetText ?? input;
    const currentInput = raw.trim();
    if (!currentInput) return;
    if (currentInput.toLowerCase() === 'load my cross allergen report') {
      await fetchCrossAllergenSummary();
      return;
    }

    const userIntent = detectIntent(currentInput);
    const userMessage: Message = {
      id: Date.now().toString(),
      text: currentInput,
      sender: 'user',
      intent: userIntent,
    };

    setMessages((prev) => [userMessage, ...prev]);
    setInput('');

    if (detectEmergency(currentInput)) {
      pushEmergencyGuidance();
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${BASE_URL}/assistantQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: currentInput }),
      });

      const data = await res.json();
      const botText = formatAssistantResponse(data.response || data.text || 'No response');
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: botText,
        sender: 'bot',
        intent: (data.intent as IntentType) || userIntent,
        risk: detectRisk(botText),
      };

      setMessages((prev) => [botMessage, ...prev]);
    } catch (err) {
      console.error(err);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Error connecting to server',
        sender: 'bot',
        intent: 'General',
        risk: 'Medium',
      };
      setMessages((prev) => [errorMessage, ...prev]);
    }

    setLoading(false);
  };

  return (
    <ThemedView style={styles.page}>
      <AppHeader activeTab="assistant" actionLabel="Report" actionHref="/front" />

      <View style={styles.contentWrap}>
        <ThemedView style={styles.heroCard}>
          <ThemedText style={styles.heroTitle}>AI Food-Allergen Assistant</ThemedText>
          <ThemedText style={styles.heroSubtitle}>
            Domain-focused chatbot for food safety, ingredient checks, cross-reactive foods, and emergency alerts.
          </ThemedText>
        </ThemedView>

        <View style={styles.quickActionsRow}>
          {QUICK_PROMPTS.map((prompt) => (
            <TouchableOpacity key={prompt} style={styles.quickChip} onPress={() => sendMessage(prompt)}>
              <ThemedText style={styles.quickChipText}>{prompt}</ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.toolsRow}>
          <TouchableOpacity style={styles.toolButton} onPress={handleClearChat}>
            <ThemedText style={styles.toolButtonText}>Clear Chat</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolButton} onPress={clearLoadedReport}>
            <ThemedText style={styles.toolButtonText}>Clear Report</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.toolButton, !canExport && styles.toolButtonDisabled]} onPress={exportChat} disabled={!canExport}>
            <ThemedText style={styles.toolButtonText}>Export Chat</ThemedText>
          </TouchableOpacity>
        </View>

        <ThemedView style={styles.chatCard}>
          <FlatList
            data={messages}
            inverted
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesContent}
            renderItem={({ item }) => {
              const riskStyle = getRiskStyle(item.risk);
              return (
                <View style={[styles.messageBubble, item.sender === 'user' ? styles.userBubble : styles.botBubble]}>
                  {item.sender === 'bot' && item.intent ? (
                    <View style={styles.metaRow}>
                      <View style={styles.intentBadge}>
                        <ThemedText style={styles.intentText}>{item.intent}</ThemedText>
                      </View>
                      {item.risk ? (
                        <View style={[styles.riskBadge, { backgroundColor: riskStyle.bg }]}>
                          <ThemedText style={[styles.riskText, { color: riskStyle.text }]}>{item.risk} Risk</ThemedText>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                  <ThemedText style={item.sender === 'user' ? styles.userText : styles.botText}>{item.text}</ThemedText>
                </View>
              );
            }}
          />

          {loading && (
            <View style={styles.loading}>
              <ActivityIndicator color="#0b8fa1" />
              <ThemedText style={styles.loadingText}>Thinking...</ThemedText>
            </View>
          )}

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Ask about food safety, ingredients, or cross-allergens..."
              placeholderTextColor="#6b7280"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => sendMessage()}
            />

            <Pressable style={styles.button} onPress={() => sendMessage()}>
              <ThemedText style={styles.buttonText}>Send</ThemedText>
            </Pressable>
          </KeyboardAvoidingView>
        </ThemedView>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#d9f0f2',
  },
  contentWrap: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 10,
  },
  heroCard: {
    borderRadius: 16,
    backgroundColor: '#cde9ee',
    borderWidth: 1,
    borderColor: '#b8dce2',
    padding: 14,
    gap: 6,
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
  quickActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickChip: {
    backgroundColor: '#0b8fa1',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quickChipText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  toolsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  toolButton: {
    backgroundColor: '#e2eef1',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c5dde2',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  toolButtonDisabled: {
    opacity: 0.45,
  },
  toolButtonText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '600',
  },
  chatCard: {
    flex: 1,
    backgroundColor: '#f8fafb',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d8dde3',
    padding: 12,
  },
  messagesContent: {
    paddingBottom: 8,
    gap: 8,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 12,
    maxWidth: '90%',
    gap: 6,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#0b8fa1',
  },
  botBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#eaf3f5',
    borderWidth: 1,
    borderColor: '#d2e7ea',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  intentBadge: {
    backgroundColor: '#dbeafe',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  intentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  riskBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  riskText: {
    fontSize: 12,
    fontWeight: '700',
  },
  userText: {
    color: '#ffffff',
  },
  botText: {
    color: '#1f2937',
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    paddingTop: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cfd8df',
    backgroundColor: '#ffffff',
    color: '#1f2937',
    padding: 10,
    borderRadius: 10,
  },
  button: {
    backgroundColor: '#0b8fa1',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: '#eaf3f5',
    borderWidth: 1,
    borderColor: '#d2e7ea',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  loadingText: {
    color: '#475569',
  },
});
