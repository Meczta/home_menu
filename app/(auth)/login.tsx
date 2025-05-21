// app/(auth)/login.tsx
import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity, // Замінимо Button на TouchableOpacity для кращого стилю
    StyleSheet,
    Alert,
    Image, // Для логотипу
    ActivityIndicator, // Для індикатора завантаження
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import { Link, useRouter } from 'expo-router';
import { images } from '@/constants/images'; // Імпорт твого зображення
import { SafeAreaView } from 'react-native-safe-area-context'; // Для уникнення накладання на статус-бар

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false); // Стан для індикатора завантаження
    const router = useRouter();

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Помилка', 'Будь ласка, введіть email та пароль.');
            return;
        }
        setLoading(true);
        try {
            await auth().signInWithEmailAndPassword(email, password);
            // Навігація на головний екран відбудеться автоматично
            // завдяки логіці в app/_layout.tsx
        } catch (error: any) {
            let errorMessage = 'Виникла помилка. Спробуйте ще раз.';
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                errorMessage = 'Неправильний email або пароль.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Неправильний формат email.';
            }
            Alert.alert('Помилка входу', errorMessage);
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
                        <Text style={styles.title}>Ласкаво просимо!</Text>
                        <Text style={styles.subtitle}>Увійдіть, щоб продовжити</Text>

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
                            placeholder="Пароль"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            placeholderTextColor="#8A8A8D"
                        />

                        <TouchableOpacity
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={handleLogin}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.buttonText}>Увійти</Text>
                            )}
                        </TouchableOpacity>

                        <View style={styles.footer}>
                            <Text style={styles.footerText}>Немає акаунту? </Text>
                            <Link href="/(auth)/register" asChild>
                                <TouchableOpacity>
                                    <Text style={styles.link}>Зареєструватися</Text>
                                </TouchableOpacity>
                            </Link>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#0f0D23', // Фон як на головній
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
        paddingBottom: 20, // Додатковий відступ знизу
    },
    logo: {
        width: 100, // Налаштуй розмір логотипу
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
        backgroundColor: '#1E1C32', // Темний фон для полів
        borderRadius: 12,
        paddingHorizontal: 15,
        fontSize: 16,
        color: '#FFFFFF',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#2C2C2D', // Тонка рамка
    },
    button: {
        width: '100%',
        height: 50,
        backgroundColor: '#C37AFF', // Фіолетовий акцент
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
        marginTop: 10,
    },
    buttonDisabled: {
        backgroundColor: '#7A5FAB', // Затемнений колір для неактивної кнопки
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 30,
    },
    footerText: {
        fontSize: 14,
        color: '#A8B5DB',
    },
    link: {
        fontSize: 14,
        color: '#C37AFF', // Фіолетовий для посилання
        fontWeight: 'bold',
    },
});