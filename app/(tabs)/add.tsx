// app/(tabs)/add.tsx
import React, {useEffect, useState} from 'react';
import {
    View,
    Text,
    TextInput,
    Button,
    StyleSheet,
    Alert,
    Image,
    ScrollView,
    TouchableOpacity,
    Platform,
    ActivityIndicator,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage'; // Для завантаження зображень
import * as ImagePicker from 'expo-image-picker'; // Для вибору зображень
import { useRouter } from 'expo-router';
import {color} from "nativewind/src/tailwind/color";

export default function AddRecipeScreen() {
    const [name, setName] = useState('');
    const [cookingTime, setCookingTime] = useState('');
    const [ingredients, setIngredients] = useState(''); // Як рядок
    const [description, setDescription] = useState('');
    const [imageUri, setImageUri] = useState<string | null>(null); // Локальний URI зображення
    const [isPublic, setIsPublic] = useState(true); // За замовчуванням публічний
    const [uploading, setUploading] = useState(false); // Для індикатора завантаження

    const router = useRouter();

    // Запит дозволів на доступ до галереї
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
            quality: 0.7, // Стискаємо зображення для швидшого завантаження
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
            // 1. Завантаження зображення (якщо вибрано)
            if (imageUri) {
                const filename = imageUri.substring(imageUri.lastIndexOf('/') + 1);
                const uploadUri = Platform.OS === 'ios' ? imageUri.replace('file://', '') : imageUri;
                const storageRef = storage().ref(`recipe_images/${currentUser.uid}/${filename}_${Date.now()}`);

                await storageRef.putFile(uploadUri);
                uploadedImageUrl = await storageRef.getDownloadURL();
                console.log('Image uploaded to:', uploadedImageUrl);
            }

            // 2. Додавання даних рецепту до Firestore
            await firestore().collection('recipes').add({
                name,
                cookingTime,
                ingredients, // Зберігаємо як рядок
                description,
                imageUrl: uploadedImageUrl, // URL з Firebase Storage або null
                userId: currentUser.uid,
                isPublic,
                createdAt: firestore.FieldValue.serverTimestamp(), // Дата створення на сервері
            });

            Alert.alert('Успіх!', 'Рецепт успішно додано.');
            // Очищення форми
            setName('');
            setCookingTime('');
            setIngredients('');
            setDescription('');
            setImageUri(null);
            setIsPublic(true);
            // Можна перенаправити на інший екран, наприклад, на головний
            // router.push('/(tabs)');
        } catch (error: any) {
            console.error("Error adding recipe: ", error);
            Alert.alert('Помилка додавання', error.message || 'Не вдалося додати рецепт.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <Text style={styles.title}>Додати новий рецепт</Text>

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
                value={name}
                onChangeText={setName}
            />
            <TextInput
                style={styles.input}
                placeholder="Час приготування (наприклад, 30 хв)"
                value={cookingTime}
                onChangeText={setCookingTime}
            />
            <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Інгредієнти (через кому або кожен з нового рядка)"
                value={ingredients}
                onChangeText={setIngredients}
                multiline
                numberOfLines={4}
            />
            <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Опис приготування"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={6}
            />

            <View style={styles.switchContainer}>
                <Text style={styles.switchLabel}>Зробити рецепт публічним?</Text>
                {/* Тут можна додати Switch з react-native, але для простоти поки так */}
                <Button
                    title={isPublic ? "Так, публічний" : "Ні, приватний"}
                    onPress={() => setIsPublic(isPublic)}
                />
            </View>

            {uploading ? (
                <ActivityIndicator size="large" color="#C37AFF" style={{ marginVertical: 20 }} />
            ) : (
                <Button title="Додати рецепт" onPress={handleAddRecipe} />
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1A1A1A', // Або твій колір фону
    },
    contentContainer: {
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF', // Або твій колір тексту
        textAlign: 'center',
        marginBottom: 20,
    },
    input: {
        backgroundColor: '#2C2C2C', // Або твій колір поля вводу
        color: '#FFFFFF',
        borderRadius: 8,
        paddingHorizontal: 15,
        paddingVertical: 10,
        marginBottom: 15,
        fontSize: 16,
    },
    multilineInput: {
        minHeight: 80,
        textAlignVertical: 'top', // Для Android, щоб текст починався зверху
    },
    imagePicker: {
        height: 150,
        width: '100%',
        backgroundColor: '#2C2C2C',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#4A4A4A',
    },
    imagePickerText: {
        color: '#A0A0A0',
    },
    imagePreview: {
        width: '100%',
        height: '100%',
        borderRadius: 8,
    },
    switchContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingHorizontal: 10, // Щоб текст не прилипав до країв
        // Стилізуй текст "Зробити рецепт публічним?" окремо, якщо потрібно
    },
    switchLabel: { // <--- НОВИЙ СТИЛЬ
        color: '#FFFFFF', // Встановлюємо білий колір тексту
        fontSize: 16, // Можеш налаштувати розмір за потреби
        // Додай інші стилі, якщо потрібно (наприклад, marginRight для відступу від кнопки)
        marginRight: 10,
    },
    // Додай стилі для Text всередині switchContainer, якщо потрібно
});