// app/(tabs)/index.tsx
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
    ScrollView, // Додамо для горизонтального скролу тегів
} from "react-native";
import { images } from "@/constants/images";
import { icons } from "@/constants/icons";
import { useRouter } from "expo-router";
import auth from "@react-native-firebase/auth";
import firestore, { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import { SafeAreaView } from 'react-native-safe-area-context';

// Список доступних тегів (такий самий, як на сторінці додавання)
// Можна винести в окремий файл constants/tags.ts
const AVAILABLE_TAGS = [
    "десерт", "суп", "випічка", "закуска",
    "солоне", "солодке", "кисле",
    "сніданок", "обід", "вечеря",
    "варене", "здорове харчування", "напої"
];

// Кольори для тегів (можна винести в constants/colors.ts)
const TAG_BACKGROUND_COLOR = '#2A3045'; // Такий самий, як INPUT_BACKGROUND_COLOR
const TAG_BACKGROUND_COLOR_SELECTED = '#7E57C2'; // ACCENT_COLOR_BUTTON
const TAG_TEXT_COLOR = '#A0A0B0'; // PLACEHOLDER_TEXT_COLOR
const TAG_TEXT_COLOR_SELECTED = '#FFFFFF'; // TEXT_COLOR_ON_DARK

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
    tags?: string[];
}

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
        </View>
    </TouchableOpacity>
);

export default function IndexScreen() {
    const router = useRouter();
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedSearchTags, setSelectedSearchTags] = useState<string[]>([]); // <--- Стан для вибраних тегів
    const currentUser = auth().currentUser;

    useEffect(() => {
        if (currentUser) {
            setLoading(true);
            const subscriber = firestore()
                .collection("recipes")
                .where("userId", "==", currentUser.uid)
                .orderBy("createdAt", "desc")
                .onSnapshot(
                    (querySnapshot) => {
                        console.log("IndexScreen: onSnapshot triggered for user recipes");
                        const userRecipesData: Recipe[] = [];
                        if (querySnapshot) {
                            querySnapshot.forEach((documentSnapshot) => {
                                userRecipesData.push({
                                    id: documentSnapshot.id,
                                    ...(documentSnapshot.data() as Omit<Recipe, 'id'>),
                                });
                            });
                        }
                        setRecipes(userRecipesData);
                        setLoading(false);
                    },
                    (error) => {
                        console.error("Error fetching user recipes (onSnapshot): ", error);
                        setLoading(false);
                        // Alert.alert("Помилка", "Не вдалося завантажити ваші рецепти.");
                    }
                );
            return () => {
                console.log("IndexScreen: Unsubscribing from user recipes listener.");
                subscriber();
            };
        } else {
            setRecipes([]);
            setLoading(false);
        }
    }, [currentUser]);

    const handleToggleSearchTag = (tag: string) => {
        setSelectedSearchTags(prevTags =>
            prevTags.includes(tag)
                ? prevTags.filter(t => t !== tag)
                : [...prevTags, tag]
        );
    };

    const filteredRecipes = useMemo(() => {
        let recipesToFilter = recipes;

        // Фільтрація за пошуковим запитом (назва та інгредієнти)
        if (searchQuery) {
            const lowerCaseQuery = searchQuery.toLowerCase();
            recipesToFilter = recipesToFilter.filter((recipe) => {
                const nameMatch = recipe.name.toLowerCase().includes(lowerCaseQuery);
                const ingredientsMatch = recipe.ingredients.toLowerCase().includes(lowerCaseQuery);
                return nameMatch || ingredientsMatch;
            });
        }

        // Фільтрація за вибраними тегами (логіка "І")
        if (selectedSearchTags.length > 0) {
            recipesToFilter = recipesToFilter.filter(recipe =>
                selectedSearchTags.every(tag => recipe.tags && recipe.tags.includes(tag))
            );
        }

        return recipesToFilter;
    }, [recipes, searchQuery, selectedSearchTags]); // <--- Додано selectedSearchTags до залежностей

    const handleRecipePress = (recipeId: string) => {
        router.push(`/meals/${recipeId}`);
    };

    if (loading && recipes.length === 0) {
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
                        <View style={styles.headerContentContainer}>
                            <Image
                                source={icons.logo}
                                style={styles.logo}
                                resizeMode="contain"
                            />
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
                            {/* Секція вибору тегів для пошуку */}
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
                        </View>
                        {(filteredRecipes.length > 0 || (!searchQuery && recipes.length > 0 && selectedSearchTags.length === 0)) && (
                            <Text style={styles.sectionTitle}>Мої рецепти</Text>
                        )}
                    </>
                }
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyContainer}>
                            <Image source={searchQuery ? icons.notFound : icons.empty_recipes_folder}
                                   style={styles.emptyIcon}
                                   resizeMode="contain"
                            />
                            <Text style={styles.emptyText}>
                                {searchQuery
                                    ? "За вашим запитом нічого не знайдено."
                                    : "У вас ще немає створених рецептів."}
                            </Text>
                            {!searchQuery && (
                                <TouchableOpacity onPress={() => router.push('/(tabs)/add')} style={styles.addButton}>
                                    <Text style={styles.addButtonText}>Створити перший рецепт</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ) : null
                }
                contentContainerStyle={styles.listContentContainer}
                showsVerticalScrollIndicator={false}
                // refreshControl більше не потрібен
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: "#0f0D23",
    },
    containerCentered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0f0D23',
    },
    headerContentContainer: {
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 20,
    },
    logo: {
        width: 50,
        height: 40,
        marginBottom: 15, // Зменшив
        alignSelf: "center",
    },
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E1C32',
        borderRadius: 12,
        paddingHorizontal: 15,
        marginHorizontal: 20,
        marginBottom: 15, // Зменшив
        height: 50,
    },
    searchIcon: {
        width: 20,
        height: 20,
        tintColor: '#A8B5DB',
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: "#FFFFFF",
    },
    tagsSectionTitle: { // Новий стиль для заголовка секції тегів
        fontSize: 16,
        fontWeight: '600',
        color: '#A8B5DB', // Менш яскравий, ніж основний заголовок секції
        marginLeft: 20,
        marginBottom: 10,
    },
    tagsScrollContainer: { // Стиль для горизонтального ScrollView з тегами
        paddingHorizontal: 20,
        paddingBottom: 15, // Відступ знизу для тіні або простору
    },
    tagButton: { // Стиль для кнопки тегу (схожий на той, що в add.tsx)
        backgroundColor: TAG_BACKGROUND_COLOR,
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 20,
        marginRight: 10, // Відстань між тегами
        borderWidth: 1,
        borderColor: '#2A3045', // Темніша рамка для неактивних
    },
    tagButtonSelected: {
        backgroundColor: TAG_BACKGROUND_COLOR_SELECTED,
        borderColor: TAG_BACKGROUND_COLOR_SELECTED,
    },
    tagText: {
        color: TAG_TEXT_COLOR,
        fontSize: 14,
    },
    tagTextSelected: {
        color: TAG_TEXT_COLOR_SELECTED,
        fontWeight: 'bold',
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#FFFFFF",
        marginLeft: 20,
        marginBottom: 10,
        marginTop: 10, // Додав відступ зверху, якщо є теги
    },
    listContentContainer: {
        paddingHorizontal: 12,
        paddingBottom: 90,
    },
    // ... (решта стилів: recipeCard, recipeImage, ..., addButtonText залишаються такими ж)
    recipeCard: { flex: 1, margin: 8, backgroundColor: "#1E1C32", borderRadius: 15, overflow: "hidden" },
    recipeImage: { width: "100%", height: 130 },
    recipeInfo: { padding: 12 },
    recipeName: { fontSize: 16, fontWeight: "bold", color: "#FFFFFF", marginBottom: 5 },
    recipeTimeContainer: { flexDirection: 'row', alignItems: 'center' },
    recipeTimeIcon: { width: 14, height: 14, tintColor: '#A8B5DB', marginRight: 5 },
    recipeTime: { fontSize: 12, color: "#A8B5DB" },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, marginTop: 30 },
    emptyIcon: { width: 80, height: 80, tintColor: '#A8B5DB', marginBottom: 20 },
    emptyText: { fontSize: 16, color: '#A8B5DB', textAlign: 'center', marginBottom: 20 },
    addButton: { backgroundColor: '#C37AFF', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 25 },
    addButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }
});