// app/recipe-selector.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, Alert, SafeAreaView, Platform, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { images } from '@/constants/images';
import { icons } from '@/constants/icons';

// --- Типи даних ---
interface Recipe { id: string; name: string; imageUrl?: string; cookingTime: string; }

// --- Компонент картки рецепту ---
const RecipeCard = ({ item, onSelect, isSelected }: { item: Recipe, onSelect: (recipeId: string) => void, isSelected: boolean }) => (
    <TouchableOpacity style={[styles.card, isSelected && styles.selectedCard]} onPress={() => onSelect(item.id)}>
        <Image source={item.imageUrl ? { uri: item.imageUrl } : images.placeholder} style={styles.cardImage} />
        <View style={styles.cardOverlay}>
            <Text style={styles.cardText} numberOfLines={2}>{item.name}</Text>
            <View style={styles.timeContainer}><Image source={icons.time} style={styles.timeIcon} /><Text style={styles.timeText}>{item.cookingTime}</Text></View>
        </View>
        {isSelected && (
            <View style={styles.checkmarkOverlay}>
                <Image source={icons.check} style={styles.checkmarkIcon} />
            </View>
        )}
    </TouchableOpacity>
);

// --- Основний компонент екрану ---
export default function RecipeSelectorScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ planId: string; date: string; meal: 'breakfast' | 'lunch' | 'dinner' }>();

    const [activeTab, setActiveTab] = useState<'my' | 'saved'>('my');
    const [myRecipes, setMyRecipes] = useState<Recipe[]>([]);
    const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [selectedRecipeIds, setSelectedRecipeIds] = useState<string[]>([]);
    const currentUser = auth().currentUser;

    useEffect(() => {
        if (!currentUser) { setLoading(false); return; }
        setLoading(true);
        const fetchMyRecipes = firestore().collection('recipes').where('userId', '==', currentUser.uid).orderBy('createdAt', 'desc')
            .onSnapshot(querySnapshot => {
                const userRecipes: Recipe[] = [];
                querySnapshot.forEach(doc => { userRecipes.push({ id: doc.id, ...doc.data() } as Recipe); });
                setMyRecipes(userRecipes);
            }, error => console.error("Помилка 'Моїх рецептів': ", error));
        const fetchSavedRecipes = firestore().collection('user_bookmarks').where('userId', '==', currentUser.uid)
            .onSnapshot(async bookmarkSnapshot => {
                const recipeIds = bookmarkSnapshot.docs.map(doc => doc.data().recipeId);
                if (recipeIds.length > 0) {
                    const recipesSnapshot = await firestore().collection('recipes').where(firestore.FieldPath.documentId(), 'in', recipeIds).get();
                    const bookmarkedRecipes: Recipe[] = [];
                    recipesSnapshot.forEach(doc => { bookmarkedRecipes.push({ id: doc.id, ...doc.data() } as Recipe); });
                    setSavedRecipes(bookmarkedRecipes);
                } else { setSavedRecipes([]); }
            }, error => console.error("Помилка 'Збережених рецептів': ", error));
        setLoading(false);
        return () => { fetchMyRecipes(); fetchSavedRecipes(); };
    }, [currentUser]);

    const handleToggleRecipeSelection = (recipeId: string) => {
        setSelectedRecipeIds(prevSelected =>
            prevSelected.includes(recipeId)
                ? prevSelected.filter(id => id !== recipeId)
                : [...prevSelected, recipeId]
        );
    };

    // ОСЬ ТУТ ЗНАХОДИТЬСЯ ВИПРАВЛЕННЯ
    const handleConfirmSelection = async () => {
        if (!params.planId || !params.date || !params.meal || selectedRecipeIds.length === 0) return;
        setIsUpdating(true);
        const { planId, date, meal } = params;

        // Правильна назва поля (без шляху)
        const fieldName = `${meal}RecipeIds`; // Результат: 'breakfastRecipeIds'

        // Правильно збудований вкладений об'єкт
        const dataToSet = {
            days: {
                [date]: { // Ключ-дата, напр. "2025-06-15"
                    [fieldName]: firestore.FieldValue.arrayUnion(...selectedRecipeIds)
                }
            }
        };

        try {
            // set з merge: true правильно обробить цю структуру
            await firestore().collection('meal_plans').doc(planId).set(dataToSet, { merge: true });
            router.back();
        } catch (error) {
            console.error("Помилка додавання рецептів в план:", error);
            Alert.alert("Помилка", "Не вдалося додати рецепти.");
        } finally {
            setIsUpdating(false);
        }
    };

    if (loading && myRecipes.length === 0 && savedRecipes.length === 0) { return <ActivityIndicator style={{ flex: 1, justifyContent: 'center', backgroundColor: '#0f0D23' }} size="large" color="#FFFFFF" />; }
    const activeRecipeList = activeTab === 'my' ? myRecipes : savedRecipes;
    const emptyListMessage = activeTab === 'my' ? "У вас ще немає створених рецептів." : "Ви ще не зберегли жодного рецепту.";

    return (
        <SafeAreaView style={styles.safeArea}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.header}><TouchableOpacity onPress={() => router.back()} style={styles.backButton}><Image source={icons.chevron_left} style={styles.backIcon}/></TouchableOpacity><Text style={styles.headerTitle}>Виберіть рецепт(и)</Text></View>
            <View style={styles.tabContainer}><TouchableOpacity style={[styles.tabButton, activeTab === 'my' && styles.activeTabButton]} onPress={() => setActiveTab('my')}><Text style={[styles.tabButtonText, activeTab === 'my' && styles.activeTabButtonText]}>Мої рецепти</Text></TouchableOpacity><TouchableOpacity style={[styles.tabButton, activeTab === 'saved' && styles.activeTabButton]} onPress={() => setActiveTab('saved')}><Text style={[styles.tabButtonText, activeTab === 'saved' && styles.activeTabButtonText]}>Збережені</Text></TouchableOpacity></View>
            {isUpdating && <ActivityIndicator style={styles.updateIndicator} size="large" color="#C37AFF" />}
            <FlatList
                data={activeRecipeList}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <RecipeCard item={item} onSelect={handleToggleRecipeSelection} isSelected={selectedRecipeIds.includes(item.id)} />}
                numColumns={2}
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={<Text style={styles.emptyText}>{emptyListMessage}</Text>}
            />
            {selectedRecipeIds.length > 0 && (
                <View style={styles.footer}>
                    <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmSelection} disabled={isUpdating}>
                        <Text style={styles.confirmButtonText}>Додати вибрані ({selectedRecipeIds.length})</Text>
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
}

// --- Стилі (без змін) ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#0f0D23' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 10, paddingBottom: 10 },
    backButton: { padding: 10 },
    backIcon: { width: 28, height: 28, tintColor: '#C37AFF' },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 22, fontWeight: 'bold', color: '#FFFFFF', marginRight: 48 },
    tabContainer: { flexDirection: 'row', justifyContent: 'center', marginHorizontal: 20, marginBottom: 15, backgroundColor: '#1E1C32', borderRadius: 12, padding: 4 },
    tabButton: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
    activeTabButton: { backgroundColor: '#C37AFF' },
    tabButtonText: { color: '#A8B5DB', fontSize: 16, fontWeight: '600' },
    activeTabButtonText: { color: '#FFFFFF' },
    listContainer: { paddingHorizontal: 5, paddingBottom: 20 },
    card: { flex: 1, margin: 5, aspectRatio: 0.9, borderRadius: 12, backgroundColor: '#1E1C32', overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
    selectedCard: { borderColor: '#C37AFF' },
    cardImage: { width: '100%', height: '100%' },
    cardOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', padding: 10 },
    cardText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
    timeContainer: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 4 },
    timeIcon: { width: 14, height: 14, tintColor: '#FFFFFF', marginRight: 4 },
    timeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
    checkmarkOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(195, 122, 255, 0.5)', justifyContent: 'center', alignItems: 'center' },
    checkmarkIcon: { width: 40, height: 40, tintColor: '#FFFFFF' },
    emptyText: { color: '#A8B5DB', textAlign: 'center', marginTop: 50, fontSize: 16, paddingHorizontal: 20 },
    updateIndicator: { position: 'absolute', top: '50%', left: '50%', zIndex: 10 },
    footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#1E1C32', backgroundColor: '#0f0D23' },
    confirmButton: { backgroundColor: '#C37AFF', paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
    confirmButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});