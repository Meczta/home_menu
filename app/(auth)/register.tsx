// app/(auth)/register.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import auth from '@react-native-firebase/auth';
import { useRouter } from 'expo-router';

export default function RegisterScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const router = useRouter();

    const handleRegister = async () => {
        if (!email || !password) {
            Alert.alert('Помилка', 'Будь ласка, введіть email та пароль.');
            return;
        }
        try {
            await auth().createUserWithEmailAndPassword(email, password);
            // Після успішної реєстрації Firebase автоматично логінить користувача.
            // Навігація на головний екран відбудеться автоматично
            // завдяки логіці в app/_layout.tsx.
            // router.replace('/(tabs)'); // Не обов'язково тут
        } catch (error: any) {
            Alert.alert('Помилка реєстрації', error.message);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Реєстрація</Text>
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
                placeholder="Пароль (мін. 6 символів)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
            />
            <Button title="Зареєструватися" onPress={handleRegister} />
            <Button title="Назад до входу" onPress={() => router.back()} />
        </View>
    );
}
// Використовуй ті ж стилі, що й для LoginScreen, або створи нові
const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
    input: { height: 40, borderColor: 'gray', borderWidth: 1, marginBottom: 12, paddingHorizontal: 10 },
});