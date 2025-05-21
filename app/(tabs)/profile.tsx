// app/(tabs)/profile.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator, Image } from 'react-native';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useRouter } from 'expo-router';
import { icons } from '@/constants/icons'; // Припускаю, що тут може бути іконка для користувача або налаштувань

export default function ProfileScreen() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<FirebaseAuthTypes.User | null>(null);
    const [recipeCount, setRecipeCount] = useState(0);
    const [loadingInfo, setLoadingInfo] = useState(true);

    useEffect(() => {
        const user = auth().currentUser;
        setCurrentUser(user);

        if (user) {
            // Завантажуємо кількість рецептів користувача
            const recipesSubscriber = firestore()
                .collection('recipes')
                .where('userId', '==', user.uid)
                .onSnapshot(querySnapshot => {
                    setRecipeCount(querySnapshot ? querySnapshot.size : 0);
                    setLoadingInfo(false);
                }, error => {
                    console.error("Error fetching recipe count: ", error);
                    setLoadingInfo(false);
                });

            return () => recipesSubscriber(); // Відписуємося від слухача
        } else {
            setLoadingInfo(false);
        }
    }, []);

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
                            // завдяки логіці в app/_layout.tsx
                            // router.replace('/(auth)/login'); // Можна додати для явності, якщо потрібно
                        } catch (error: any) {
                            Alert.alert("Помилка виходу", error.message);
                        }
                    },
                    style: "destructive"
                }
            ]
        );
    };

    if (loadingInfo) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <View style={styles.headerSection}>
                {/* Тут можна додати аватар користувача */}
                {/* <Image source={currentUser?.photoURL ? { uri: currentUser.photoURL } : icons.profile_default} style={styles.avatar} /> */}
                <Text style={styles.greetingText}>Привіт!</Text>
                <Text style={styles.emailText}>{currentUser?.email || 'Гість'}</Text>
            </View>

            <View style={styles.infoSection}>
                <View style={styles.infoBox}>
                    <Text style={styles.infoBoxValue}>{recipeCount}</Text>
                    <Text style={styles.infoBoxLabel}>Створено рецептів</Text>
                </View>
                {/* Тут можна додати інші інформаційні блоки, наприклад, кількість збережених рецептів */}
                {/* <View style={styles.infoBox}>
          <Text style={styles.infoBoxValue}>0</Text>
          <Text style={styles.infoBoxLabel}>Збережено рецептів</Text>
        </View> */}
            </View>

            {/* Розділ Налаштування (приклад) */}
            {/* <View style={styles.section}>
        <Text style={styles.sectionTitle}>Налаштування</Text>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuItemText}>Змінити пароль</Text>
          <Image source={icons.chevron_right} style={styles.menuItemIcon} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuItemText}>Редагувати профіль</Text>
          <Image source={icons.chevron_right} style={styles.menuItemIcon} />
        </TouchableOpacity>
      </View> */}


            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutButtonText}>Вийти з системи</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f0D23', // Такий самий фон, як на головній
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    contentContainer: {
        paddingVertical: 30,
        paddingHorizontal: 20,
    },
    headerSection: {
        alignItems: 'center',
        marginBottom: 30,
    },
    avatar: { // Стиль для аватара, якщо додаси
        width: 100,
        height: 100,
        borderRadius: 50,
        marginBottom: 15,
        backgroundColor: '#1E1C32', // Заглушка, якщо немає фото
    },
    greetingText: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 5,
    },
    emailText: {
        fontSize: 16,
        color: '#A8B5DB',
        marginBottom: 30,
    },
    infoSection: {
        flexDirection: 'row',
        justifyContent: 'space-around', // Або 'space-between'
        marginBottom: 40,
    },
    infoBox: {
        backgroundColor: '#1E1C32',
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderRadius: 12,
        alignItems: 'center',
        minWidth: 140, // Мінімальна ширина для боксу
    },
    infoBoxValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    infoBoxLabel: {
        fontSize: 14,
        color: '#A8B5DB',
        marginTop: 5,
    },
    section: {
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 15,
    },
    menuItem: {
        backgroundColor: '#1E1C32',
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderRadius: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    menuItemText: {
        fontSize: 16,
        color: '#E0E0E0',
    },
    menuItemIcon: { // Якщо будеш додавати іконки до пунктів меню
        width: 20,
        height: 20,
        tintColor: '#A8B5DB',
    },
    logoutButton: {
        backgroundColor: '#C37AFF', // Фіолетовий акцент
        paddingVertical: 15,
        borderRadius: 25,
        alignItems: 'center',
        marginTop: 20,
    },
    logoutButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});