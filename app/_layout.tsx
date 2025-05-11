// app/_layout.tsx
import React, { useState, useEffect } from 'react';
import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { ActivityIndicator, View, StyleSheet } from 'react-native'; // ActivityIndicator тут вже не потрібен, якщо сплеш-екран працює
import './globals.css';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false); // Новий стан, щоб знати, коли ховати сплеш
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const subscriber = auth().onAuthStateChanged(currentUser => {
      setUser(currentUser);
      setIsReady(true); // Встановлюємо, що готові, коли отримали стан користувача
    });
    return subscriber;
  }, []);

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync(); // Приховуємо сплеш-екран, коли isReady
    }
  }, [isReady]);


  useEffect(() => {
    if (!isReady) { // Не робимо навігацію, поки не готові (сплеш-екран ще може бути активним)
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';

    if (user) {
      if (inAuthGroup) {
        router.replace('/(tabs)');
        // @ts-ignore TS2367
      } else if (segments.length === 0 && !router.canGoBack()) {
        router.replace('/(tabs)');
      }
    } else {
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    }
  }, [user, segments, isReady, router]); // Додано isReady до залежностей

  // Якщо isReady ще false, сплеш-екран буде видимим.
  // Stack рендериться завжди, але його вміст залежить від user.
  // Це має задовольнити вимогу Expo Router щодо типу дочірніх елементів.
  if (!isReady) {
    return null; // Або порожній Stack, або просто null, поки сплеш-екран працює
                 // Наприклад: return <Stack screenOptions={{ headerShown: false }} />; (без Screen всередині)
                 // Або, якщо SplashScreen.preventAutoHideAsync() працює добре, можна просто рендерити основний Stack
  }

  return (
      <Stack screenOptions={{ headerShown: false }}>
        {user ? (
            <>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="meals/[id]" />
            </>
        ) : (
            <Stack.Screen name="(auth)" />
        )}
        {/* <Stack.Screen name="+not-found" /> */}
      </Stack>
  );
}

// const styles = StyleSheet.create({ ... }); // Стилі для loadingContainer тут вже не потрібні, якщо його немає