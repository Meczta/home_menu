// app/planning.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    FlatList,
    ActivityIndicator,
    Image,
    Platform,
    StatusBar,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { icons } from '@/constants/icons';
import { images } from '@/constants/images';

// --- Типи даних ---
interface Recipe {
    id: string;
    name: string;
    imageUrl?: string;
    // Додай інші поля, якщо потрібно для відображення
}
interface DayPlan {
    breakfast?: Recipe | null;
    lunch?: Recipe | null;
    dinner?: Recipe | null;
}
interface WeekPlan {
    id: string; // ID документа з meal_plans
    startDate: Date;
    days: Record<string, { breakfastRecipeId?: string; lunchRecipeId?: string; dinnerRecipeId?: string }>;
}

// --- Допоміжні функції для роботи з датами ---
const getStartOfWeek = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Початок тижня з понеділка
    return new Date(d.setDate(diff));
};

const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0]; // РРРР-ММ-ДД
};

const getDayName = (date: Date, locale: string = 'uk-UA'): string => {
    return date.toLocaleDateString(locale, { weekday: 'long' });
};


// --- Компонент дня (Акордеон) ---
const DayAccordion = ({ dayDate, dayPlan, onAdd, onRemove, onRecipePress }: {
    dayDate: Date;
    dayPlan: DayPlan | null;
    onAdd: (date: string, meal: 'breakfast' | 'lunch' | 'dinner') => void;
    onRemove: (date: string, meal: 'breakfast' | 'lunch' | 'dinner') => void;
    onRecipePress: (recipeId: string) => void;
}) => {
    const [isExpanded, setIsExpanded] = useState(true); // За замовчуванням розгорнуто

    const MealSlot = ({ meal, recipe }: { meal: string, recipe: Recipe | null | undefined }) => (
        <View style={styles.mealSlot}>
            <Text style={styles.mealSlotTitle}>{meal}</Text>
            {recipe ? (
                <TouchableOpacity style={styles.mealCard} onPress={() => onRecipePress(recipe.id)}>
                    <Image source={recipe.imageUrl ? { uri: recipe.imageUrl } : images.placeholder} style={styles.mealImage} />
                    <Text style={styles.mealName} numberOfLines={2}>{recipe.name}</Text>
                    <TouchableOpacity style={styles.removeMealButton} onPress={() => onRemove(formatDate(dayDate), meal.toLowerCase() as any)}>
                        <Image source={icons.close} style={styles.removeMealIcon} />
                    </TouchableOpacity>
                </TouchableOpacity>
            ) : (
                <TouchableOpacity style={styles.addMealButton} onPress={() => onAdd(formatDate(dayDate), meal.toLowerCase() as any)}>
                    <Image source={icons.plus} style={styles.addMealIcon} />
                    <Text style={styles.addMealText}>Додати</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    return (
        <View style={styles.dayContainer}>
            <TouchableOpacity style={styles.dayHeader} onPress={() => setIsExpanded(!isExpanded)}>
                <Text style={styles.dayHeaderText}>{getDayName(dayDate)}</Text>
                <Text style={styles.dayDateText}>{dayDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })}</Text>
                <Image source={isExpanded ? icons.chevron_up : icons.chevron_down} style={styles.chevronIcon} />
            </TouchableOpacity>
            {isExpanded && (
                <View style={styles.dayContent}>
                    <MealSlot meal="Сніданок" recipe={dayPlan?.breakfast} />
                    <MealSlot meal="Обід" recipe={dayPlan?.lunch} />
                    <MealSlot meal="Вечеря" recipe={dayPlan?.dinner} />
                </View>
            )}
        </View>
    );
};


// --- Основний компонент екрану ---
export default function PlanningScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [currentWeekStart, setCurrentWeekStart] = useState(getStartOfWeek(new Date()));
    const [weekPlan, setWeekPlan] = useState<WeekPlan | null>(null);
    const [plannedRecipesDetails, setPlannedRecipesDetails] = useState<Record<string, Recipe>>({});

    const currentUser = auth().currentUser;

    const fetchPlanAndRecipes = useCallback(async (weekStartDate: Date, user: FirebaseAuthTypes.User) => {
        setLoading(true);
        try {
            const startDateStr = formatDate(weekStartDate);
            // 1. Завантажуємо план на тиждень
            const planQuery = await firestore()
                .collection('meal_plans')
                .where('userId', '==', user.uid)
                .where('startDate', '==', firestore.Timestamp.fromDate(weekStartDate))
                .limit(1)
                .get();

            let currentPlan: WeekPlan | null = null;
            if (planQuery.empty) {
                console.log('No plan found for this week, creating a blank structure.');
                currentPlan = { id: '', startDate: weekStartDate, days: {} };
            } else {
                const doc = planQuery.docs[0];
                const data = doc.data();
                currentPlan = {
                    id: doc.id,
                    startDate: (data.startDate as FirebaseFirestoreTypes.Timestamp).toDate(),
                    days: data.days || {},
                };
            }
            setWeekPlan(currentPlan);

            // 2. Збираємо всі ID рецептів з плану
            const recipeIds = Object.values(currentPlan.days).flatMap(day =>
                Object.values(day).filter(Boolean)
            );
            const uniqueRecipeIds = [...new Set(recipeIds)];

            // 3. Завантажуємо деталі цих рецептів
            if (uniqueRecipeIds.length > 0) {
                const recipesSnapshot = await firestore()
                    .collection('recipes')
                    .where(firestore.FieldPath.documentId(), 'in', uniqueRecipeIds)
                    .get();

                const recipesDetails: Record<string, Recipe> = {};
                recipesSnapshot.forEach(doc => {
                    recipesDetails[doc.id] = { id: doc.id, ...doc.data() } as Recipe;
                });
                setPlannedRecipesDetails(recipesDetails);
            } else {
                setPlannedRecipesDetails({});
            }

        } catch (error) {
            console.error("Error fetching meal plan: ", error);
            Alert.alert("Помилка", "Не вдалося завантажити план меню.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (currentUser) {
            fetchPlanAndRecipes(currentWeekStart, currentUser);
        } else {
            // Якщо користувача немає, можливо, перенаправити або показати повідомлення
            setLoading(false);
        }
    }, [currentUser, currentWeekStart, fetchPlanAndRecipes]);

    const changeWeek = (direction: 'prev' | 'next') => {
        const newDate = new Date(currentWeekStart);
        newDate.setDate(newDate.getDate() + (direction === 'prev' ? -7 : 7));
        setCurrentWeekStart(getStartOfWeek(newDate));
    };

    const handleAddRecipeToSlot = (date: string, meal: 'breakfast' | 'lunch' | 'dinner') => {
        // Тут буде логіка переходу на екран вибору рецепту
        // Для цього можна використовувати router.push з передачею параметрів
        console.log(`Adding recipe to ${date}, meal: ${meal}`);
        Alert.alert("Функціонал у розробці", "Тут буде відкриватися екран для вибору рецепту.");
        // router.push({ pathname: '/recipe-selector', params: { date, meal, planId: weekPlan?.id } });
    };

    const handleRemoveRecipeFromSlot = async (date: string, meal: 'breakfast' | 'lunch' | 'dinner') => {
        if (!weekPlan || !weekPlan.id || !currentUser) return;

        const fieldToDelete = `days.${date}.${meal}RecipeId`;

        try {
            await firestore().collection('meal_plans').doc(weekPlan.id).update({
                [fieldToDelete]: firestore.FieldValue.delete()
            });
            // Дані оновляться автоматично, якщо додати `onSnapshot` listener.
            // Або можна оновити локально для миттєвого відгуку.
            fetchPlanAndRecipes(currentWeekStart, currentUser);
        } catch (error) {
            console.error("Error removing recipe from slot: ", error);
            Alert.alert("Помилка", "Не вдалося видалити рецепт з плану.");
        }
    };

    const handleRecipePress = (recipeId: string) => {
        router.push(`/meals/${recipeId}`);
    };

    // Генеруємо масив дат для поточного тижня
    const weekDays = Array.from({ length: 7 }).map((_, i) => {
        const date = new Date(currentWeekStart);
        date.setDate(date.getDate() + i);
        return date;
    });

    const currentPlanEndDate = new Date(currentWeekStart);
    currentPlanEndDate.setDate(currentPlanEndDate.getDate() + 6);

    return (
        <SafeAreaView style={styles.safeArea}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => changeWeek('prev')}>
                    <Image source={icons.chevron_left} style={styles.navArrow} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {`${currentWeekStart.toLocaleDateString('uk-UA', {day: 'numeric', month: 'short'})} - ${currentPlanEndDate.toLocaleDateString('uk-UA', {day: 'numeric', month: 'short'})}`}
                </Text>
                <TouchableOpacity onPress={() => changeWeek('next')}>
                    <Image source={icons.chevron_right} style={styles.navArrow} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator style={{ marginTop: 50 }} size="large" color="#FFFFFF" />
            ) : (
                <FlatList
                    data={weekDays}
                    keyExtractor={(item) => item.toISOString()}
                    renderItem={({ item }) => {
                        const dateStr = formatDate(item);
                        const dayPlanData = weekPlan?.days[dateStr];
                        const enrichedDayPlan: DayPlan | null = dayPlanData ? {
                            breakfast: dayPlanData.breakfastRecipeId ? plannedRecipesDetails[dayPlanData.breakfastRecipeId] : null,
                            lunch: dayPlanData.lunchRecipeId ? plannedRecipesDetails[dayPlanData.lunchRecipeId] : null,
                            dinner: dayPlanData.dinnerRecipeId ? plannedRecipesDetails[dayPlanData.dinnerRecipeId] : null,
                        } : null;

                        return (
                            <DayAccordion
                                dayDate={item}
                                dayPlan={enrichedDayPlan}
                                onAdd={handleAddRecipeToSlot}
                                onRemove={handleRemoveRecipeFromSlot}
                                onRecipePress={handleRecipePress}
                            />
                        );
                    }}
                    contentContainerStyle={{ paddingBottom: 20 }}
                />
            )}
            {/* Тут можна додати кнопку "Очистити план" */}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#0f0D23' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 10,
        paddingBottom: 10,
    },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' },
    navArrow: { width: 28, height: 28, tintColor: '#C37AFF' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    dayContainer: { marginHorizontal: 20, marginBottom: 15, backgroundColor: '#1E1C32', borderRadius: 12 },
    dayHeader: {
        flexDirection: 'row',
        padding: 15,
        alignItems: 'center',
    },
    dayHeaderText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
        textTransform: 'capitalize', // Перша літера велика
    },
    dayDateText: {
        fontSize: 16,
        color: '#A8B5DB',
        marginLeft: 'auto',
        marginRight: 10,
    },
    chevronIcon: { width: 22, height: 22, tintColor: '#A8B5DB' },
    dayContent: { padding: 15, paddingTop: 5 },
    mealSlot: { marginBottom: 15 },
    mealSlotTitle: { fontSize: 16, color: '#A8B5DB', marginBottom: 8 },
    mealCard: {
        backgroundColor: '#2A3045',
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
    },
    mealImage: { width: 50, height: 50, borderRadius: 6, marginRight: 10 },
    mealName: { fontSize: 16, color: '#FFFFFF', flex: 1 },
    removeMealButton: { padding: 5, marginLeft: 10 },
    removeMealIcon: { width: 20, height: 20, tintColor: '#ff4d4d' },
    addMealButton: {
        backgroundColor: '#2A3045',
        borderRadius: 8,
        height: 66, // Така сама висота, як у картки з рецептом
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: '#A8B5DB',
    },
    addMealIcon: { width: 20, height: 20, tintColor: '#A8B5DB', marginRight: 10 },
    addMealText: { fontSize: 16, color: '#A8B5DB' },
});