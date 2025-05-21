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
    KeyboardAvoidingView, // Додано KeyboardAvoidingView
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';

// Колірна схема
const PRIMARY_BACKGROUND_COLOR = '#1A2035'; // Темно-синьо-фіолетовий
const INPUT_BACKGROUND_COLOR = '#2A3045';   // Трохи світліший для полів
const TEXT_COLOR_ON_DARK = '#FFFFFF';       // Білий текст
const PLACEHOLDER_TEXT_COLOR = '#A0A0B0';   // Світло-сірий для плейсхолдерів
const ACCENT_COLOR_BUTTON = '#7E57C2';       // Фіолетовий для кнопки "Додати"
const ACCENT_COLOR_SWITCH = '#9575CD';      // Світліший фіолетовий для Switch

export default function AddRecipeScreen() {
    const [name, setName] = useState('');
    const [cookingTime, setCookingTime] = useState('');
    const [ingredients, setIngredients] = useState('');
    const [description, setDescription] = useState('');
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [isPublic, setIsPublic] = useState(false); // За замовчуванням НЕ публічний
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
                createdAt: firestore.FieldValue.serverTimestamp(),
            });
            Alert.alert('Успіх!', 'Рецепт успішно додано.');
            setName('');
            setCookingTime('');
            setIngredients('');
            setDescription('');
            setImageUri(null);
            setIsPublic(false);
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
            // keyboardVerticalOffset можна налаштувати, якщо заголовок або TabBar заважають
            // Наприклад, якщо є стандартний заголовок React Navigation:
            // keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
            // (де headerHeight потрібно отримати, наприклад, з useHeaderHeight())
            // Для простоти, почнемо без нього, або з невеликим значенням.
            keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
        >
            <ScrollView
                style={styles.scrollContainerStyle} // Додав окремий стиль для ScrollView
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

                <TextInput
                    style={styles.input}
                    placeholder="Назва рецепту"
                    placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
                    value={name}
                    onChangeText={setName}
                />
                <TextInput
                    style={styles.input}
                    placeholder="Час приготування (наприклад, 30 хв)"
                    placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
                    value={cookingTime}
                    onChangeText={setCookingTime}
                />
                <TextInput
                    style={[styles.input, styles.multilineInput]}
                    placeholder="Інгредієнти (через кому або кожен з нового рядка)"
                    placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
                    value={ingredients}
                    onChangeText={setIngredients}
                    multiline
                    numberOfLines={4}
                />
                <TextInput
                    style={[styles.input, styles.multilineInput]}
                    placeholder="Опис приготування"
                    placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={6}
                />

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
    scrollContainerStyle: { // Стиль для ScrollView, якщо потрібен
        flex: 1, // Може бути не потрібним, якщо keyboardAvoidingContainer вже flex: 1
    },
    // container: { // Старий стиль для ScrollView, властивості перенесено або не потрібні
    //     flex: 1,
    //     backgroundColor: PRIMARY_BACKGROUND_COLOR,
    // },
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
        color: TEXT_COLOR_ON_DARK, // Якщо кнопка світла, текст може бути темнішим
        fontSize: 18,
        fontWeight: '600',
    },
});