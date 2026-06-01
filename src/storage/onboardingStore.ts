import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "better_vitty_onboarding_v1";

export async function isOnboardingComplete(): Promise<boolean> {
  const value = await AsyncStorage.getItem(KEY);
  return value === "true";
}

export async function markOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(KEY, "true");
}
