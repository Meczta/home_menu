// app/(auth)/login.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import auth from '@react-native-firebase/auth';
import { Link, useRouter } from 'expo-router';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const router = useRouter();

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Помилка', 'Будь ласка, введіть email та пароль.');
            return;
        }
        try {
            await auth().signInWithEmailAndPassword(email, password);
            // Навігація на головний екран відбудеться автоматично
            // завдяки логіці в app/_layout.tsx
            // router.replace('/(tabs)'); // Цей рядок тут не обов'язковий, якщо є логіка в _layout.tsx
        } catch (error: any) {
            Alert.alert('Помилка входу', error.message);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Вхід</Text>
            <TextInput
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
            />
            <TextInput
                style={styles.input}
                placeholder="Пароль"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
            />
            <Button title="Увійти" onPress={handleLogin} />
            <Link href="/(auth)/register" style={styles.link}>
                Немає акаунту? Зареєструватися
            </Link>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
    input: { height: 40, borderColor: 'gray', borderWidth: 1, marginBottom: 12, paddingHorizontal: 10 },
    link: { marginTop: 15, textAlign: 'center', color: 'blue' },
});