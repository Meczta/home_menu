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
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth'; // Імпортуємо FirebaseAuthTypes
import firestore from '@react-native-firebase/firestore'; // Імпортуємо firestore
import { useRouter } from 'expo-router';
import { images } from '@/constants/images';
import { SafeAreaView } from 'react-native-safe-area-context';

// Кольори зі стилю login.tsx для консистентності
const PRIMARY_BACKGROUND_COLOR = '#0f0D23';
const INPUT_BACKGROUND_COLOR = '#1E1C32';
const TEXT_COLOR = '#FFFFFF';
const PLACEHOLDER_TEXT_COLOR = '#8A8A8D';
const ACCENT_COLOR = '#C37AFF';
const DISABLED_ACCENT_COLOR = '#7A5FAB';
const BORDER_COLOR = '#2C2C2D';

export default function RegisterScreen() {
    const [displayName, setDisplayName] = useState(''); // <--- НОВИЙ СТАН для імені
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleRegister = async () => {
        if (!displayName || !email || !password || !confirmPassword) { // <--- Додано перевірку displayName
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
            const userCredential: FirebaseAuthTypes.UserCredential = await auth().createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            if (user) {
                // 1. Оновлюємо профіль користувача в Firebase Authentication (додаємо displayName)
                await user.updateProfile({
                    displayName: displayName,
                });

                // 2. Створюємо запис про користувача в колекції 'users' у Firestore
                // Це дозволить зберігати додаткову інформацію про користувача
                await firestore().collection('users').doc(user.uid).set({
                    uid: user.uid,
                    email: user.email,
                    displayName: displayName,
                    createdAt: firestore.FieldValue.serverTimestamp(),
                    // Тут можна буде додати photoURL: null або початкове значення
                });

                console.log('User account created & signed in! DisplayName set.');
                // Навігація на головний екран відбудеться автоматично
                // завдяки логіці в app/_layout.tsx.
            }

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
                <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
                    <View style={styles.container}>
                        <Image source={images.bookRecipe} style={styles.logo} />
                        <Text style={styles.title}>Створити акаунт</Text>
                        <Text style={styles.subtitle}>Приєднуйтесь до нас!</Text>

                        <TextInput // <--- НОВЕ ПОЛЕ для імені
                            style={styles.input}
                            placeholder="Ваше ім'я або нікнейм"
                            value={displayName}
                            onChangeText={setDisplayName}
                            autoCapitalize="words" // Перша літера кожного слова велика
                            placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
                        />

                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Пароль (мін. 6 символів)"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Підтвердіть пароль"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry
                            placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
                        />

                        <TouchableOpacity
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={handleRegister}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color={TEXT_COLOR} />
                            ) : (
                                <Text style={styles.buttonText}>Зареєструватися</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => router.replace('/(auth)/login')}
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
        backgroundColor: PRIMARY_BACKGROUND_COLOR,
    },
    keyboardAvoidingView: {
        flex: 1,
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    container: {
        // flex: 1, // Забираємо flex:1, щоб ScrollView міг скролитися, якщо контенту багато
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 25,
        paddingVertical: 20, // Додав вертикальний падінг
    },
    logo: {
        width: 80, // Трохи зменшив лого
        height: 80,
        resizeMode: 'contain',
        marginBottom: 25, // Зменшив відступ
    },
    title: {
        fontSize: 26, // Трохи зменшив
        fontWeight: 'bold',
        color: TEXT_COLOR,
        textAlign: 'center',
        marginBottom: 8, // Зменшив
    },
    subtitle: {
        fontSize: 15, // Трохи зменшив
        color: PLACEHOLDER_TEXT_COLOR, // Використовуємо константу
        textAlign: 'center',
        marginBottom: 30, // Зменшив
    },
    input: {
        width: '100%',
        height: 50,
        backgroundColor: INPUT_BACKGROUND_COLOR,
        borderRadius: 12,
        paddingHorizontal: 15,
        fontSize: 16,
        color: TEXT_COLOR,
        marginBottom: 18, // Зменшив
        borderWidth: 1,
        borderColor: BORDER_COLOR,
    },
    button: {
        width: '100%',
        height: 50,
        backgroundColor: ACCENT_COLOR,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
        marginTop: 10, // Зменшив
    },
    buttonDisabled: {
        backgroundColor: DISABLED_ACCENT_COLOR,
    },
    buttonText: {
        color: TEXT_COLOR,
        fontSize: 18,
        fontWeight: 'bold',
    },
    backButton: {
        marginTop: 25, // Зменшив
    },
    backButtonText: {
        fontSize: 14,
        color: ACCENT_COLOR,
        fontWeight: 'bold',
    },
});