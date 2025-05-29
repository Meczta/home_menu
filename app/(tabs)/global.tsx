// app/(tabs)/global.tsx (або search.tsx, якщо ти його ще не перейменувала)
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    Image,
    Text,
    View,
    FlatList,
    ActivityIndicator,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Platform,
    StatusBar,
    Alert,
    ScrollView, // Для тегів
} from "react-native";
import { images } from "@/constants/images";
import { icons } from "@/constants/icons";
import { useRouter } from "expo-router";
import auth, { FirebaseAuthTypes } from "@react-native-firebase/auth";
import firestore, { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import { SafeAreaView } from 'react-native-safe-area-context';

// Список доступних тегів (такий самий, як на сторінці додавання)
const AVAILABLE_TAGS = [
    "десерт", "суп", "випічка", "закуска",
    "солоне", "солодке", "кисле",
    "сніданок", "обід", "вечеря",
    "варене", "здорове харчування", "напої"
];

// Кольори для тегів (можна винести в constants/colors.ts)
const TAG_BACKGROUND_COLOR = '#2A3045';
const TAG_BACKGROUND_COLOR_SELECTED = '#7E57C2';
const TAG_TEXT_COLOR = '#A0A0B0';
const TAG_TEXT_COLOR_SELECTED = '#FFFFFF';

interface UserData { // Тип для даних автора
    uid: string;
    displayName?: string | null;
    photoURL?: string | null;
}

interface Recipe {
    id: string;
    name: string;
    cookingTime: string;
    ingredients: string;
    description: string;
    imageUrl?: string;
    userId: string; // ID автора
    isPublic: boolean;
    createdAt?: FirebaseFirestoreTypes.Timestamp;
    tags?: string[];
    author?: UserData; // Додаємо дані автора до рецепту для зручності відображення
}

// Компонент картки рецепту - тепер з інформацією про автора
const RecipeCardItem = ({ item, onPress }: { item: Recipe; onPress: () => void }) => (
    <TouchableOpacity onPress={onPress} style={styles.recipeCard}>
        <Image
            source={item.imageUrl ? { uri: item.imageUrl } : images.placeholder}
            style={styles.recipeImage}
            resizeMode="cover"
        />
        <View style={styles.recipeInfo}>
            <Text style={styles.recipeName} numberOfLines={2}>{item.name}</Text>
            <View style={styles.recipeTimeContainer}>
                <Image source={icons.clock} style={styles.recipeTimeIcon} />
                <Text style={styles.recipeTime}>{item.cookingTime}</Text>
            </View>
            {/* Відображення автора */}
            {item.author && (
                <View style={styles.authorContainer}>
                    <Image
                        source={item.author.photoURL ? {uri: item.author.photoURL} : images.placeholder} // Потрібна іконка profile_default
                        style={styles.authorAvatar}
                    />
                    <Text style={styles.authorName} numberOfLines={1}>
                        {item.author.displayName || 'Анонімний кухар'}
                    </Text>
                </View>
            )}
        </View>
    </TouchableOpacity>
);

export default function GlobalRecipesScreen() { // Перейменовано
    const router = useRouter();
    const [allPublicRecipes, setAllPublicRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedSearchTags, setSelectedSearchTags] = useState<string[]>([]);
    const currentUser = auth().currentUser;

    // Функція для завантаження даних авторів для списку рецептів
    const fetchAuthorsForRecipes = async (recipesToEnrich: Recipe[]): Promise<Recipe[]> => {
        if (recipesToEnrich.length === 0) return [];

        const authorIds = [...new Set(recipesToEnrich.map(recipe => recipe.userId).filter(Boolean))]; // Унікальні ID авторів
        if (authorIds.length === 0) return recipesToEnrich;

        const authorsData: Record<string, UserData> = {};

        // Розбиваємо authorIds на частини по 10 (максимум для 'in' запиту в Firestore для ID)
        const CHUNK_SIZE = 10;
        for (let i = 0; i < authorIds.length; i += CHUNK_SIZE) {
            const chunk = authorIds.slice(i, i + CHUNK_SIZE);
            if (chunk.length > 0) {
                try {
                    const usersSnapshot = await firestore()
                        .collection("users") // Припускаємо, що колекція користувачів називається 'users'
                        .where(firestore.FieldPath.documentId(), "in", chunk)
                        .get();

                    usersSnapshot.forEach(doc => {
                        authorsData[doc.id] = { uid: doc.id, ...doc.data() } as UserData;
                    });
                } catch (error) {
                    console.error("Error fetching authors for chunk:", chunk, error);
                }
            }
        }

        return recipesToEnrich.map(recipe => ({
            ...recipe,
            author: authorsData[recipe.userId],
        }));
    };


    useEffect(() => {
        setLoading(true);
        let query = firestore()
            .collection("recipes")
            .where("isPublic", "==", true)
            .orderBy("createdAt", "desc");

        if (currentUser) {
            query = query.where("userId", "!=", currentUser.uid);
        }

        const subscriber = query.onSnapshot(
            async (querySnapshot) => {
                console.log("GlobalRecipesScreen: onSnapshot triggered for public recipes.");
                const publicRecipes: Recipe[] = [];
                if (querySnapshot) {
                    querySnapshot.forEach((documentSnapshot) => {
                        publicRecipes.push({
                            id: documentSnapshot.id,
                            ...(documentSnapshot.data() as Omit<Recipe, 'id'>),
                        });
                    });
                }

                // Завантажуємо дані авторів для отриманих рецептів
                const recipesWithAuthors = await fetchAuthorsForRecipes(publicRecipes);
                setAllPublicRecipes(recipesWithAuthors);
                setLoading(false);
            },
            (error) => {
                console.error("Error fetching public recipes: ", error);
                setLoading(false);
                //Alert.alert("Помилка", "Не вдалося завантажити публічні рецепти.");
            }
        );

        return () => {
            console.log("GlobalRecipesScreen: Unsubscribing from public recipes listener.");
            subscriber();
        };
    }, [currentUser]);

    const handleToggleSearchTag = (tag: string) => {
        setSelectedSearchTags(prevTags =>
            prevTags.includes(tag)
                ? prevTags.filter(t => t !== tag)
                : [...prevTags, tag]
        );
    };

    const filteredRecipes = useMemo(() => {
        let recipesToFilter = allPublicRecipes;

        if (searchQuery) {
            const lowerCaseQuery = searchQuery.toLowerCase();
            recipesToFilter = recipesToFilter.filter((recipe) => {
                const nameMatch = recipe.name.toLowerCase().includes(lowerCaseQuery);
                const ingredientsMatch = recipe.ingredients.toLowerCase().includes(lowerCaseQuery);
                return nameMatch || ingredientsMatch;
            });
        }

        if (selectedSearchTags.length > 0) {
            recipesToFilter = recipesToFilter.filter(recipe =>
                selectedSearchTags.every(tag => recipe.tags && recipe.tags.includes(tag))
            );
        }
        return recipesToFilter;
    }, [allPublicRecipes, searchQuery, selectedSearchTags]);

    const handleRecipePress = (recipeId: string) => {
        router.push(`/meals/${recipeId}`);
    };

    if (loading && allPublicRecipes.length === 0) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.containerCentered}>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <FlatList
                data={filteredRecipes}
                keyExtractor={(item) => item.id}
                numColumns={2}
                renderItem={({ item }) => (
                    <RecipeCardItem item={item} onPress={() => handleRecipePress(item.id)} />
                )}
                ListHeaderComponent={
                    <>
                        <Text style={styles.pageTitle}>Глобальні рецепти</Text>
                        <View style={styles.searchBarContainer}>
                            <Image source={icons.search} style={styles.searchIcon} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Пошук за назвою або інгредієнтами"
                                placeholderTextColor="#A8B5DB"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>
                        <Text style={styles.tagsSectionTitle}>Фільтрувати за тегами:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsScrollContainer}>
                            {AVAILABLE_TAGS.map(tag => (
                                <TouchableOpacity
                                    key={tag}
                                    style={[
                                        styles.tagButton,
                                        selectedSearchTags.includes(tag) && styles.tagButtonSelected
                                    ]}
                                    onPress={() => handleToggleSearchTag(tag)}
                                >
                                    <Text
                                        style={[
                                            styles.tagText,
                                            selectedSearchTags.includes(tag) && styles.tagTextSelected
                                        ]}
                                    >
                                        {tag}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        {(filteredRecipes.length > 0 || (!searchQuery && allPublicRecipes.length > 0 && selectedSearchTags.length === 0)) && (
                            <Text style={styles.sectionTitle}>Знайдені рецепти</Text>
                        )}
                    </>
                }
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyContainer}>
                            <Image source={searchQuery || selectedSearchTags.length > 0 ? icons.notFound : images.placeholder} // Іконка для порожнього глобального списку
                                   style={styles.emptyIcon}
                                   resizeMode="contain"
                            />
                            <Text style={styles.emptyText}>
                                {searchQuery || selectedSearchTags.length > 0
                                    ? "За вашими критеріями нічого не знайдено."
                                    : "Поки що немає публічних рецептів для відображення."}
                            </Text>
                        </View>
                    ) : null
                }
                contentContainerStyle={styles.listContentContainer}
                showsVerticalScrollIndicator={false}
            />
        </SafeAreaView>
    );
}

// Стилі, аналогічні до index.tsx, але з додаванням стилів для автора в картці
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: "#0f0D23" },
    containerCentered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0D23' },
    pageTitle: { fontSize: 26, fontWeight: 'bold', color: '#FFFFFF', textAlign: 'center', marginTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 20 : 20, marginBottom: 20 },
    searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1C32', borderRadius: 12, paddingHorizontal: 15, marginHorizontal: 20, marginBottom: 15, height: 50 },
    searchIcon: { width: 20, height: 20, tintColor: '#A8B5DB', marginRight: 10 },
    searchInput: { flex: 1, fontSize: 16, color: "#FFFFFF" },
    tagsSectionTitle: { fontSize: 16, fontWeight: '600', color: '#A8B5DB', marginLeft: 20, marginBottom: 10, marginTop: 10 },
    tagsScrollContainer: { paddingHorizontal: 20, paddingBottom: 15 },
    tagButton: { backgroundColor: TAG_BACKGROUND_COLOR, paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: '#2A3045' },
    tagButtonSelected: { backgroundColor: TAG_BACKGROUND_COLOR_SELECTED, borderColor: TAG_BACKGROUND_COLOR_SELECTED },
    tagText: { color: TAG_TEXT_COLOR, fontSize: 14 },
    tagTextSelected: { color: TAG_TEXT_COLOR_SELECTED, fontWeight: 'bold' },
    sectionTitle: { fontSize: 20, fontWeight: "bold", color: "#FFFFFF", marginLeft: 20, marginBottom: 10, marginTop: 10 },
    listContentContainer: { paddingHorizontal: 12, paddingBottom: 90 },
    recipeCard: { flex: 1, margin: 8, backgroundColor: "#1E1C32", borderRadius: 15, overflow: "hidden" },
    recipeImage: { width: "100%", height: 110 }, // Зробив зображення трохи меншим, щоб вмістити автора
    recipeInfo: { padding: 10 }, // Зменшив падінг
    recipeName: { fontSize: 15, fontWeight: "bold", color: "#FFFFFF", marginBottom: 4 }, // Трохи менший шрифт
    recipeTimeContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 }, // Додав відступ знизу
    recipeTimeIcon: { width: 12, height: 12, tintColor: '#A8B5DB', marginRight: 4 },
    recipeTime: { fontSize: 11, color: "#A8B5DB" },
    authorContainer: { // Нові стилі для блоку автора
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 5,
    },
    authorAvatar: {
        width: 24, // Маленький аватар
        height: 24,
        borderRadius: 12,
        marginRight: 6,
        backgroundColor: '#3C3F5E', // Заглушка, якщо немає фото
    },
    authorName: {
        fontSize: 11,
        color: '#A8B5DB',
        flexShrink: 1, // Щоб довге ім'я обрізалося
    },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, marginTop: 30 },
    emptyIcon: { width: 80, height: 80, tintColor: '#A8B5DB', marginBottom: 20 },
    emptyText: { fontSize: 16, color: '#A8B5DB', textAlign: 'center', marginBottom: 20 },
    addButton: { backgroundColor: '#C37AFF', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 25 },
    addButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }
});