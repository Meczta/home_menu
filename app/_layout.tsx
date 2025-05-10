// app/_layout.tsx
import React, { useState, useEffect } from 'react';
import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth'; // Імпортуємо тип для користувача
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import './globals.css'; // Твої глобальні стилі

// Залишаємо сплеш-екран видимим, поки не визначимо стан аутентифікації
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null); // Стан для користувача Firebase
  const router = useRouter();
  const segments = useSegments(); // Отримуємо поточні сегменти URL для визначення маршруту

  // Обробник змін стану аутентифікації Firebase
  useEffect(() => {
    const subscriber = auth().onAuthStateChanged(currentUser => {
      setUser(currentUser); // Встановлюємо користувача (або null)
      if (initializing) {
        setInitializing(false); // Завершуємо початкову ініціалізацію
      }
      SplashScreen.hideAsync(); // Тепер можна приховати сплеш-екран
    });
    return subscriber; // Відписуємося від слухача при розмонтуванні компонента
  }, []); // Залежність `initializing` тут не потрібна, бо вона встановлюється всередині

  // Логіка навігації на основі стану аутентифікації та поточного маршруту
  useEffect(() => {
    if (initializing) {
      return; // Не робимо нічого, поки йде ініціалізація
    }

    const inAuthGroup = segments[0] === '(auth)'; // Перевіряємо, чи поточний маршрут належить до групи (auth)

    if (user) {
      // Користувач увійшов в систему
      if (inAuthGroup) {
        // Якщо користувач увійшов, але знаходиться на екрані аутентифікації (наприклад, після реєстрації),
        // перенаправляємо його на головний екран (вкладки)
        router.replace('/(tabs)');
        // @ts-ignore TS2367
      } else if (segments.length === 0 && !router.canGoBack()) {
        router.replace('/(tabs)');
      }
      // Якщо користувач увійшов і вже знаходиться на екранах '(tabs)' або 'meals/[id]', нічого не робимо
    } else {
      // Користувач не увійшов в систему
      if (!inAuthGroup) {
        // Якщо користувач не увійшов і не знаходиться на екранах аутентифікації,
        // перенаправляємо його на екран входу
        router.replace('/(auth)/login');
      }
      // Якщо користувач не увійшов і вже на екранах аутентифікації, нічого не робимо
    }
  }, [user, segments, initializing, router]); // Залежності для цього ефекту

  // Поки йде перевірка стану аутентифікації, показуємо індикатор завантаження
  if (initializing) {
    return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#C37AFF" /> {/* Або колір твого бренду */}
        </View>
    );
  }

  // Тепер умовно відображаємо екрани всередині Stack
  // в залежності від того, чи є користувач
  return (
      <Stack screenOptions={{ headerShown: false }}>
        {user ? (
            // Екрани для аутентифікованих користувачів
            <>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="meals/[id]" />
              {/* Тут ти можеш додати інші екрани, доступні тільки після входу, якщо вони на цьому ж рівні навігації */}
            </>
        ) : (
            // Екран (група екранів) для неаутентифікованих користувачів
            <>
              <Stack.Screen name="(auth)" />
              {/* Цей Screen буде рендерити макет, визначений у app/(auth)/_layout.tsx */}
            </>
        )}
        {/* Ти також можеш додати глобальний екран "+not-found" тут, якщо потрібно */}
        {/* <Stack.Screen name="+not-found" /> */}
      </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A1A', // Можеш змінити на колір фону твого сплеш-екрану
  },
});