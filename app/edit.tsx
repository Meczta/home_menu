// app/edit.tsx
import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    Alert,
    Image,
    ScrollView,
    TouchableOpacity,
    Platform,
    ActivityIndicator,
    Switch,
    StatusBar,
    KeyboardAvoidingView,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';

// Константи для стилів
const PRIMARY_BACKGROUND_COLOR = '#1A2035';
const INPUT_BACKGROUND_COLOR = '#2A3045';
const TEXT_COLOR_ON_DARK = '#FFFFFF';
const PLACEHOLDER_TEXT_COLOR = '#A0A0B0';
const ACCENT_COLOR_BUTTON = '#7E57C2';
const ACCENT_COLOR_SWITCH = '#9575CD';
const TAG_BACKGROUND_COLOR = '#3A3F5E';
const TAG_BACKGROUND_COLOR_SELECTED = ACCENT_COLOR_SWITCH;
const TAG_TEXT_COLOR = '#E0E0E0';
const TAG_TEXT_COLOR_SELECTED = '#FFFFFF';

const AVAILABLE_TAGS = [
    "десерт", "суп", "випічка", "закуска",
    "солоне", "солодке", "кисле",
    "сніданок", "обід", "вечеря",
    "варене", "здорове харчування", "напої"
];

export default function EditRecipeScreen() {
    const { recipeId } = useLocalSearchParams<{ recipeId: string }>();
    const router = useRouter();

    const [name, setName] = useState('');
    const [cookingTime, setCookingTime] = useState('');
    const [ingredients, setIngredients] = useState('');
    const [description, setDescription] = useState('');
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
    const [isPublic, setIsPublic] = useState(false);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [isInitialLoading, setInitialLoading] = useState(true);

    useEffect(() => {
        const loadRecipeData = async () => {
            if (!recipeId) {
                Alert.alert("Помилка", "Не вдалося отримати ID рецепту.");
                router.back();
                return;
            }
            try {
                const doc = await firestore().collection('recipes').doc(recipeId).get();
                // @ts-ignore
                if (doc.exists) {
                    const data = doc.data() as FirebaseFirestoreTypes.DocumentData;
                    setName(data.name || '');
                    setCookingTime(data.cookingTime || '');
                    setIngredients(data.ingredients || '');
                    setDescription(data.description || '');
                    setImageUri(data.imageUrl || null);
                    setOriginalImageUrl(data.imageUrl || null);
                    setIsPublic(data.isPublic || false);
                    setSelectedTags(data.tags || []);
                } else {
                    Alert.alert("Помилка", "Рецепт для редагування не знайдено.");
                    router.back();
                }
            } catch (error) {
                console.error("Помилка завантаження рецепту:", error);
                Alert.alert("Помилка", "Не вдалося завантажити дані рецепту.");
                router.back();
            } finally {
                setInitialLoading(false);
            }
        };

        loadRecipeData();
    }, [recipeId]);

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.7,
        });
        if (!result.canceled && result.assets.length > 0) {
            setImageUri(result.assets[0].uri);
        }
    };

    const handleToggleTag = (tag: string) => {
        setSelectedTags(prevTags =>
            prevTags.includes(tag)
                ? prevTags.filter(t => t !== tag)
                : [...prevTags, tag]
        );
    };

    const handleUpdateRecipe = async () => {
        const currentUser = auth().currentUser;
        if (!currentUser || !recipeId) return;
        if (!name || !cookingTime || !ingredients || !description) {
            Alert.alert('Помилка', 'Будь ласка, заповніть всі обов\'язкові поля.');
            return;
        }

        setLoading(true);
        try {
            let uploadedImageUrl = originalImageUrl;
            if (imageUri && imageUri !== originalImageUrl) {
                const filename = imageUri.substring(imageUri.lastIndexOf('/') + 1);
                const uploadUri = Platform.OS === 'ios' ? imageUri.replace('file://', '') : imageUri;
                const storageRef = storage().ref(`recipe_images/${currentUser.uid}/${filename}_${Date.now()}`);
                await storageRef.putFile(uploadUri);
                uploadedImageUrl = await storageRef.getDownloadURL();
                if (originalImageUrl) {
                    try {
                        const oldImageRef = storage().refFromURL(originalImageUrl);
                        await oldImageRef.delete();
                    } catch (e) { console.log("Помилка видалення старого фото:", e); }
                }
            }

            const recipeData = { name, cookingTime, ingredients, description, imageUrl: uploadedImageUrl, userId: currentUser.uid, isPublic, tags: selectedTags };

            await firestore().collection('recipes').doc(recipeId).update({ ...recipeData, updatedAt: firestore.FieldValue.serverTimestamp() });
            Alert.alert('Успішно!', 'Рецепт оновлено.');
            router.back();

        } catch (error: any) {
            console.error("Помилка оновлення рецепту: ", error);
            Alert.alert('Помилка', error.message);
        } finally {
            setLoading(false);
        }
    };

    if (isInitialLoading) {
        return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: PRIMARY_BACKGROUND_COLOR }}><ActivityIndicator size="large" color="#FFFFFF" /></View>;
    }

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <Stack.Screen options={{ headerShown: true, title: 'Редагувати рецепт', headerStyle: { backgroundColor: PRIMARY_BACKGROUND_COLOR }, headerTintColor: '#FFFFFF'}} />
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
                    {imageUri ? <Image source={{ uri: imageUri }} style={styles.imagePreview} /> : <Text style={styles.imagePickerText}>Натисніть, щоб змінити фото</Text>}
                </TouchableOpacity>
                <TextInput style={styles.input} placeholder="Назва рецепту" value={name} onChangeText={setName} placeholderTextColor={PLACEHOLDER_TEXT_COLOR} />
                <TextInput style={styles.input} placeholder="Час приготування" value={cookingTime} onChangeText={setCookingTime} placeholderTextColor={PLACEHOLDER_TEXT_COLOR} />
                <TextInput style={[styles.input, styles.multilineInput]} placeholder="Інгредієнти..." value={ingredients} onChangeText={setIngredients} multiline numberOfLines={4} placeholderTextColor={PLACEHOLDER_TEXT_COLOR} />
                <TextInput style={[styles.input, styles.multilineInput]} placeholder="Опис приготування" value={description} onChangeText={setDescription} multiline numberOfLines={6} placeholderTextColor={PLACEHOLDER_TEXT_COLOR} />
                <Text style={styles.sectionTitle}>Теги:</Text>
                <View style={styles.tagsContainer}>
                    {AVAILABLE_TAGS.map(tag => (
                        <TouchableOpacity key={tag} style={[styles.tagButton, selectedTags.includes(tag) && styles.tagButtonSelected]} onPress={() => handleToggleTag(tag)}>
                            <Text style={[styles.tagText, selectedTags.includes(tag) && styles.tagTextSelected]}>{tag}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <View style={styles.switchContainer}>
                    <Text style={styles.switchLabel}>Зробити рецепт публічним?</Text>
                    <Switch trackColor={{ false: "#767577", true: ACCENT_COLOR_SWITCH }} thumbColor={isPublic ? ACCENT_COLOR_BUTTON : "#f4f3f4"} onValueChange={setIsPublic} value={isPublic} />
                </View>
                <TouchableOpacity style={styles.updateButton} onPress={handleUpdateRecipe} disabled={loading}>
                    {loading ? <ActivityIndicator color={TEXT_COLOR_ON_DARK} /> : <Text style={styles.updateButtonText}>Оновити рецепт</Text>}
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: PRIMARY_BACKGROUND_COLOR
    },
    scrollContent: {
        paddingHorizontal: 25,
        paddingTop: 20,
        paddingBottom: 50
    },
    updateButton: {
        backgroundColor: ACCENT_COLOR_BUTTON,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 20
    },
    updateButtonText: {
        color: TEXT_COLOR_ON_DARK,
        fontSize: 18,
        fontWeight: '600'
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: TEXT_COLOR_ON_DARK,
        marginTop: 15,
        marginBottom: 10,
    },
    input: {
        backgroundColor: INPUT_BACKGROUND_COLOR,
        color: TEXT_COLOR_ON_DARK,
        borderRadius: 12,
        paddingHorizontal: 20,
        paddingVertical: 15,
        marginBottom: 18,
        fontSize: 16,
        borderWidth: 1,
        borderColor: ACCENT_COLOR_SWITCH,
    },
    multilineInput: {
        minHeight: 100,
        textAlignVertical: 'top',
    },
    imagePicker: {
        height: 180,
        width: '100%',
        backgroundColor: INPUT_BACKGROUND_COLOR,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 25,
        borderWidth: 1,
        borderColor: ACCENT_COLOR_SWITCH,
    },
    imagePickerText: {
        color: PLACEHOLDER_TEXT_COLOR,
        fontSize: 16,
    },
    imagePreview: {
        width: '100%',
        height: '100%',
        borderRadius: 11,
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 20,
    },
    tagButton: {
        backgroundColor: TAG_BACKGROUND_COLOR,
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 20,
        marginRight: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: ACCENT_COLOR_SWITCH,
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
    switchContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 25,
        marginTop: 5,
        paddingVertical: 10,
        paddingHorizontal: 15,
        backgroundColor: INPUT_BACKGROUND_COLOR,
        borderRadius: 12,
    },
    switchLabel: {
        color: TEXT_COLOR_ON_DARK,
        fontSize: 16,
        flexShrink: 1,
        marginRight: 10,
    },
});
