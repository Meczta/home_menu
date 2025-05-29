// app/(tabs)/saved.tsx
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
} from "react-native";
import { images } from "@/constants/images";
import { icons } from "@/constants/icons";
import { useRouter } from "expo-router";
import auth, {FirebaseAuthTypes} from "@react-native-firebase/auth";
import firestore, { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import { SafeAreaView } from 'react-native-safe-area-context';

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

export default function SavedRecipesScreen() {
    const router = useRouter();
    const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const currentUser = auth().currentUser;

    const fetchSavedRecipes = useCallback(async (user: FirebaseAuthTypes.User | null) => {
        if (!user) {
            console.log("fetchSavedRecipes: No user provided, clearing saved recipes and stopping loading.");
            setSavedRecipes([]);
            setLoading(false);
            return;
        }

        console.log(`fetchSavedRecipes: Called for user ${user.uid}. Setting loading to true.`);
        setLoading(true);
        try {
            // 1. Отримуємо ID рецептів, які користувач зберіг
            console.log("fetchSavedRecipes: Fetching bookmarks from 'user_bookmarks' collection...");
            const bookmarksSnapshot = await firestore()
                .collection("user_bookmarks")
                .where("userId", "==", user.uid)
                .orderBy("savedAt", "desc")
                .get();

            console.log(`fetchSavedRecipes: Bookmarks snapshot fetched. Empty: ${bookmarksSnapshot.empty}, Size: ${bookmarksSnapshot.size}`);

            const recipeIds = bookmarksSnapshot.docs.map(doc => {
                const data = doc.data();
                console.log("fetchSavedRecipes: Bookmark document data:", data); // Логуємо дані кожної закладки
                return data.recipeId as string;
            });
            console.log("fetchSavedRecipes: Extracted recipeIds:", JSON.stringify(recipeIds));

            if (recipeIds.length === 0) {
                console.log("fetchSavedRecipes: No recipeIds found in bookmarks. Setting empty saved recipes.");
                setSavedRecipes([]);
                setLoading(false);
                return;
            }

            // 2. Завантажуємо дані цих рецептів з колекції 'recipes'
            console.log("fetchSavedRecipes: Preparing to fetch recipe details for IDs:", JSON.stringify(recipeIds));
            const recipesData: Recipe[] = [];
            const CHUNK_SIZE = 30; // Firestore 'in' query підтримує до 30 елементів
            for (let i = 0; i < recipeIds.length; i += CHUNK_SIZE) {
                const chunkOfIds = recipeIds.slice(i, i + CHUNK_SIZE);
                if (chunkOfIds.length > 0) {
                    console.log("fetchSavedRecipes: Fetching recipes for ID chunk:", JSON.stringify(chunkOfIds));
                    const recipesDetailsSnapshot = await firestore()
                        .collection("recipes")
                        .where(firestore.FieldPath.documentId(), "in", chunkOfIds)
                        .get();

                    console.log(`fetchSavedRecipes: Recipes details snapshot for chunk fetched. Size: ${recipesDetailsSnapshot.size}`);
                    recipesDetailsSnapshot.forEach((doc) => {
                        recipesData.push({ id: doc.id, ...doc.data() } as Recipe);
                    });
                }
            }
            console.log(`fetchSavedRecipes: Total recipe details fetched: ${recipesData.length} out of ${recipeIds.length} IDs.`);

            // Зберігаємо порядок, в якому рецепти були збережені
            const orderedRecipes = recipeIds.map(id =>
                recipesData.find(recipe => recipe.id === id)
            ).filter(Boolean) as Recipe[]; // filter(Boolean) для видалення undefined

            console.log("fetchSavedRecipes: Final ordered recipes count:", orderedRecipes.length);
            setSavedRecipes(orderedRecipes);

        } catch (error: any) { // Додав : any для error, щоб уникнути помилки типу
            console.error("fetchSavedRecipes: Error fetching saved recipes: ", error.message, error.code, JSON.stringify(error));
            Alert.alert("Помилка", `Не вдалося завантажити збережені рецепти. ${error.message}`);
        } finally {
            console.log("fetchSavedRecipes: Setting loading to false.");
            setLoading(false);
        }
    }, []); // useCallback з порожнім масивом залежностей


    useEffect(() => {
        console.log("SavedRecipesScreen: useEffect triggered. Current user:", currentUser?.uid || "No user");
        if (currentUser) {
            // Початкове завантаження рецептів
            fetchSavedRecipes(currentUser);

            // Підписка на зміни в закладках
            console.log("SavedRecipesScreen: Subscribing to 'user_bookmarks' for user:", currentUser.uid);
            const bookmarksSubscriber = firestore()
                .collection("user_bookmarks")
                .where("userId", "==", currentUser.uid)
                .onSnapshot(async (bookmarksSnapshot) => { // Зробив колбек асинхронним для await
                    console.log("SavedRecipesScreen: Bookmarks onSnapshot triggered. Re-fetching saved recipes.");
                    // Коли закладки змінюються, перезавантажуємо рецепти
                    // fetchSavedRecipes тут може бути викликано безпосередньо з актуальним currentUser
                    // або можна було б просто оновити список ID і потім рецепти
                    await fetchSavedRecipes(currentUser); // Додав await, якщо fetchSavedRecipes асинхронна
                }, (error) => { // TypeScript може тут вивести тип error як Error або unknown
                    let errorCode = "N/A";
                    let errorMessage = "Невідома помилка";

                    if (error instanceof Error) { // Стандартна перевірка типу Error
                        errorMessage = error.message;
                    }

                    // Перевіряємо, чи error є об'єктом і має властивість 'code' (специфічно для Firebase)
                    if (typeof error === 'object' && error !== null && 'code' in error) {
                        errorCode = (error as any).code; // Приводимо до any, щоб отримати доступ до code
                        // Або, якщо ти знаєш точний тип помилки Firebase, можна використовувати його
                        // наприклад, if (error instanceof FirebaseError) { errorCode = error.code; }
                        // Але для цього потрібен був би імпорт FirebaseError
                    }

                    // Для детального логування всього об'єкта помилки (якщо він є об'єктом)
                    const errorDetails = (typeof error === 'object' && error !== null) ? JSON.stringify(error) : String(error);

                    console.error(
                        "SavedRecipesScreen: Error listening to bookmarks: ",
                        errorMessage,
                        `Code: ${errorCode}`,
                        errorDetails
                    );
                    // setLoading(false); // setLoading(false) вже є в fetchSavedRecipes finally
                    Alert.alert("Помилка", "Не вдалося оновити список збережених рецептів.");
                });

            return () => {
                console.log("SavedRecipesScreen: Unsubscribing from 'user_bookmarks'.");
                bookmarksSubscriber();
            };
        } else {
            console.log("SavedRecipesScreen: No current user in useEffect. Clearing recipes and loader.");
            setSavedRecipes([]);
            setLoading(false);
        }
    }, [currentUser, fetchSavedRecipes]); // Додав fetchSavedRecipes до масиву залежностей

    const filteredRecipes = useMemo(() => {
        if (!searchQuery) {
            return savedRecipes;
        }
        const lowerCaseQuery = searchQuery.toLowerCase();
        return savedRecipes.filter((recipe) => {
            const nameMatch = recipe.name.toLowerCase().includes(lowerCaseQuery);
            const ingredientsMatch = recipe.ingredients.toLowerCase().includes(lowerCaseQuery);
            return nameMatch || ingredientsMatch;
        });
    }, [savedRecipes, searchQuery]);

    const handleRecipePress = (recipeId: string) => {
        router.push(`/meals/${recipeId}`);
    };

    if (loading && savedRecipes.length === 0) {
        console.log("SavedRecipesScreen: Render - Loading indicator shown (initial load).");
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.containerCentered}>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                </View>
            </SafeAreaView>
        );
    }

    console.log("SavedRecipesScreen: Render - Main list. Filtered recipes count:", filteredRecipes.length);
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
                        <Text style={styles.pageTitle}>Збережені рецепти</Text>
                        <View style={styles.searchBarContainer}>
                            <Image source={icons.search} style={styles.searchIcon} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Пошук серед збережених..."
                                placeholderTextColor="#A8B5DB"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>
                    </>
                }
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyContainer}>
                            <Image source={searchQuery ? icons.notFound : icons.bookmark_unsaved}
                                   style={styles.emptyIcon}
                                   resizeMode="contain"
                            />
                            <Text style={styles.emptyText}>
                                {searchQuery
                                    ? "За вашим запитом нічого не знайдено серед збережених."
                                    : "Ви ще не зберегли жодного рецепту."}
                            </Text>
                            {!searchQuery && (
                                <TouchableOpacity onPress={() => router.push('/(tabs)/search')} style={styles.addButton}>
                                    <Text style={styles.addButtonText}>Знайти рецепти</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ) : null
                }
                contentContainerStyle={styles.listContentContainer}
                showsVerticalScrollIndicator={false}
            />
        </SafeAreaView>
    );
}

// Стилі залишаються такими ж, як у попередньому повідомленні
const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: "#0f0D23",
    },
    pageTitle: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center',
        marginTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 20 : 20,
        marginBottom: 20,
    },
    containerCentered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0f0D23',
    },
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E1C32',
        borderRadius: 12,
        paddingHorizontal: 15,
        marginHorizontal: 20,
        marginBottom: 25,
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
    listContentContainer: {
        paddingHorizontal: 12,
        paddingBottom: 90,
    },
    recipeCard: {
        flex: 1,
        margin: 8,
        backgroundColor: "#1E1C32",
        borderRadius: 15,
        overflow: "hidden",
    },
    recipeImage: {
        width: "100%",
        height: 130,
    },
    recipeInfo: {
        padding: 12,
    },
    recipeName: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#FFFFFF",
        marginBottom: 5,
    },
    recipeTimeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    recipeTimeIcon: {
        width: 14,
        height: 14,
        tintColor: '#A8B5DB',
        marginRight: 5,
    },
    recipeTime: {
        fontSize: 12,
        color: "#A8B5DB",
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginTop: 30,
    },
    emptyIcon: {
        width: 80,
        height: 80,
        tintColor: '#A8B5DB',
        marginBottom: 20,
    },
    emptyText: {
        fontSize: 16,
        color: '#A8B5DB',
        textAlign: 'center',
        marginBottom: 20,
    },
    addButton: {
        backgroundColor: '#C37AFF',
        paddingVertical: 12,
        paddingHorizontal: 25,
        borderRadius: 25,
    },
    addButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    }
});