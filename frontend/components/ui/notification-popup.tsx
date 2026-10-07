import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, S } from '@/constants/theme';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
  buttonLabel?: string;
  onConfirm?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
};

export function NotificationPopup({
  visible,
  title,
  message,
  onClose,
  buttonLabel = 'Continue',
  onConfirm,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
}: Props) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="checkmark-circle" size={34} color={C.teal} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          {onConfirm ? (
            <View style={styles.actions}>
              <Pressable style={styles.cancelButton} onPress={onClose} accessibilityRole="button">
                <Text style={styles.cancelButtonText}>{cancelLabel}</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.confirmButton]} onPress={onConfirm} accessibilityRole="button">
                <Text style={styles.buttonText}>{confirmLabel}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.button} onPress={onClose} accessibilityRole="button">
              <Text style={styles.buttonText}>{buttonLabel}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: S.xl,
    backgroundColor: 'rgba(14, 34, 68, 0.38)',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    padding: S.xxl,
    gap: S.md,
    backgroundColor: C.bgWhite,
    borderRadius: R.xl,
    borderWidth: 1,
    borderColor: C.borderCard,
    shadowColor: C.navy,
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 8,
  },
  iconWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.tealLight,
    borderWidth: 1,
    borderColor: C.tealMid,
  },
  title: { color: C.navy, fontSize: 21, fontWeight: '800', textAlign: 'center' },
  message: { color: C.slate, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  button: {
    minWidth: 132,
    alignItems: 'center',
    marginTop: S.sm,
    paddingHorizontal: S.xl,
    paddingVertical: S.md,
    borderRadius: R.pill,
    backgroundColor: C.teal,
  },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: S.md, marginTop: S.sm },
  confirmButton: { backgroundColor: C.danger },
  cancelButton: {
    minWidth: 132,
    alignItems: 'center',
    marginTop: S.sm,
    paddingHorizontal: S.xl,
    paddingVertical: S.md,
    borderRadius: R.pill,
    backgroundColor: C.bgWhite,
    borderWidth: 1,
    borderColor: C.borderCard,
  },
  cancelButtonText: { color: C.navy, fontSize: 14, fontWeight: '800' },
  buttonText: { color: C.white, fontSize: 14, fontWeight: '800' },
});
