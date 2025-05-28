// app/(tabs)/global.tsx
import React, { useState, useEffect, useMemo } from "react";
import {
    Image,
    Text,
    View,
    FlatList,
    ActivityIndicator,
    StyleSheet,
    TouchableOpacity,
    TextInput, Platform, Alert, // Додамо TextInput для пошуку
} from "react-native";
import { images } from "@/constants/images"; // Переконайся, що шляхи правильні
import { icons } from "@/constants/icons";   // Переконайся, що шляхи правильні
// Якщо ти використовуєш свій компонент SearchBar, імпортуй його
// import SearchBar from "@/components/SearchBar";
import { useRouter } from "expo-router";
import auth from "@react-native-firebase/auth";
import firestore, { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";

// Тип для рецепту (такий самий, як в index.tsx)
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

// Компонент картки рецепту (такий самий, як в index.tsx)
// Якщо він у тебе винесений в окремий файл (наприклад, components/RecipeCardItem.tsx),
// то імпортуй його звідти, щоб не дублювати код.
// Я залишу його тут для повноти прикладу.
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

export default function SearchScreen() { // Перейменовано з Search на SearchScreen для ясності
    const router = useRouter();
    const [allPublicRecipes, setAllPublicRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const currentUser = auth().currentUser;

    useEffect(() => {
        setLoading(true);
        let query = firestore()
            .collection("recipes")
            .where("isPublic", "==", true) // Тільки публічні рецепти
            .orderBy("createdAt", "desc"); // Сортуємо (може потребувати індексу)

        // Якщо користувач залогінений, виключаємо його власні рецепти
        if (currentUser) {
            query = query.where("userId", "!=", currentUser.uid);
        }

        const subscriber = query.onSnapshot(
            (querySnapshot) => {
                const publicRecipes: Recipe[] = [];
                if (querySnapshot) {
                    querySnapshot.forEach((documentSnapshot) => {
                        // Додатково перевіряємо, чи це не рецепт поточного користувача (для випадків, коли where "!=" не спрацював ідеально або для незалогіненого)
                        // Хоча where("userId", "!=", currentUser.uid) має це робити на рівні запиту, якщо currentUser існує.
                        // Якщо currentUser null, то where("userId", "!=", null) не спрацює як очікується.
                        // Тому, якщо currentUser є, подвійна перевірка не завадить, або покладатися на запит.
                        // Я залишу як є, покладаючись на запит Firestore.
                        publicRecipes.push({
                            id: documentSnapshot.id,
                            ...(documentSnapshot.data() as Omit<Recipe, 'id'>),
                        });
                    });
                }
                setAllPublicRecipes(publicRecipes);
                setLoading(false);
            },
            (error) => {
                console.error("Error fetching public recipes: ", error);
                setLoading(false);
                // Alert.alert("Помилка", "Не вдалося завантажити рецепти.");
            }
        );

        return () => subscriber();
    }, [currentUser]); // Перезавантажуємо, якщо змінився користувач (наприклад, залогінився/розлогінився)

    const filteredRecipes = useMemo(() => {
        if (!searchQuery) {
            return allPublicRecipes;
        }
        const lowerCaseQuery = searchQuery.toLowerCase();
        return allPublicRecipes.filter((recipe) => {
            const nameMatch = recipe.name.toLowerCase().includes(lowerCaseQuery);
            // Пошук по інгредієнтах (як підрядок)
            const ingredientsMatch = recipe.ingredients.toLowerCase().includes(lowerCaseQuery);
            return nameMatch || ingredientsMatch;
        });
    }, [allPublicRecipes, searchQuery]);

    const handleRecipePress = (recipeId: string) => {
        router.push(`/meals/${recipeId}`);
    };

    if (loading && allPublicRecipes.length === 0) {
        return (
            <View style={[styles.containerCentered, {backgroundColor: '#0f0D23'}]}>
                <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
        );
    }

    return (
        <View style={styles.mainContainer}>
            {/* Фонове зображення, якщо воно у тебе є і використовується тут */}
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
                        {/* Замість логотипу тут може бути заголовок "Пошук рецептів" або щось подібне */}
                        <Text style={styles.pageTitle}>Знайти рецепти</Text>

                        {/* Поле пошуку */}
                        <View style={styles.searchBarContainer}>
                            <Image source={icons.search} style={styles.searchIcon} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Пошук за назвою або інгредієнтами..."
                                placeholderTextColor="#A8B5DB"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>

                        {/* Можна додати заголовок секції, якщо потрібно */}
                        {/* {filteredRecipes.length > 0 && (
              <Text style={styles.sectionTitle}>Знайдені рецепти</Text>
            )} */}
                    </>
                }
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyContainer}>
                            <Image source={images.placeholder || icons.logo} style={styles.emptyIcon} /> {/* Використай іконку "не знайдено" */}
                            <Text style={styles.emptyText}>
                                {searchQuery
                                    ? "За вашим запитом нічого не знайдено."
                                    : "Поки що немає публічних рецептів для відображення."}
                            </Text>
                        </View>
                    ) : null
                }
                contentContainerStyle={styles.listContentContainer}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
}

// Використовуємо ті самі стилі, що й для index.tsx (або дуже схожі)
// Переконайся, що цей StyleSheet імпортовано з 'react-native'
const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        backgroundColor: "#0f0D23",
    },
    pageTitle: { // Новий стиль для заголовка сторінки
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center',
        marginTop: Platform.OS === 'ios' ? 70 : 50, // Більший відступ зверху
        marginBottom: 20,
    },
    backgroundImage: {
        position: "absolute",
        width: "100%",
        height: "100%",
        zIndex: 0,
    },
    // Логотип тут не потрібен, замість нього pageTitle
    // logo: { ... },
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
        marginLeft: 20,
        marginBottom: 10,
    },
    listContentContainer: {
        paddingHorizontal: 12,
        paddingBottom: 80,
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
    containerCentered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 50,
        paddingHorizontal: 20, // Додав, щоб текст не прилипав до країв
    },
    emptyIcon: {
        width: 80, // Трохи менша іконка
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
    // addButton та addButtonText тут не потрібні
});