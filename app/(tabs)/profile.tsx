// app/(tabs)/profile.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ScrollView,
    ActivityIndicator,
    Image,
    TextInput,
    Platform,
    StatusBar,
} from 'react-native';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore, {FirebaseFirestoreTypes} from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { icons } from '@/constants/icons';
import { images } from '@/constants/images'; // Якщо використовується для фону чи чогось ще
import { SafeAreaView } from 'react-native-safe-area-context'; // Для відступів зверху/знизу

// Кольори
const PRIMARY_BACKGROUND_COLOR = '#0f0D23'; // Той самий фон, що й на головній/додаванні
const INPUT_BACKGROUND_COLOR = '#1E1C32'; // Для полів та інформаційних блоків
const TEXT_COLOR_PRIMARY = '#FFFFFF';
const TEXT_COLOR_SECONDARY = '#A8B5DB';
const ACCENT_COLOR = '#C37AFF';
const PLACEHOLDER_TEXT_COLOR = '#8A8A8D';


interface UserProfileData {
    displayName?: string | null;
    email?: string | null;
    photoURL?: string | null;
    createdAt?: FirebaseFirestoreTypes.Timestamp;
}

export default function ProfileScreen() {
    const router = useRouter(); // router використовується для навігації після певних дій
    const [userAuth, setUserAuth] = useState<FirebaseAuthTypes.User | null>(null);
    const [userData, setUserData] = useState<UserProfileData | null>(null);
    const [recipeCount, setRecipeCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isEditingName, setIsEditingName] = useState(false);
    const [newDisplayName, setNewDisplayName] = useState('');
    const [isUploadingImage, setIsUploadingImage] = useState(false);

    const loadUserData = useCallback(async (firebaseUser: FirebaseAuthTypes.User) => {
        setLoading(true);
        try {
            const userDoc = await firestore().collection('users').doc(firebaseUser.uid).get();
            // @ts-ignore
            if (userDoc.exists) {
                const fetchedData = userDoc.data() as UserProfileData;
                setUserData(fetchedData);
                setNewDisplayName(fetchedData.displayName || firebaseUser.displayName || '');
            } else {
                setUserData({
                    displayName: firebaseUser.displayName,
                    email: firebaseUser.email,
                    photoURL: firebaseUser.photoURL,
                });
                setNewDisplayName(firebaseUser.displayName || '');
            }

            const recipesSnapshot = await firestore()
                .collection('recipes')
                .where('userId', '==', firebaseUser.uid)
                .get();
            setRecipeCount(recipesSnapshot.size);

        } catch (error) {
            console.error("Error fetching user data or recipe count: ", error);
            Alert.alert("Помилка", "Не вдалося завантажити дані профілю.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const subscriber = auth().onAuthStateChanged(firebaseUser => {
            setUserAuth(firebaseUser);
            if (firebaseUser) {
                loadUserData(firebaseUser);
            } else {
                setUserData(null);
                setRecipeCount(0);
                setLoading(false);
            }
        });
        return subscriber;
    }, [loadUserData]);

    // --- ОСЬ ФУНКЦІЯ ВИХОДУ ---
    const handleLogout = async () => {
        Alert.alert(
            "Вихід з системи",
            "Ви впевнені, що хочете вийти?",
            [
                {
                    text: "Скасувати",
                    style: "cancel"
                },
                {
                    text: "Вийти",
                    onPress: async () => {
                        try {
                            await auth().signOut();
                            // Навігація на екран входу відбудеться автоматично
                            // завдяки логіці в app/_layout.tsx.
                            // router.replace('/(auth)/login'); // Цей рядок тут зазвичай не потрібен.
                        } catch (error: any) {
                            console.error("Error signing out: ", error);
                            Alert.alert("Помилка виходу", error.message || "Не вдалося вийти з системи.");
                        }
                    },
                    style: "destructive"
                }
            ]
        );
    };
    // --- КІНЕЦЬ ФУНКЦІЇ ВИХОДУ ---


    const handlePickImage = async () => {
        if (!userAuth) return;
        setIsUploadingImage(true);
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1], // Для квадратного аватара
                quality: 0.5,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const imageUri = result.assets[0].uri;
                const filename = imageUri.substring(imageUri.lastIndexOf('/') + 1);
                const uploadUri = Platform.OS === 'ios' ? imageUri.replace('file://', '') : imageUri;

                const storageRef = storage().ref(`avatars/${userAuth.uid}/${filename}`);
                await storageRef.putFile(uploadUri);
                const photoURL = await storageRef.getDownloadURL();

                await userAuth.updateProfile({ photoURL });
                await firestore().collection('users').doc(userAuth.uid).update({ photoURL });

                setUserData(prev => prev ? { ...prev, photoURL } : { photoURL });
                setUserAuth(auth().currentUser); // Оновити локальний стан userAuth, щоб побачити зміни
                Alert.alert("Успіх", "Фото профілю оновлено!");
            }
        } catch (error: any) {
            console.error("Error uploading image: ", error);
            Alert.alert("Помилка", "Не вдалося завантажити зображення.");
        } finally {
            setIsUploadingImage(false);
        }
    };

    const handleSaveName = async () => {
        if (!userAuth || !newDisplayName.trim()) {
            Alert.alert("Помилка", "Ім'я не може бути порожнім.");
            return;
        }
        setLoading(true); // Можна додати окремий лоадер для імені
        try {
            await userAuth.updateProfile({ displayName: newDisplayName.trim() });
            await firestore().collection('users').doc(userAuth.uid).update({
                displayName: newDisplayName.trim()
            });
            setUserData(prev => prev ? { ...prev, displayName: newDisplayName.trim() } : { displayName: newDisplayName.trim() });
            setUserAuth(auth().currentUser);
            setIsEditingName(false);
            Alert.alert("Успіх", "Ім'я оновлено!");
        } catch (error: any) {
            console.error("Error updating display name: ", error);
            Alert.alert("Помилка", "Не вдалося оновити ім'я.");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.centered}> {/* <--- ВИПРАВЛЕНО */}
                <ActivityIndicator size="large" color={TEXT_COLOR_PRIMARY} />
            </View>
        );
    }

    if (!userAuth) {
        return (
            <View style={styles.centered}> {/* <--- ВИПРАВЛЕНО */}
                <Text style={styles.infoText}>Не вдалося завантажити профіль. Спробуйте увійти знову.</Text>
                {/* Можна додати кнопку для переходу на екран входу, якщо router доступний */}
                <TouchableOpacity style={styles.logoutButton} onPress={() => router.replace('/(auth)/login')}>
                    <Text style={styles.logoutButtonText}>Перейти до Входу</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const displayNameToShow = userData?.displayName || userAuth.displayName || "Користувач";
    const photoURLToShow = userData?.photoURL || userAuth.photoURL;

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.profileHeader}>
                    <TouchableOpacity onPress={handlePickImage} style={styles.avatarContainer} disabled={isUploadingImage}>
                        <Image
                            source={photoURLToShow ? { uri: photoURLToShow } : images.placeholder}
                            style={styles.avatar}
                        />
                        <View style={styles.cameraIconOverlay}>
                            {isUploadingImage ?
                                <ActivityIndicator size="small" color={PRIMARY_BACKGROUND_COLOR} /> :
                                <Image source={icons.camera} style={styles.cameraIcon} />
                            }
                        </View>
                    </TouchableOpacity>

                    {!isEditingName ? (
                        <View style={styles.nameContainer}>
                            <Text style={styles.displayName} numberOfLines={1} ellipsizeMode="tail">{displayNameToShow}</Text>
                            <TouchableOpacity onPress={() => {
                                setNewDisplayName(displayNameToShow);
                                setIsEditingName(true);
                            }}>
                                <Image source={icons.edit} style={styles.editIcon} />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.editNameContainer}>
                            <TextInput
                                style={styles.nameInput}
                                value={newDisplayName}
                                onChangeText={setNewDisplayName}
                                placeholder="Введіть нове ім'я"
                                placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
                                autoFocus
                            />
                            <View style={styles.editNameButtonsRow}>
                                <TouchableOpacity onPress={() => setIsEditingName(false)} style={[styles.editNameButton, styles.cancelNameButton]}>
                                    <Text style={[styles.editNameButtonText, styles.cancelNameButtonText]}>Скасувати</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleSaveName} style={[styles.editNameButton, styles.saveNameButton]}>
                                    <Text style={[styles.editNameButtonText, styles.saveNameButtonText]}>Зберегти</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                    <Text style={styles.emailText}>{userAuth.email}</Text>
                </View>

                <View style={styles.statsContainer}>
                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>{recipeCount}</Text>
                        <Text style={styles.statLabel}>Рецептів</Text>
                    </View>
                    {/* ... інші блоки статистики ... */}
                </View>

                {/* ... Розділ Налаштування (якщо потрібен) ... */}

                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Text style={styles.logoutButtonText}>Вийти з системи</Text>
                </TouchableOpacity>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: PRIMARY_BACKGROUND_COLOR,
    },
    scrollView: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 + 20 : 30,
        paddingBottom: 40,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: PRIMARY_BACKGROUND_COLOR, // Додано фон
        paddingHorizontal: 20, // Щоб текст помилки не прилипав до країв
    },
    profileHeader: {
        alignItems: 'center',
        marginBottom: 25, // Зменшив
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 15,
    },
    avatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 3,
        borderColor: ACCENT_COLOR,
        backgroundColor: INPUT_BACKGROUND_COLOR, // Фон для випадку, якщо зображення не завантажилось
    },
    cameraIconOverlay: {
        position: 'absolute',
        bottom: 5,
        right: 5,
        backgroundColor: TEXT_COLOR_PRIMARY,
        borderRadius: 15,
        padding: 6, // Збільшив для кращого вигляду
        elevation: 2, // Тінь на Android
    },
    cameraIcon: {
        width: 18, // Зменшив
        height: 18,
        tintColor: PRIMARY_BACKGROUND_COLOR,
    },
    nameContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        paddingHorizontal: 10, // Щоб довге ім'я не прилипало до іконки редагування
    },
    displayName: {
        fontSize: 24, // Зменшив
        fontWeight: 'bold',
        color: TEXT_COLOR_PRIMARY,
        marginRight: 10,
        textAlign: 'center', // Якщо ім'я одне, центруємо
    },
    editIcon: {
        width: 20,
        height: 20,
        tintColor: ACCENT_COLOR,
    },
    editNameContainer: {
        width: '100%',
        alignItems: 'center',
        marginBottom: 8,
        paddingHorizontal: '10%', // Обмежимо ширину поля вводу
    },
    nameInput: {
        width: '100%', // Тепер 100% від editNameContainer
        backgroundColor: INPUT_BACKGROUND_COLOR,
        color: TEXT_COLOR_PRIMARY,
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingVertical: 10,
        fontSize: 18,
        textAlign: 'center',
        marginBottom: 10,
        borderWidth: 1,
        borderColor: ACCENT_COLOR,
    },
    editNameButtonsRow: { // Новий контейнер для кнопок редагування
        flexDirection: 'row',
        justifyContent: 'space-around', // Розміщуємо кнопки з проміжком
        width: '100%',
    },
    editNameButtonText: { // <--- ОСНОВНИЙ СТИЛЬ ДЛЯ ТЕКСТУ КНОПОК РЕДАГУВАННЯ
        fontSize: 14, // Розмір шрифту
        fontWeight: '600', // Напівжирний
    },
    editNameButton: { // Загальний стиль для кнопок
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 8,
        minWidth: 100, // Мінімальна ширина
        alignItems: 'center',
    },
    saveNameButton: {
        backgroundColor: ACCENT_COLOR,
    },
    saveNameButtonText: {
        color: TEXT_COLOR_PRIMARY,
        fontWeight: 'bold',
    },
    cancelNameButton: {
        backgroundColor: 'transparent', // Прозора кнопка скасування
        borderWidth: 1,
        borderColor: TEXT_COLOR_SECONDARY,
    },
    cancelNameButtonText: {
        color: TEXT_COLOR_SECONDARY,
    },
    emailText: {
        fontSize: 16,
        color: TEXT_COLOR_SECONDARY,
    },
    infoText: { // Додав стиль для тексту помилки, якщо !userAuth
        fontSize: 16,
        color: TEXT_COLOR_SECONDARY,
        textAlign: 'center',
        marginBottom: 20,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 30,
        backgroundColor: INPUT_BACKGROUND_COLOR,
        paddingVertical: 20,
        borderRadius: 12,
    },
    statBox: {
        alignItems: 'center',
        flex: 1, // Щоб бокси займали однакову ширину
    },
    statValue: {
        fontSize: 22,
        fontWeight: 'bold',
        color: TEXT_COLOR_PRIMARY,
    },
    statLabel: {
        fontSize: 14,
        color: TEXT_COLOR_SECONDARY,
        marginTop: 4,
    },
    logoutButton: {
        backgroundColor: ACCENT_COLOR,
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 30, // Збільшив відступ
    },
    logoutButtonText: {
        color: TEXT_COLOR_PRIMARY,
        fontSize: 16,
        fontWeight: 'bold',
    },
});