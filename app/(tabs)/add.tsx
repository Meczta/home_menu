// app/(tabs)/add.tsx
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
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';

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

export default function AddRecipeScreen() {
    const [name, setName] = useState('');
    const [cookingTime, setCookingTime] = useState('');
    const [ingredients, setIngredients] = useState('');
    const [description, setDescription] = useState('');
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [isPublic, setIsPublic] = useState(false);
    const [selectedTags, setSelectedTags] = useState<string[]>([]); // <--- НОВИЙ СТАН для вибраних тегів
    const [uploading, setUploading] = useState(false);

    const router = useRouter();

    useEffect(() => {
        (async () => {
            if (Platform.OS !== 'web') {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Дозвіл потрібен', 'Нам потрібен дозвіл на доступ до ваших фото, щоб ви могли завантажити зображення рецепту.');
                }
            }
        })();
    }, []);
    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.7,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            setImageUri(result.assets[0].uri);
        }
    };

    const handleToggleTag = (tag: string) => {
        setSelectedTags(prevTags =>
            prevTags.includes(tag)
                ? prevTags.filter(t => t !== tag) // Видалити тег, якщо він вже вибраний
                : [...prevTags, tag] // Додати тег, якщо його немає
        );
    };

    const handleAddRecipe = async () => {
        const currentUser = auth().currentUser;
        if (!currentUser) {
            Alert.alert('Помилка', 'Будь ласка, увійдіть, щоб додати рецепт.');
            return;
        }
        if (!name || !cookingTime || !ingredients || !description) {
            Alert.alert('Помилка', 'Будь ласка, заповніть всі обов\'язкові поля.');
            return;
        }

        setUploading(true);
        let uploadedImageUrl: string | null = null;
        try {
            if (imageUri) {
                const filename = imageUri.substring(imageUri.lastIndexOf('/') + 1);
                const uploadUri = Platform.OS === 'ios' ? imageUri.replace('file://', '') : imageUri;
                const storageRef = storage().ref(`recipe_images/${currentUser.uid}/${filename}_${Date.now()}`);
                await storageRef.putFile(uploadUri);
                uploadedImageUrl = await storageRef.getDownloadURL();
            }

            await firestore().collection('recipes').add({
                name,
                cookingTime,
                ingredients,
                description,
                imageUrl: uploadedImageUrl,
                userId: currentUser.uid,
                isPublic,
                tags: selectedTags, // <--- ДОДАЄМО ТЕГИ ДО ОБ'ЄКТУ РЕЦЕПТУ
                createdAt: firestore.FieldValue.serverTimestamp(),
            });

            Alert.alert('Успішно!', 'Рецепт успішно додано.');
            // Очищення форми
            setName('');
            setCookingTime('');
            setIngredients('');
            setDescription('');
            setImageUri(null);
            setIsPublic(false);
            setSelectedTags([]); // <--- Очищуємо вибрані теги
        } catch (error: any) {
            console.error("Error adding recipe: ", error);
            Alert.alert('Помилка додавання', error.message || 'Не вдалося додати рецепт.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.keyboardAvoidingContainer}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
        >
            <ScrollView
                style={styles.scrollContainerStyle}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={styles.title}>Створити новий рецепт</Text>

                <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
                    {imageUri ? (
                        <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                    ) : (
                        <Text style={styles.imagePickerText}>Натисніть, щоб вибрати фото</Text>
                    )}
                </TouchableOpacity>

                <TextInput style={styles.input} placeholder="Назва рецепту" value={name} onChangeText={setName} placeholderTextColor={PLACEHOLDER_TEXT_COLOR}/>
                <TextInput style={styles.input} placeholder="Час приготування (наприклад, 30 хв)" value={cookingTime} onChangeText={setCookingTime} placeholderTextColor={PLACEHOLDER_TEXT_COLOR}/>
                <TextInput style={[styles.input, styles.multilineInput]} placeholder="Інгредієнти..." value={ingredients} onChangeText={setIngredients} multiline numberOfLines={4} placeholderTextColor={PLACEHOLDER_TEXT_COLOR}/>
                <TextInput style={[styles.input, styles.multilineInput]} placeholder="Опис приготування" value={description} onChangeText={setDescription} multiline numberOfLines={6} placeholderTextColor={PLACEHOLDER_TEXT_COLOR}/>

                {/* Секція для вибору тегів */}
                <Text style={styles.sectionTitle}>Теги (оберіть декілька):</Text>
                <View style={styles.tagsContainer}>
                    {AVAILABLE_TAGS.map(tag => (
                        <TouchableOpacity
                            key={tag}
                            style={[
                                styles.tagButton,
                                selectedTags.includes(tag) && styles.tagButtonSelected
                            ]}
                            onPress={() => handleToggleTag(tag)}
                        >
                            <Text
                                style={[
                                    styles.tagText,
                                    selectedTags.includes(tag) && styles.tagTextSelected
                                ]}
                            >
                                {tag}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.switchContainer}>
                    <Text style={styles.switchLabel}>Зробити рецепт публічним?</Text>
                    <Switch
                        trackColor={{ false: "#767577", true: ACCENT_COLOR_SWITCH }}
                        thumbColor={isPublic ? ACCENT_COLOR_BUTTON : "#f4f3f4"}
                        ios_backgroundColor="#3e3e3e"
                        onValueChange={setIsPublic}
                        value={isPublic}
                    />
                </View>

                {uploading ? (
                    <ActivityIndicator size="large" color={TEXT_COLOR_ON_DARK} style={styles.loader} />
                ) : (
                    <TouchableOpacity style={styles.addButton} onPress={handleAddRecipe}>
                        <Text style={styles.addButtonText}>Додати рецепт</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    keyboardAvoidingContainer: {
        flex: 1,
        backgroundColor: PRIMARY_BACKGROUND_COLOR,
    },
    scrollContainerStyle: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 25,
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 20 : 60,
        paddingBottom: 100,
    },
    title: {
        fontSize: 26,
        fontWeight: 'bold',
        color: TEXT_COLOR_ON_DARK,
        textAlign: 'center',
        marginBottom: 25,
    },
    sectionTitle: { // Стиль для заголовка секції тегів
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
    tagsContainer: { // Контейнер для всіх тегів
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 20,
    },
    tagButton: { // Стиль для кнопки тегу
        backgroundColor: TAG_BACKGROUND_COLOR,
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 20, // Робимо їх схожими на "чіпси"
        marginRight: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: ACCENT_COLOR_SWITCH,
    },
    tagButtonSelected: { // Стиль для вибраного тегу
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
    loader: {
        marginVertical: 20,
    },
    addButton: {
        backgroundColor: ACCENT_COLOR_BUTTON,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10,
    },
    addButtonText: {
        color: TEXT_COLOR_ON_DARK,
        fontSize: 18,
        fontWeight: '600',
    },
});