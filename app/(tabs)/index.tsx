// app/(tabs)/index.tsx
import React, { useState, useEffect, useMemo } from "react";
import {
    Image,
    // ScrollView, // ScrollView тут не потрібен, якщо використовується FlatList
    Text,
    View,
    FlatList,
    ActivityIndicator,
    StyleSheet,
    TouchableOpacity,
    TextInput, // TextInput вже імпортовано
    Platform, // Додамо для відступів
    StatusBar, Alert,  // Додамо для відступів
} from "react-native";
import { images } from "@/constants/images";
import { icons } from "@/constants/icons";
// Якщо ти використовуєш свій компонент SearchBar, імпортуй його.
// Я бачу, що він закоментований, тому використовую TextInput.
// import SearchBar from "@/components/SearchBar";
import { useRouter } from "expo-router";
import auth from "@react-native-firebase/auth";
import firestore, { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";

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

// Компонент картки рецепту
// РЕКОМЕНДАЦІЯ: Винеси цей компонент в окремий файл (наприклад, components/RecipeCardItem.tsx)
// та імпортуй його сюди і в global.tsx, щоб уникнути дублювання.
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

export default function IndexScreen() { // Перейменовано з Index на IndexScreen для ясності
    const router = useRouter();
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
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
                        const userRecipes: Recipe[] = [];
                        if (querySnapshot) {
                            querySnapshot.forEach((documentSnapshot) => {
                                userRecipes.push({
                                    id: documentSnapshot.id,
                                    ...(documentSnapshot.data() as Omit<Recipe, 'id'>),
                                });
                            });
                        }
                        setRecipes(userRecipes);
                        setLoading(false);
                    },
                    (error) => {
                        console.error("Error fetching user recipes: ", error);
                        setLoading(false);
                        // Alert.alert("Помилка", "Не вдалося завантажити ваші рецепти.");
                    }
                );
            return () => subscriber();
        } else {
            setRecipes([]);
            setLoading(false);
        }
    }, [currentUser]);

    const filteredRecipes = useMemo(() => {
        if (!searchQuery) {
            return recipes;
        }
        const lowerCaseQuery = searchQuery.toLowerCase();
        return recipes.filter((recipe) => {
            const nameMatch = recipe.name.toLowerCase().includes(lowerCaseQuery);
            const ingredientsMatch = recipe.ingredients.toLowerCase().includes(lowerCaseQuery); // <--- ДОДАНО ПОШУК ПО ІНГРЕДІЄНТАХ
            return nameMatch || ingredientsMatch;
        });
    }, [recipes, searchQuery]);

    const handleRecipePress = (recipeId: string) => {
        router.push(`/meals/${recipeId}`);
    };

    // Показуємо індикатор завантаження, тільки якщо список ще порожній і йде завантаження
    if (loading && recipes.length === 0) {
        return (
            <View style={styles.containerCentered}>
                <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
        );
    }

    return (
        <View style={styles.mainContainer}>
            {/* <Image source={images.bg} style={styles.backgroundImage} /> */}

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
                                    placeholder="Пошук ваших рецептів..." // <--- ОНОВЛЕНО ПЛЕЙСХОЛДЕР
                                    placeholderTextColor="#A8B5DB"
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                />
                            </View>
                        </View>
                        {/* Заголовок секції показуємо тільки якщо є відфільтровані рецепти АБО немає пошукового запиту і є рецепти */}
                        {(filteredRecipes.length > 0 || (!searchQuery && recipes.length > 0)) && (
                            <Text style={styles.sectionTitle}>Мої рецепти</Text>
                        )}
                    </>
                }
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyContainer}>
                            <Image source={searchQuery ? icons.notFound : icons.empty_recipes_folder} // Різні іконки для "не знайдено" і "немає рецептів"
                                   style={styles.emptyIcon}
                                   resizeMode="contain"
                            />
                            <Text style={styles.emptyText}>
                                {searchQuery
                                    ? "За вашим запитом нічого не знайдено."
                                    : "У вас ще немає створених рецептів."}
                            </Text>
                            {!searchQuery && ( // Кнопку "Додати" показуємо тільки якщо це не результат пошуку
                                <TouchableOpacity onPress={() => router.push('/(tabs)/add')} style={styles.addButton}>
                                    <Text style={styles.addButtonText}>Створити перший рецепт</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ) : null
                }
                contentContainerStyle={styles.listContentContainer}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        backgroundColor: "#0f0D23",
    },
    // backgroundImage: { ... }, // Якщо потрібне фонове зображення
    containerCentered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0f0D23', // Додав фон для консистентності
    },
    headerContentContainer: { // Новий контейнер для лого та пошуку, щоб застосувати відступи
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 20 : 60,
    },
    logo: {
        width: 50,
        height: 40,
        // marginTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 + 20 : 60, // Перенесено до headerContentContainer
        marginBottom: 20,
        alignSelf: "center",
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
    sectionTitle: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#FFFFFF",
        marginLeft: 20, // Або 20, якщо відступ контейнера 12
        marginBottom: 10,
    },
    listContentContainer: {
        paddingHorizontal: 12,
        paddingBottom: 90, // Збільшив відступ знизу через TabBar
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
        marginTop: 30, // Відступ зверху, якщо список порожній
    },
    emptyIcon: {
        width: 80, // Зробив трохи менше
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