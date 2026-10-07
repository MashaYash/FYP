import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, Alert } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { C, R, S } from '@/constants/theme';

type Props = {
    onSubmit: (data: {
        email: string;
        password: string;
    }) => void;
};

export default function LoginForm({ onSubmit }: Props) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [emailError, setEmailError] = useState("");

    const handleSubmit = () => {
        const normalizedEmail = email.trim();
        if (!normalizedEmail || !password) {
            Alert.alert("Error", "Please fill in all fields");
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            setEmailError('Enter the email address used to create your account.');
            return;
        }

        setEmailError("");
        onSubmit({ email: normalizedEmail, password });
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Login</Text>

            <TextInput
                placeholder="Email"
                value={email}
                onChangeText={value => { setEmail(value); setEmailError(""); }}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
            />
            {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

            <View style={styles.passwordInputWrap}>
                <TextInput
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    style={[styles.input, styles.passwordInput]}
                />
                <Pressable
                    style={styles.passwordEye}
                    onPress={() => setShowPassword(visible => !visible)}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={21} color={C.slateLight} />
                </Pressable>
            </View>

            <Pressable style={styles.button} onPress={handleSubmit}>
                <Text style={styles.buttonText}>Login</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
        gap: 12,
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
        color: C.navy,
        marginBottom: S.md,
    },
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
    errorText: { color: C.danger, fontSize: 12, fontWeight: '600', marginTop: -6 },
    passwordInputWrap: { position: 'relative', justifyContent: 'center' },
    passwordInput: { paddingRight: 52 },
    passwordEye: { position: 'absolute', right: 14, height: '100%', justifyContent: 'center', padding: 4 },
    button: {
        backgroundColor: C.teal,
        borderRadius: R.pill,
        paddingVertical: S.md,
        paddingHorizontal: S.xl,
        alignItems: 'center',
        marginTop: S.md,
    },
    buttonText: {
        color: C.white,
        fontWeight: '700',
        fontSize: 15,
    },
});
