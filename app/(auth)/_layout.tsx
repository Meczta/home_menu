// app/(auth)/_layout.tsx
import React from 'react';
import { Stack } from 'expo-router';

export default function AuthLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }} />
        // headerShown: false - щоб приховати стандартний заголовок для екранів входу/реєстрації
        // Ти можеш додати власні заголовки всередині LoginScreen та RegisterScreen
    );
}