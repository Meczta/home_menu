// app/(auth)/register.tsx
import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    Image,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import { useRouter } from 'expo-router'; // Link тут не потрібен, якщо є кнопка "Назад"
import { images } from '@/constants/images';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RegisterScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState(''); // Додамо підтвердження пароля
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleRegister = async () => {
        if (!email || !password || !confirmPassword) {
            Alert.alert('Помилка', 'Будь ласка, заповніть всі поля.');
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert('Помилка', 'Паролі не збігаються.');
            return;
        }
        if (password.length < 6) {
            Alert.alert('Помилка', 'Пароль має містити щонайменше 6 символів.');
            return;
        }
        setLoading(true);
        try {
            await auth().createUserWithEmailAndPassword(email, password);
            // Після успішної реєстрації Firebase автоматично логінить користувача.
            // Навігація на головний екран відбудеться автоматично
            // завдяки логіці в app/_layout.tsx.
        } catch (error: any) {
            let errorMessage = 'Виникла помилка. Спробуйте ще раз.';
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'Цей email вже використовується.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Неправильний формат email.';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'Пароль занадто слабкий.';
            }
            Alert.alert('Помилка реєстрації', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.keyboardAvoidingView}
            >
                <ScrollView contentContainerStyle={styles.scrollContainer}>
                    <View style={styles.container}>
                        <Image source={images.bookRecipe} style={styles.logo} />
                        <Text style={styles.title}>Створити акаунт</Text>
                        <Text style={styles.subtitle}>Приєднуйтесь до нас!</Text>

                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            placeholderTextColor="#8A8A8D"
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Пароль (мін. 6 символів)"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            placeholderTextColor="#8A8A8D"
                        />
                        <TextInput // Поле для підтвердження пароля
                            style={styles.input}
                            placeholder="Підтвердіть пароль"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry
                            placeholderTextColor="#8A8A8D"
                        />

                        <TouchableOpacity
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={handleRegister}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.buttonText}>Зареєструватися</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => router.replace('/(auth)/login')} // Замінив router.back() на явний перехід
                            // щоб уникнути проблем, якщо це перший екран
                        >
                            <Text style={styles.backButtonText}>Вже є акаунт? Увійти</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

// Використовуємо схожі стилі, як для LoginScreen
const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#0f0D23',
    },
    keyboardAvoidingView: {
        flex: 1,
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 25,
        paddingBottom: 20,
    },
    logo: {
        width: 100,
        height: 100,
        resizeMode: 'contain',
        marginBottom: 30,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: '#A8B5DB',
        textAlign: 'center',
        marginBottom: 40,
    },
    input: {
        width: '100%',
        height: 50,
        backgroundColor: '#1E1C32',
        borderRadius: 12,
        paddingHorizontal: 15,
        fontSize: 16,
        color: '#FFFFFF',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#2C2C2D',
    },
    button: {
        width: '100%',
        height: 50,
        backgroundColor: '#C37AFF',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
        marginTop: 10,
    },
    buttonDisabled: {
        backgroundColor: '#7A5FAB',
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    backButton: { // Стиль для кнопки "Назад до входу"
        marginTop: 30,
    },
    backButtonText: {
        fontSize: 14,
        color: '#C37AFF',
        fontWeight: 'bold',
    },
});