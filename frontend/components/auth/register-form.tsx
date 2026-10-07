import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    Pressable,
    Alert,
} from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from "../utils/showAlert";
import { C, R, S } from '@/constants/theme';

type Props = {
    onSubmit: (data: {
        firstName: string;
        surname: string;
        email: string;
        password: string;
    }) => void;
};

export default function RegisterForm({ onSubmit }: Props) {
    const [firstName, setFirstName] = useState("");
    const [surname, setSurname] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // =========================
    // FRONTEND VALIDATION (mirror backend)
    // =========================

    const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/;

    const handleSubmit = () => {
        console.log("Submitting form with data:")
        // 1. Required fields

        if (!firstName || !surname || !email || !password) {
            showAlert("Error", "All fields are required");
            return;
        }

        // 2. Empty string check
        if (
            firstName.trim() === "" ||
            surname.trim() === "" ||
            email.trim() === "" ||
            password.trim() === ""
        ) {
            showAlert("Error", "Fields cannot be empty");
            return;
        }

        // 3. Email format check
        if (!EMAIL_REGEX.test(email)) {
            showAlert("Error", "Invalid email format");
            return;
        }

        // 4. Password match check
        if (password !== confirmPassword) {
            showAlert("Error", "Passwords do not match");
            return;
        }

        // 5. Password strength check
        if (!PASSWORD_REGEX.test(password)) {
            showAlert(
                "Error",
                "Password must contain at least 1 uppercase letter, 1 number, and 1 special character"
            );
            return;
        }

        if (password !== confirmPassword) {
            showAlert("Error", "Passwords do not match");
            return;
        }

        // Pass to backend
        onSubmit({
            firstName,
            surname,
            email,
            password,
        });
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Create Account</Text>

            <TextInput
                placeholder="First Name"
                value={firstName}
                onChangeText={setFirstName}
                style={styles.input}
            />

            <TextInput
                placeholder="Surname"
                value={surname}
                onChangeText={setSurname}
                style={styles.input}
            />

            <TextInput
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
            />

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

            <View style={styles.passwordInputWrap}>
                <TextInput
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    style={[styles.input, styles.passwordInput]}
                />
                <Pressable
                    style={styles.passwordEye}
                    onPress={() => setShowConfirmPassword(visible => !visible)}
                    accessibilityRole="button"
                    accessibilityLabel={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                    <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={21} color={C.slateLight} />
                </Pressable>
            </View>

            <Pressable
                style={styles.button}
                onPress={() => {
                    handleSubmit();
                }}
            >
                <Text style={styles.buttonText}>Register</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
        gap: 12,
        width: "100%",
        maxWidth: 420,   // controls how wide the form gets
        alignSelf: "center", // centers horizontally
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
