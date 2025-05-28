// app/meals/[id].tsx
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Image,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    Alert,
    Switch,
    Platform,
    StatusBar, // Імпортуємо для StatusBar.currentHeight
} from 'react-native';
// SafeAreaView може бути корисним, якщо проблеми зі статус-баром залишаються
// import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { icons } from '@/constants/icons'; // Переконайся, що тут є dots, bookmark_saved, bookmark_unsaved
import { images } from '@/constants/images';
import storage from "@react-native-firebase/storage";

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
    const { id: recipeId } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [recipe, setRecipe] = useState<Recipe | null>(null);
    const [loading, setLoading] = useState(true);
    const [isOwner, setIsOwner] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    const [isCurrentlySaved, setIsCurrentlySaved] = useState(false);
    const [isSavingBookmark, setIsSavingBookmark] = useState(false);

    const currentUser = auth().currentUser;

    useEffect(() => {
        if (!recipeId) {
            Alert.alert("Помилка", "ID рецепту не вказано.");
            router.back();
            return;
        }
        setLoading(true);
        const subscriber = firestore()
            .collection('recipes')
            .doc(recipeId)
            .onSnapshot(
                (documentSnapshot) => {
                    // @ts-ignore
                    if (documentSnapshot.exists) {
                        const dataFromSnapshot = documentSnapshot.data();
                        if (dataFromSnapshot) {
                            const recipeData = {
                                id: documentSnapshot.id,
                                ...dataFromSnapshot,
                            } as Recipe;
                            setRecipe(recipeData);
                            setIsOwner(currentUser?.uid === recipeData.userId);
                        } else {
                            setRecipe(null);
                            Alert.alert("Помилка", "Не вдалося завантажити дані рецепту (порожні дані).");
                            router.back();
                        }
                    } else {
                        setRecipe(null);
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
        return () => subscriber();
    }, [recipeId, currentUser]);

    useEffect(() => {
        if (currentUser && recipeId) {
            const bookmarkDocId = `${currentUser.uid}_${recipeId}`;
            const subscriber = firestore()
                .collection('user_bookmarks')
                .doc(bookmarkDocId)
                .onSnapshot(docSnapshot => {
                    setIsCurrentlySaved(docSnapshot.exists);
                });
            return () => subscriber();
        } else {
            setIsCurrentlySaved(false);
        }
    }, [currentUser, recipeId]);

    const handleDeleteRecipe = async () => { /* ...твій код видалення, як був ... */
        if (!recipe || !isOwner || !currentUser) return;
        setShowMenu(false);
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
                            const bookmarksQuerySnapshot = await firestore()
                                .collection('user_bookmarks')
                                .where('recipeId', '==', recipe.id)
                                .get();
                            const batch = firestore().batch();
                            bookmarksQuerySnapshot.forEach(doc => {
                                batch.delete(doc.ref);
                            });
                            await batch.commit();

                            if (recipe.imageUrl) {
                                try {
                                    const storageRef = storage().refFromURL(recipe.imageUrl);
                                    await storageRef.delete();
                                } catch (storageError: any) {
                                    if (storageError.code !== 'storage/object-not-found') {
                                        console.error("Error deleting image from storage: ", storageError);
                                    }
                                }
                            }
                            await firestore().collection('recipes').doc(recipe.id).delete();
                            Alert.alert('Успіх', 'Рецепт видалено.');
                            router.back();
                        } catch (error: any) {
                            console.error('Error deleting recipe: ', error);
                            Alert.alert('Помилка', 'Не вдалося видалити рецепт.');
                        }
                    },
                },
            ]
        );
    };
    const toggleIsPublic = async () => { /* ...твій код зміни публічності, як був ... */
        if (!recipe || !isOwner || !currentUser) return;
        const newIsPublicStatus = !recipe.isPublic;
        try {
            await firestore().collection('recipes').doc(recipe.id).update({
                isPublic: newIsPublicStatus,
            });
            Alert.alert('Статус оновлено', `Рецепт тепер ${newIsPublicStatus ? 'публічний' : 'приватний'}.`);
        } catch (error: any) {
            console.error('Error updating isPublic status: ', error);
            Alert.alert('Помилка', 'Не вдалося оновити статус публічності.');
        }
    };
    const handleToggleBookmark = async () => { /* ...твій код збереження/видалення закладки, як був ... */
        if (!currentUser || !recipeId || isSavingBookmark) return;
        setIsSavingBookmark(true);
        const bookmarkDocId = `${currentUser.uid}_${recipeId}`;
        const bookmarkRef = firestore().collection('user_bookmarks').doc(bookmarkDocId);
        try {
            if (isCurrentlySaved) {
                await bookmarkRef.delete();
            } else {
                await bookmarkRef.set({
                    userId: currentUser.uid,
                    recipeId: recipeId,
                    savedAt: firestore.FieldValue.serverTimestamp(),
                });
            }
        } catch (error: any) {
            console.error("Error toggling bookmark: ", error);
            Alert.alert('Помилка', 'Не вдалося змінити статус збереження.');
        } finally {
            setIsSavingBookmark(false);
        }
    };

    if (loading || !recipe) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
        );
    }

    const stackScreenOptions = {
        headerShown: true,
        headerTitle: recipe.name,
        headerStyle: { backgroundColor: '#0f0D23' },
        headerTintColor: '#FFFFFF',
        headerBackTitleVisible: false,
        headerTransparent: false,
        // Збільшуємо відступи для кнопок в заголовку, щоб вони точно не налізали
        headerRightContainerStyle: { paddingRight: 15 },
        headerLeftContainerStyle: { paddingLeft: 10 },
        headerRight: () => (
            isOwner ? (
                <TouchableOpacity onPress={() => setShowMenu(!showMenu)} style={styles.headerButton}>
                    <Image source={icons.dots} style={styles.headerIcon} />
                </TouchableOpacity>
            ) : null
        )
    };

    return (
        <View style={styles.mainContainer}>
            <Stack.Screen options={stackScreenOptions}/>

            {showMenu && isOwner && (
                <View style={styles.optionsMenu}>
                    <TouchableOpacity onPress={handleDeleteRecipe} style={styles.menuItem}>
                        <Text style={styles.menuItemText}>Видалити рецепт</Text>
                    </TouchableOpacity>
                </View>
            )}

            <ScrollView
                contentContainerStyle={styles.scrollContentContainer}
                showsVerticalScrollIndicator={false}
            >
                <Image // Тепер це просто Image, а не ImageBackground
                    source={recipe.imageUrl ? { uri: recipe.imageUrl } : images.placeholder}
                    style={styles.recipeImage}
                    resizeMode="cover"
                />

                <View style={styles.contentContainer}>
                    {/* Контейнер для назви та кнопки збереження */}
                    <View style={styles.titleBookmarkRow}>
                        <Text style={styles.recipeTitle}>{recipe.name}</Text>
                        {currentUser && (
                            <TouchableOpacity
                                style={styles.bookmarkButtonInline}
                                onPress={handleToggleBookmark}
                                disabled={isSavingBookmark}
                            >
                                {isSavingBookmark ? (
                                    <ActivityIndicator size="small" color="#C37AFF" />
                                ) : (
                                    <Image
                                        source={isCurrentlySaved ? icons.bookmark_saved : icons.save}
                                        style={styles.bookmarkIconInline}
                                    />
                                )}
                            </TouchableOpacity>
                        )}
                    </View>

                    <Text style={styles.sectionHeader}>Інгредієнти</Text>
                    <View style={styles.ingredientsBox}>
                        {recipe.ingredients.split(/,|\n/).map((ingredient, index) => (
                            ingredient.trim() ? <Text key={index} style={styles.ingredientText}>• {ingredient.trim()}</Text> : null
                        ))}
                    </View>

                    <Text style={styles.sectionHeader}>Час приготування</Text>
                    <Text style={styles.infoText}>{recipe.cookingTime}</Text>

                    <Text style={styles.sectionHeader}>Опис приготування</Text>
                    <Text style={styles.descriptionText}>{recipe.description}</Text>

                    {isOwner && (
                        <View style={styles.isPublicContainer}>
                            <Text style={styles.isPublicLabel}>Публічний рецепт:</Text>
                            <Switch
                                trackColor={{ false: "#767577", true: "#81b0ff" }}
                                thumbColor={recipe.isPublic ? "#C37AFF" : "#f4f3f4"}
                                ios_backgroundColor="#3e3e3e"
                                onValueChange={toggleIsPublic}
                                value={recipe.isPublic}
                            />
                        </View>
                    )}

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
        backgroundColor: '#0f0D23',
        // Важливо: Якщо заголовок не прозорий, SafeAreaView для основного контейнера може не знадобитися,
        // оскільки сам заголовок вже враховує статус-бар.
        // Якщо ж проблеми залишаються, можна обгорнути View в SafeAreaView.
        // paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, // Альтернатива для Android
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0f0D23',
    },
    headerButton: {
        paddingHorizontal: 8, // Змінив на горизонтальний для кращої області кліку
    },
    headerIcon: {
        width: 24,
        height: 24,
        tintColor: '#FFFFFF',
    },
    optionsMenu: {
        position: 'absolute',
        top: (Platform.OS === 'ios' ? 40 : (StatusBar.currentHeight || 0) + 10) + 45, // Приблизна висота заголовка + відступ
        right: 15,
        backgroundColor: '#1E1C32',
        borderRadius: 8,
        paddingVertical: 5,
        zIndex: 1000,
        elevation: 8,
    },
    menuItem: {
        paddingVertical: 10,
        paddingHorizontal: 15,
    },
    menuItemText: {
        color: '#FFFFFF',
        fontSize: 16,
    },
    scrollContentContainer: {
        paddingBottom: 30,
    },
    recipeImage: { // Змінено з recipeImageContainer, тепер це просто Image
        width: '100%',
        height: 300, // Можеш налаштувати висоту
    },
    contentContainer: {
        paddingHorizontal: 20,
        paddingTop: 20, // Відступ зверху для контенту під зображенням
        backgroundColor: '#0f0D23',
    },
    titleBookmarkRow: { // Новий стиль для рядка з назвою та кнопкою збереження
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20, // Відступ під цим рядком
    },
    recipeTitle: {
        fontSize: 26, // Трохи зменшив, щоб помістилася кнопка
        fontWeight: 'bold',
        color: '#FFFFFF',
        flex: 1, // Дозволяє тексту зайняти доступний простір, відсуваючи кнопку вправо
        marginRight: 10, // Відступ від кнопки збереження
        textAlign: 'left', // Вирівнювання зліва
    },
    bookmarkButtonInline: { // Стиль для кнопки збереження поруч з назвою
        padding: 8,
    },
    bookmarkIconInline: { // Стиль для іконки збереження поруч з назвою
        width: 28, // Розмір іконки
        height: 28,
        // tintColor можна задати тут, якщо іконки одноколірні:
        // tintColor: isCurrentlySaved ? '#C37AFF' : '#FFFFFF',
    },
    sectionHeader: {
        fontSize: 20,
        fontWeight: '600',
        color: '#FFFFFF',
        marginTop: 20, // Зменшив верхній відступ
        marginBottom: 10,
    },
    ingredientsBox: {
        backgroundColor: '#1E1C32',
        borderRadius: 12,
        paddingVertical: 15,
        paddingHorizontal: 20,
        marginBottom: 15,
    },
    ingredientText: {
        fontSize: 16,
        color: '#E0E0E0',
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
        textAlign: 'justify',
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
        backgroundColor: '#C37AFF',
        paddingVertical: 15,
        borderRadius: 25,
        alignItems: 'center',
        marginTop: 40,
        marginBottom: 20,
    },
    backButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});