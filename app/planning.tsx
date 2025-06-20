// app/planning.tsx
import React, { useState, useCallback } from 'react';
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
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { icons } from '@/constants/icons';
import { images } from '@/constants/images';

// --- Типи даних (ОНОВЛЕНО) ---
interface Recipe {
    id: string;
    name: string;
    imageUrl?: string;
}
interface DayPlan {
    // Тепер це масиви рецептів
    breakfast: Recipe[];
    lunch: Recipe[];
    dinner: Recipe[];
}
interface WeekPlan {
    id:string;
    startDate: Date;
    // Тепер це масиви ID
    days: Record<string, { breakfastRecipeIds?: string[]; lunchRecipeIds?: string[]; dinnerRecipeIds?: string[] }>;
}

// --- Допоміжні функції для роботи з датами (без змін) ---
const getStartOfWeek = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setHours(0, 0, 0, 0);
    return new Date(d.setDate(diff));
};
const formatDate = (date: Date): string => date.toISOString().split('T')[0];
const getDayName = (date: Date, locale: string = 'uk-UA'): string => date.toLocaleDateString(locale, { weekday: 'long' });

// --- Компонент дня (Акордеон) (ОНОВЛЕНО) ---
const DayAccordion = ({ dayDate, dayPlan, onAdd, onRemove, onRecipePress }: {
    dayDate: Date;
    dayPlan: DayPlan | null;
    onAdd: (date: string, meal: 'breakfast' | 'lunch' | 'dinner') => void;
    // onRemove тепер приймає і ID рецепту
    onRemove: (date: string, meal: 'breakfast' | 'lunch' | 'dinner', recipeId: string) => void;
    onRecipePress: (recipeId: string) => void;
}) => {
    const [isExpanded, setIsExpanded] = useState(true);

    const MealSlot = ({ mealKey, mealName, recipes }: { mealKey: 'breakfast' | 'lunch' | 'dinner', mealName: string, recipes: Recipe[] }) => (
        <View style={styles.mealSlot}>
            <View style={styles.mealSlotHeader}>
                <Text style={styles.mealSlotTitle}>{mealName}</Text>
                <TouchableOpacity style={styles.addMealButton} onPress={() => onAdd(formatDate(dayDate), mealKey)}>
                    <Image source={icons.plus} style={styles.addMealIcon} />
                </TouchableOpacity>
            </View>
            {recipes.length > 0 ? (
                recipes.map(recipe => (
                    <TouchableOpacity key={recipe.id} style={styles.mealCard} onPress={() => onRecipePress(recipe.id)}>
                        <Image source={recipe.imageUrl ? { uri: recipe.imageUrl } : images.placeholder} style={styles.mealImage} />
                        <Text style={styles.mealName} numberOfLines={2}>{recipe.name}</Text>
                        <TouchableOpacity style={styles.removeMealButton} onPress={() => onRemove(formatDate(dayDate), mealKey, recipe.id)}>
                            <Image source={icons.close} style={styles.removeMealIcon} />
                        </TouchableOpacity>
                    </TouchableOpacity>
                ))
            ) : (
                <Text style={styles.emptySlotText}>Немає запланованих рецептів</Text>
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
                    <MealSlot mealKey="breakfast" mealName="Сніданок" recipes={dayPlan?.breakfast || []} />
                    <MealSlot mealKey="lunch" mealName="Обід" recipes={dayPlan?.lunch || []} />
                    <MealSlot mealKey="dinner" mealName="Вечеря" recipes={dayPlan?.dinner || []} />
                </View>
            )}
        </View>
    );
};

// --- Основний компонент екрану (ОНОВЛЕНО) ---
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
            const planQuery = await firestore().collection('meal_plans').where('userId', '==', user.uid).where('startDate', '==', firestore.Timestamp.fromDate(weekStartDate)).limit(1).get();
            let currentPlan: WeekPlan | null = null;
            if (planQuery.empty) {
                currentPlan = { id: '', startDate: weekStartDate, days: {} };
            } else {
                const doc = planQuery.docs[0];
                const data = doc.data();
                currentPlan = { id: doc.id, startDate: (data.startDate as FirebaseFirestoreTypes.Timestamp).toDate(), days: data.days || {} };
            }
            setWeekPlan(currentPlan);

            // Оновлена логіка збору всіх ID з масивів
            const recipeIds = Object.values(currentPlan.days).flatMap(day => [
                ...(day.breakfastRecipeIds || []),
                ...(day.lunchRecipeIds || []),
                ...(day.dinnerRecipeIds || [])
            ]);
            const uniqueRecipeIds = [...new Set(recipeIds)];

            if (uniqueRecipeIds.length > 0) {
                const recipesSnapshot = await firestore().collection('recipes').where(firestore.FieldPath.documentId(), 'in', uniqueRecipeIds).get();
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

    useFocusEffect(useCallback(() => { if (currentUser) { fetchPlanAndRecipes(currentWeekStart, currentUser); } else { setLoading(false); } }, [currentUser, currentWeekStart, fetchPlanAndRecipes]));

    const changeWeek = (direction: 'prev' | 'next') => {
        const newDate = new Date(currentWeekStart);
        newDate.setDate(newDate.getDate() + (direction === 'prev' ? -7 : 7));
        setCurrentWeekStart(getStartOfWeek(newDate));
    };

    const createPlanAndGetId = async (): Promise<string | null> => {
        if (!currentUser) return null;
        setLoading(true);
        try {
            const newPlanRef = await firestore().collection('meal_plans').add({ userId: currentUser.uid, startDate: firestore.Timestamp.fromDate(currentWeekStart), days: {} });
            setWeekPlan({ id: newPlanRef.id, startDate: currentWeekStart, days: {} });
            return newPlanRef.id;
        } catch (error) {
            console.error("Помилка створення плану:", error);
            Alert.alert("Помилка", "Не вдалося створити новий план.");
            return null;
        } finally {
            setLoading(false);
        }
    };

    const handleAddRecipeToSlot = async (date: string, meal: 'breakfast' | 'lunch' | 'dinner') => {
        let planId = weekPlan?.id;
        if (!planId) {
            const newPlanId = await createPlanAndGetId();
            if (!newPlanId) return;
            planId = newPlanId;
        }
        router.push({ pathname: '/recipe-selector', params: { planId, date, meal } });
    };

    // Оновлена логіка видалення
    const handleRemoveRecipeFromSlot = async (date: string, meal: 'breakfast' | 'lunch' | 'dinner', recipeId: string) => {
        if (!weekPlan?.id || !currentUser) return;
        const fieldToUpdate = `days.${date}.${meal}RecipeIds`;
        try {
            await firestore().collection('meal_plans').doc(weekPlan.id).update({
                [fieldToUpdate]: firestore.FieldValue.arrayRemove(recipeId)
            });
            fetchPlanAndRecipes(currentWeekStart, currentUser); // Оновлюємо дані
        } catch (error) {
            console.error("Error removing recipe from slot: ", error);
            Alert.alert("Помилка", "Не вдалося видалити рецепт з плану.");
        }
    };

    const handleRecipePress = (recipeId: string) => router.push(`/meals/${recipeId}`);

    const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(currentWeekStart); d.setDate(d.getDate() + i); return d; });
    const currentPlanEndDate = new Date(currentWeekStart);
    currentPlanEndDate.setDate(currentPlanEndDate.getDate() + 6);

    return (
        <SafeAreaView style={styles.safeArea}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => changeWeek('prev')}><Image source={icons.chevron_left} style={styles.navArrow} /></TouchableOpacity>
                <Text style={styles.headerTitle}>{`${currentWeekStart.toLocaleDateString('uk-UA', {day: 'numeric', month: 'short'})} - ${currentPlanEndDate.toLocaleDateString('uk-UA', {day: 'numeric', month: 'short'})}`}</Text>
                <TouchableOpacity onPress={() => changeWeek('next')}><Image source={icons.chevron_right} style={styles.navArrow} /></TouchableOpacity>
            </View>
            {loading ? <ActivityIndicator style={{ marginTop: 50 }} size="large" color="#FFFFFF" /> : (
                <FlatList
                    data={weekDays}
                    keyExtractor={(item) => item.toISOString()}
                    renderItem={({ item }) => {
                        const dateStr = formatDate(item);
                        const dayPlanData = weekPlan?.days[dateStr];
                        const enrichedDayPlan: DayPlan | null = dayPlanData ? {
                            breakfast: dayPlanData.breakfastRecipeIds?.map(id => plannedRecipesDetails[id]).filter(Boolean) || [],
                            lunch: dayPlanData.lunchRecipeIds?.map(id => plannedRecipesDetails[id]).filter(Boolean) || [],
                            dinner: dayPlanData.dinnerRecipeIds?.map(id => plannedRecipesDetails[id]).filter(Boolean) || [],
                        } : null;
                        return <DayAccordion dayDate={item} dayPlan={enrichedDayPlan} onAdd={handleAddRecipeToSlot} onRemove={handleRemoveRecipeFromSlot} onRecipePress={handleRecipePress} />;
                    }}
                    contentContainerStyle={{ paddingBottom: 20 }}
                />
            )}
        </SafeAreaView>
    );
}


// --- Стилі (ОНОВЛЕНО) ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#0f0D23' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 10, paddingBottom: 10 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' },
    navArrow: { width: 28, height: 28, tintColor: '#C37AFF' },
    dayContainer: { marginHorizontal: 20, marginBottom: 15, backgroundColor: '#1E1C32', borderRadius: 12 },
    dayHeader: { flexDirection: 'row', padding: 15, alignItems: 'center' },
    dayHeaderText: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF', textTransform: 'capitalize' },
    dayDateText: { fontSize: 16, color: '#A8B5DB', marginLeft: 'auto', marginRight: 10 },
    chevronIcon: { width: 22, height: 22, tintColor: '#A8B5DB' },
    dayContent: { paddingHorizontal: 15, paddingBottom: 15, paddingTop: 5 },
    mealSlot: { marginBottom: 10 },
    mealSlotHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    mealSlotTitle: { fontSize: 16, color: '#A8B5DB' },
    addMealButton: { padding: 5 },
    addMealIcon: { width: 22, height: 22, tintColor: '#C37AFF' },
    mealCard: { backgroundColor: '#2A3045', borderRadius: 8, flexDirection: 'row', alignItems: 'center', padding: 8, marginBottom: 8 },
    mealImage: { width: 50, height: 50, borderRadius: 6, marginRight: 10 },
    mealName: { fontSize: 16, color: '#FFFFFF', flex: 1 },
    removeMealButton: { padding: 5, marginLeft: 10 },
    removeMealIcon: { width: 20, height: 20, tintColor: '#ff4d4d' },
    emptySlotText: { color: '#8A8A8D', fontStyle: 'italic', marginLeft: 5 }
});