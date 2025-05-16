// app/meals/[id].tsx
import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
    View,
    Text,
    Image,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    Alert,
    Switch, // Для галочки публічності
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { icons } from '@/constants/icons'; // Припускаю, що тут є іконка для "назад" та "три крапки"
import { images } from '@/constants/images'; // Для placeholder, якщо зображення немає

// Тип для рецепту (можна імпортувати, якщо він вже визначений глобально)
interface Recipe {
    id: string;
    name: string;
    cookingTime: string;
    ingredients: string;
    description: string;
    imageUrl?: string;
    userId: string;
    isPublic: boolean;
    createdAt?: FirebaseFirestoreTypes.Timestamp;
}

export default function RecipeDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>(); // Отримуємо ID рецепту з URL
    const router = useRouter();
    const [recipe, setRecipe] = useState<Recipe | null>(null);
    const [loading, setLoading] = useState(true);
    const [isOwner, setIsOwner] = useState(false);
    const [showMenu, setShowMenu] = useState(false); // Для показу меню видалення

    const currentUser = auth().currentUser;

    useEffect(() => {
        if (id) {
            setLoading(true);
            const subscriber = firestore()
                .collection('recipes')
                .doc(id)
                .onSnapshot(
                    (documentSnapshot) => {
                        if (documentSnapshot.exists()) {
                            const recipeData = {
                                id: documentSnapshot.id,
                                ...documentSnapshot.data(),
                            } as Recipe;
                            setRecipe(recipeData);
                            if (currentUser && recipeData.userId === currentUser.uid) {
                                setIsOwner(true);
                            } else {
                                setIsOwner(false);
                            }
                        } else {
                            console.log('Recipe does not exist!');
                            setRecipe(null); // Або перенаправити на сторінку "не знайдено"
                            Alert.alert("Помилка", "Рецепт не знайдено.");
                            router.back();
                        }
                        setLoading(false);
                    },
                    (error) => {
                        console.error('Error fetching recipe details: ', error);
                        setLoading(false);
                        Alert.alert("Помилка", "Не вдалося завантажити деталі рецепту.");
                        router.back();
                    }
                );

            // Відписатися від слухача при розмонтуванні
            return () => subscriber();
        } else {
            Alert.alert("Помилка", "ID рецепту не вказано.");
            router.back();
        }
    }, [id, currentUser]); // Додаємо currentUser, щоб перевіряти власника при зміні користувача

    // Налаштування заголовка з кнопкою "назад" та трьома крапками (якщо власник)
    // useLayoutEffect використовується для налаштування опцій екрану до його повного рендерингу
    useLayoutEffect(() => {
        if (recipe) {
            // Цей підхід для динамічного заголовка може потребувати Stack.Screen в _layout.tsx для цього маршруту
            // Або використання опцій навігації безпосередньо тут, якщо твій _layout.tsx це дозволяє
            // Для простоти, я покажу, як це можна було б зробити, якщо б Stack був налаштований в app/_layout.tsx
            // Якщо meals/[id] є частиною Stack в app/_layout.tsx, то можна так:
            // router.setOptions(...) не існує, потрібно використовувати Stack.Screen options або navigation.setOptions
            // Оскільки ми в Expo Router, краще це робити через Stack.Screen в _layout.tsx цього сегменту (app/meals/_layout.tsx)
            // Або, якщо це екран верхнього рівня, то в app/_layout.tsx
            // Наразі, для простоти, припустимо, що ти можеш налаштувати заголовок через Stack.Screen
            // у відповідному _layout.tsx файлі.
            // Кнопку "три крапки" ми додамо вручну в JSX нижче.
        }
    }, [recipe, isOwner, router]); // navigation потрібно буде отримати через useNavigation, якщо потрібно


    const handleDeleteRecipe = async () => {
        if (!recipe || !isOwner) return;

        Alert.alert(
            'Видалити рецепт',
            `Ви впевнені, що хочете видалити рецепт "${recipe.name}"?`,
            [
                { text: 'Скасувати', style: 'cancel' },
                {
                    text: 'Видалити',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await firestore().collection('recipes').doc(recipe.id).delete();
                            Alert.alert('Успіх', 'Рецепт видалено.');
                            router.back(); // Повертаємося на попередній екран
                        } catch (error: any) {
                            console.error('Error deleting recipe: ', error);
                            Alert.alert('Помилка', 'Не вдалося видалити рецепт.');
                        }
                    },
                },
            ]
        );
        setShowMenu(false); // Ховаємо меню після вибору
    };

    const toggleIsPublic = async () => {
        if (!recipe || !isOwner) return;

        const newIsPublicStatus = !recipe.isPublic;
        try {
            await firestore().collection('recipes').doc(recipe.id).update({
                isPublic: newIsPublicStatus,
            });
            setRecipe(prev => prev ? { ...prev, isPublic: newIsPublicStatus } : null); // Оновлюємо стан локально
            Alert.alert('Статус оновлено', `Рецепт тепер ${newIsPublicStatus ? 'публічний' : 'приватний'}.`);
        } catch (error: any) {
            console.error('Error updating isPublic status: ', error);
            Alert.alert('Помилка', 'Не вдалося оновити статус публічності.');
        }
    };

    if (loading || !recipe) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
        );
    }

    return (
        <View style={styles.mainContainer}>
            <Stack.Screen options={{
                headerShown: true, // Показуємо заголовок для цього екрану
                headerTitle: recipe.name, // Динамічний заголовок
                headerStyle: { backgroundColor: '#0f0D23' }, // Колір фону заголовка
                headerTintColor: '#FFFFFF', // Колір тексту та іконок у заголовку
                headerRight: () => (
                    isOwner ? (
                        <TouchableOpacity onPress={() => setShowMenu(!showMenu)} style={{ padding: 8 }}>
                            <Image source={icons.dots} style={{ width: 24, height: 24, tintColor: '#FFFFFF' }} /> {/* Потрібна іконка icons.dots */}
                        </TouchableOpacity>
                    ) : null
                )
            }}/>

            {/* Меню для видалення (з'являється при натисканні на три крапки) */}
            {showMenu && isOwner && (
                <View style={styles.optionsMenu}>
                    <TouchableOpacity onPress={handleDeleteRecipe} style={styles.menuItem}>
                        <Text style={styles.menuItemText}>Видалити рецепт</Text>
                    </TouchableOpacity>
                    {/* Тут можна додати "Редагувати рецепт" пізніше */}
                </View>
            )}

            <ScrollView contentContainerStyle={styles.scrollContentContainer}>
                <Image
                    source={recipe.imageUrl ? { uri: recipe.imageUrl } : images.placeholder}
                    style={styles.recipeImage}
                />
                <View style={styles.contentContainer}>
                    <Text style={styles.recipeTitle}>{recipe.name}</Text>

                    {/* Секція Інгредієнти */}
                    <Text style={styles.sectionHeader}>Інгредієнти</Text>
                    <View style={styles.ingredientsBox}>
                        {/* Розділяємо рядок інгредієнтів для кращого відображення */}
                        {recipe.ingredients.split(/,|\n/).map((ingredient, index) => (
                            ingredient.trim() ? <Text key={index} style={styles.ingredientText}>• {ingredient.trim()}</Text> : null
                        ))}
                    </View>

                    {/* Секція Час приготування */}
                    <Text style={styles.sectionHeader}>Час приготування</Text>
                    <Text style={styles.infoText}>{recipe.cookingTime}</Text>

                    {/* Секція Опис приготування */}
                    <Text style={styles.sectionHeader}>Опис приготування</Text>
                    <Text style={styles.descriptionText}>{recipe.description}</Text>

                    {/* Перемикач публічності (тільки для власника) */}
                    {isOwner && (
                        <View style={styles.isPublicContainer}>
                            <Text style={styles.isPublicLabel}>Публічний рецепт:</Text>
                            <Switch
                                trackColor={{ false: "#767577", true: "#81b0ff" }}
                                thumbColor={recipe.isPublic ? "#f5dd4b" : "#f4f3f4"}
                                ios_backgroundColor="#3e3e3e"
                                onValueChange={toggleIsPublic}
                                value={recipe.isPublic}
                            />
                        </View>
                    )}

                    {/* Кнопка "Повернутись" (якщо це "Visit Homepage" з макета) */}
                    {/* У тебе вона називається "Visit Homepage", можливо, це посилання на зовнішній ресурс?
              Або це просто кнопка "Назад"? Я зроблю її як "Назад".
          */}
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <Text style={styles.backButtonText}>Повернутись назад</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        backgroundColor: '#0f0D23', // Темний фон, як на макеті
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0f0D23',
    },
    scrollContentContainer: {
        paddingBottom: 30,
    },
    recipeImage: {
        width: '100%',
        height: 300, // Або інша висота, як на макеті
        resizeMode: 'cover',
    },
    contentContainer: {
        paddingHorizontal: 20,
        paddingTop: 20,
        backgroundColor: '#0f0D23', // Фон для текстового контенту
        borderTopLeftRadius: 0, // Якщо потрібно заокруглення зверху для цього блоку
        borderTopRightRadius: 0,
        marginTop: 0, // Якщо зображення займає всю ширину зверху
    },
    recipeTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 20,
        // textAlign: 'center', // Якщо потрібно по центру
    },
    sectionHeader: {
        fontSize: 20,
        fontWeight: '600', // Semibold
        color: '#FFFFFF',
        marginTop: 25,
        marginBottom: 10,
    },
    ingredientsBox: {
        backgroundColor: '#1E1C32', // Фон для блоку інгредієнтів
        borderRadius: 12,
        paddingVertical: 15,
        paddingHorizontal: 20,
        marginBottom: 15,
    },
    ingredientText: {
        fontSize: 16,
        color: '#E0E0E0', // Світлий текст для інгредієнтів
        lineHeight: 24,
    },
    infoText: {
        fontSize: 16,
        color: '#E0E0E0',
        marginBottom: 15,
        lineHeight: 24,
    },
    descriptionText: {
        fontSize: 16,
        color: '#E0E0E0',
        lineHeight: 24,
        textAlign: 'justify', // Або 'left'
    },
    isPublicContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 30,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#2C2C2D',
    },
    isPublicLabel: {
        fontSize: 16,
        color: '#FFFFFF',
    },
    backButton: {
        backgroundColor: '#C37AFF', // Фіолетовий колір, як на макеті для кнопки
        paddingVertical: 15,
        borderRadius: 25, // Дуже заокруглені краї
        alignItems: 'center',
        marginTop: 40, // Відступ зверху
    },
    backButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    optionsMenu: {
        position: 'absolute',
        top: 50, // Налаштуй позицію під заголовком
        right: 15,
        backgroundColor: '#1E1C32',
        borderRadius: 8,
        padding: 10,
        zIndex: 10, // Щоб було над іншими елементами
        elevation: 5,
    },
    menuItem: {
        paddingVertical: 10,
    },
    menuItemText: {
        color: '#FFFFFF',
        fontSize: 16,
    },
});