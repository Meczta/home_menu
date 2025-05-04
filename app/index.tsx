import { Text, View } from "react-native";
import {Link} from "expo-router";

export default function Index() {
  return (
    <View className="flex-1 justify-center items-center">
      <Text className="text-5xl text-dark-100 font-bold">Welcome!</Text>
        <Link href="/onboarding" className="text-blue-500 text-2xl mt-4">Onboarding</Link>
    </View>
  );
}
