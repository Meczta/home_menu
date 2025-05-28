// app/(tabs)/saved.tsx
import React from 'react';
import {View, Text, StyleSheet, Platform} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SavedRecipesScreen() {
    return (
        <SafeAreaView style={styles.container}>
            <Text style={styles.title}>Збережені Рецепти</Text>
            {/* Тут буде список збережених рецептів */}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f0D23', // Або твій основний фон
        // justifyContent: 'center', // Якщо поки що просто текст
        // alignItems: 'center',
        paddingTop: Platform.OS === 'android' ? 25 : 0,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center',
        marginTop: 20,
        marginBottom: 20,
    },
});