// app/(tabs)/index.tsx
import React, { useState, useEffect, useMemo } from "react";
import {
    Image,
    ScrollView,
    Text,
    View,
    FlatList, // Краще для списків, ніж ScrollView з map
    ActivityIndicator,
    StyleSheet,
    TouchableOpacity, TextInput, // Для клікабельних карток
} from "react-native";
import { images } from "@/constants/images"; // Переконайся, що шляхи правильні
import { icons } from "@/constants/icons";   // Переконайся, що шляхи правильні
import SearchBar from "@/components/SearchBar"; // Твій компонент пошуку
import { useRouter } from "expo-router";
import auth from "@react-native-firebase/auth";
import firestore, { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";

// Тип для рецепту (можна винести в окремий файл types.ts)
interface Recipe {
    id: string;
    name: string;
    cookingTime: string;
    ingredients: string; // Залишаємо як рядок, як ти просила
    description: string;
    imageUrl?: string;
    userId: string;
    isPublic: boolean;
    createdAt?: FirebaseFirestoreTypes.Timestamp;
}

// Компонент картки рецепту (можна взяти той, що ми створювали, або адаптувати)
// Якщо RecipeCard.js вже існує і підходить, імпортуй його.
// Для прикладу, я створю спрощену версію тут, але краще винести в окремий файл.
const RecipeCardItem = ({ item, onPress }: { item: Recipe; onPress: () => void }) => (
    <TouchableOpacity onPress={onPress} style={styles.recipeCard}>
        <Image
            source={item.imageUrl ? { uri: item.imageUrl } : images.placeholder} // Додай images.placeholder у свої константи
            style={styles.recipeImage}
            resizeMode="cover"
        />
        <View style={styles.recipeInfo}>
            <Text style={styles.recipeName}>{item.name}</Text>
            <View style={styles.recipeTimeContainer}>
                <Image source={icons.clock} style={styles.recipeTimeIcon} /> {/* Додай icons.clock */}
                <Text style={styles.recipeTime}>{item.cookingTime}</Text>
            </View>
        </View>
    </TouchableOpacity>
);

export default function Index() {
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
                .where("userId", "==", currentUser.uid) // Отримуємо рецепти тільки цього користувача
                .orderBy("createdAt", "desc") // Сортуємо за датою створення (новіші зверху)
                .onSnapshot(
                    (querySnapshot) => {
                        const userRecipes: Recipe[] = [];
                        if (querySnapshot) {
                            querySnapshot.forEach((documentSnapshot) => {
                                userRecipes.push({
                                    id: documentSnapshot.id,
                                    ...(documentSnapshot.data() as Omit<Recipe, 'id'>), // Приведення типу
                                });
                            });
                        }
                        setRecipes(userRecipes);
                        setLoading(false);
                    },
                    (error) => {
                        console.error("Error fetching user recipes: ", error);
                        setLoading(false);
                        // Тут можна показати Alert або повідомлення про помилку
                    }
                );

            // Відписатися від слухача при розмонтуванні компонента
            return () => subscriber();
        } else {
            // Якщо користувач не залогінений (хоча логіка в _layout.tsx має це обробляти)
            setRecipes([]);
            setLoading(false);
        }
    }, [currentUser]); // Перезавантажувати, якщо змінився користувач

    // Фільтрація рецептів на основі пошукового запиту
    const filteredRecipes = useMemo(() => {
        if (!searchQuery) {
            return recipes;
        }
        return recipes.filter((recipe) =>
            recipe.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [recipes, searchQuery]);

    const handleRecipePress = (recipeId: string) => {
        router.push(`/meals/${recipeId}`); // Перехід на екран деталей рецепту
    };

    if (loading && recipes.length === 0) { // Показуємо індикатор, тільки якщо ще не завантажено жодного рецепту
        return (
            <View style={[styles.containerCentered, {backgroundColor: '#0f0D23'}]}>
                <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
        );
    }

    return (
        <View style={styles.mainContainer}>
            {/* Фонове зображення, якщо потрібно, як у тебе було */}
            {/* <Image source={images.bg} style={styles.backgroundImage} /> */}

            <FlatList
                data={filteredRecipes}
                keyExtractor={(item) => item.id}
                numColumns={2} // Для відображення у дві колонки, як на макеті (перший ряд)
                // Якщо хочеш різний вигляд (горизонтальний скрол для "Featured", потім сітка),
                // то потрібен буде більш складний макет з кількома FlatList або SectionList.
                // Для початку зробимо просту сітку.
                renderItem={({ item }) => (
                    <RecipeCardItem item={item} onPress={() => handleRecipePress(item.id)} />
                )}
                ListHeaderComponent={ // Компоненти, які будуть над списком
                    <>
                        <Image
                            source={icons.logo} // Твій логотип
                            style={styles.logo}
                            resizeMode="contain"
                        />
                        {/* Використовуй свій компонент SearchBar, якщо він готовий, або цей приклад */}
                        <View style={styles.searchBarContainer}>
                            <Image source={icons.search} style={styles.searchIcon} />{/* Іконка пошуку */}
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search through your meals..."
                                placeholderTextColor="#A8B5DB"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>

                        {filteredRecipes.length > 0 && (
                            <Text style={styles.sectionTitle}>My Recipes</Text>
                        )}
                    </>
                }
                ListEmptyComponent={ // Якщо список порожній
                    !loading ? ( // Показуємо тільки якщо не йде завантаження
                        <View style={styles.emptyContainer}>
                            <Image source={icons.logo} style={styles.emptyIcon} /> {/* Додай icons.notFound */}
                            <Text style={styles.emptyText}>
                                You haven't added any recipes yet.
                            </Text>
                            <TouchableOpacity onPress={() => router.push('/(tabs)/add')} style={styles.addButton}>
                                <Text style={styles.addButtonText}>Add Your First Recipe</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null // Або індикатор завантаження, якщо loading все ще true
                }
                contentContainerStyle={styles.listContentContainer}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
}

// Стилі, наближені до макету (темна тема)
const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        backgroundColor: "#0f0D23", // Основний темний фон, як на макеті
    },
    backgroundImage: { // Якщо будеш використовувати фонове зображення
        position: "absolute",
        width: "100%",
        height: "100%",
        zIndex: 0,
    },
    logo: {
        width: 50, // Налаштуй розміри
        height: 40,
        marginTop: 60, // Відступ зверху (враховуй статус-бар)
        marginBottom: 20,
        alignSelf: "center",
    },
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E1C32', // Темний фон для поля пошуку
        borderRadius: 12,
        paddingHorizontal: 15,
        marginHorizontal: 20,
        marginBottom: 25,
        height: 50,
    },
    searchIcon: {
        width: 20,
        height: 20,
        tintColor: '#A8B5DB', // Колір іконки
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: "#FFFFFF", // Колір тексту в полі пошуку
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#FFFFFF",
        marginLeft: 20,
        marginBottom: 10,
    },
    listContentContainer: {
        paddingHorizontal: 12, // Відступи для сітки карток
        paddingBottom: 80, // Щоб останній ряд не перекривався таб-баром
    },
    recipeCard: {
        flex: 1, // Для рівномірного розподілу в numColumns
        margin: 8,
        backgroundColor: "#1E1C32", // Фон картки
        borderRadius: 15,
        overflow: "hidden", // Щоб зображення не виходило за межі
    },
    recipeImage: {
        width: "100%",
        height: 130, // Висота зображення в картці
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
        color: "#A8B5DB", // Колір тексту часу
    },
    containerCentered: { // Для індикатора завантаження
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 50, // Відступ, щоб було по центру
    },
    emptyIcon: {
        width: 100,
        height: 100,
        tintColor: '#A8B5DB', // Або інший колір
        marginBottom: 20,
    },
    emptyText: {
        fontSize: 16,
        color: '#A8B5DB',
        textAlign: 'center',
        marginBottom: 20,
    },
    addButton: {
        backgroundColor: '#C37AFF', // Колір кнопки, як у тебе на Add табі
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