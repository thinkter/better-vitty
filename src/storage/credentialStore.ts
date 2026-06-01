import * as SecureStore from "expo-secure-store";

const CREDENTIALS_KEY = "better_vitty_vtop_credentials_v1";

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  keychainService: "better-vitty.vtop.credentials",
};

export interface StoredCredentials {
  readonly username: string;
  readonly password: string;
}

function parseCredentials(value: string): StoredCredentials | null {
  try {
    const parsed = JSON.parse(value) as Partial<StoredCredentials>;
    if (typeof parsed.username !== "string" || typeof parsed.password !== "string") {
      return null;
    }
    if (!parsed.username.trim() || !parsed.password) {
      return null;
    }
    return {
      username: parsed.username.trim(),
      password: parsed.password,
    };
  } catch {
    return null;
  }
}

async function assertSecureStoreAvailable(): Promise<void> {
  if (!(await SecureStore.isAvailableAsync())) {
    throw new Error("secure credential storage is not available on this device");
  }
}

export async function saveCredentials(credentials: StoredCredentials): Promise<void> {
  await assertSecureStoreAvailable();
  await SecureStore.setItemAsync(
    CREDENTIALS_KEY,
    JSON.stringify({
      username: credentials.username.trim(),
      password: credentials.password,
    }),
    SECURE_STORE_OPTIONS,
  );
}

export async function loadCredentials(): Promise<StoredCredentials | null> {
  if (!(await SecureStore.isAvailableAsync())) {
    return null;
  }
  const value = await SecureStore.getItemAsync(CREDENTIALS_KEY, SECURE_STORE_OPTIONS);
  return value ? parseCredentials(value) : null;
}

export async function deleteCredentials(): Promise<void> {
  if (!(await SecureStore.isAvailableAsync())) {
    return;
  }
  await SecureStore.deleteItemAsync(CREDENTIALS_KEY, SECURE_STORE_OPTIONS);
}
