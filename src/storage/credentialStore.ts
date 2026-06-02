import * as SecureStore from "expo-secure-store";

const CREDENTIALS_KEY = "better_vitty_vtop_credentials_v1";

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  keychainService: "better-vitty.vtop.credentials",
};

export interface StoredCredentials {
  readonly username: string;
  readonly password: string;
  readonly displayName?: string;
  readonly registrationNumber?: string;
}

function normalizeRegistrationNumber(value: string | undefined): string | undefined {
  const normalized = value?.trim().toUpperCase();
  return normalized || undefined;
}

function normalizeDisplayName(value: string | undefined, username: string, registrationNumber: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/\s+/g, " ");
  if (!normalized) return undefined;
  if (normalized.toLocaleLowerCase() === username.trim().toLocaleLowerCase()) return undefined;
  if (registrationNumber && normalized.toLocaleLowerCase() === registrationNumber.toLocaleLowerCase()) return undefined;
  return normalized;
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
    const username = parsed.username.trim();
    const registrationNumber = normalizeRegistrationNumber(parsed.registrationNumber);
    const displayName = normalizeDisplayName(parsed.displayName, username, registrationNumber);
    return {
      username,
      password: parsed.password,
      ...(displayName ? { displayName } : {}),
      ...(registrationNumber ? { registrationNumber } : {}),
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
  const username = credentials.username.trim();
  const registrationNumber = normalizeRegistrationNumber(credentials.registrationNumber);
  const displayName = normalizeDisplayName(credentials.displayName, username, registrationNumber);
  await SecureStore.setItemAsync(
    CREDENTIALS_KEY,
    JSON.stringify({
      username,
      password: credentials.password,
      ...(displayName ? { displayName } : {}),
      ...(registrationNumber ? { registrationNumber } : {}),
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
