import type {
  AppConfig,
  DestinationConfig,
  FieldKey,
  FieldMapping,
  HeaderMapping
} from "./types";

const STORAGE_KEY = "appConfig";

export const DEFAULT_CONFIG: AppConfig = {
  appsScriptUrl: "",
  sharedSecret: "",
  destinations: []
};

export async function getConfig(): Promise<AppConfig> {
  const stored = await storageGet<AppConfig>(STORAGE_KEY);
  if (!stored) {
    return structuredClone(DEFAULT_CONFIG);
  }

  return normalizeConfig(stored);
}

export async function saveConfig(config: AppConfig): Promise<void> {
  const normalized = normalizeConfig(config);
  await storageSet(STORAGE_KEY, normalized);
}

export function normalizeConfig(config: AppConfig): AppConfig {
  return {
    appsScriptUrl: config.appsScriptUrl.trim(),
    sharedSecret: config.sharedSecret.trim(),
    destinations: normalizeDestinations(config.destinations ?? [])
  };
}

export function normalizeDestinations(destinations: DestinationConfig[]): DestinationConfig[] {
  if (!destinations.length) {
    return [];
  }

  const normalized = destinations.map((destination, index) => ({
    ...destination,
    id: destination.id?.trim() || generateId(),
    label: destination.label.trim(),
    spreadsheetId: destination.spreadsheetId.trim(),
    sheetTabName: destination.sheetTabName.trim(),
    mapping: trimMapping(destination.mapping),
    isDefault: Boolean(destination.isDefault && index === destinations.findIndex((item) => item.isDefault))
  }));

  if (!normalized.some((destination) => destination.isDefault)) {
    normalized[0].isDefault = true;
  }

  return normalized;
}

export function trimMapping(mapping: HeaderMapping = {}): HeaderMapping {
  return Object.fromEntries(
    Object.entries(mapping)
      .map(([key, value]) => {
        const normalized = normalizeFieldMapping(key as FieldKey, value);
        return normalized ? [key, normalized] : null;
      })
      .filter((entry): entry is [string, FieldMapping] => entry !== null)
  ) as HeaderMapping;
}

function normalizeFieldMapping(field: FieldKey, value: unknown): FieldMapping | null {
  if (typeof value === "string") {
    const header = value.trim();
    if (!header) {
      return null;
    }

    return {
      header,
      required: field === "title" || field === "price" || field === "url"
    };
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<FieldMapping>;
  const header = typeof candidate.header === "string" ? candidate.header.trim() : "";
  if (!header) {
    return null;
  }

  return {
    header,
    required: Boolean(candidate.required)
  };
}

export function generateId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `dest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function parseSpreadsheetId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch) {
    return urlMatch[1];
  }

  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export function validateAppsScriptUrl(url: string): string[] {
  const trimmed = url.trim();
  if (!trimmed) {
    return ["Apps Script URL is required."];
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" || parsed.hostname !== "script.google.com") {
      return ["Apps Script URL must use https://script.google.com/."];
    }
  } catch {
    return ["Apps Script URL is invalid."];
  }

  return [];
}

export function validateDestination(destination: DestinationConfig): string[] {
  const errors: string[] = [];

  if (!destination.label.trim()) {
    errors.push("Destination label is required.");
  }

  if (!destination.spreadsheetId.trim()) {
    errors.push("Spreadsheet ID is required.");
  }

  if (!destination.sheetTabName.trim()) {
    errors.push("Sheet tab name is required.");
  }

  const mappedFields = Object.values(destination.mapping).filter((value) => value?.header.trim());
  if (mappedFields.length === 0) {
    errors.push("Add at least one mapped column header.");
  }

  return errors;
}

export function validateConfig(config: AppConfig): string[] {
  const errors = [
    ...validateAppsScriptUrl(config.appsScriptUrl),
    ...(config.sharedSecret.trim() ? [] : ["Shared secret is required."])
  ];

  if (config.destinations.length > 0) {
    const defaultCount = config.destinations.filter((destination) => destination.isDefault).length;
    if (defaultCount !== 1) {
      errors.push("Exactly one destination must be marked as default.");
    }
  }

  return errors;
}

export function hasReadyConfig(config: AppConfig): boolean {
  return (
    validateAppsScriptUrl(config.appsScriptUrl).length === 0 &&
    Boolean(config.sharedSecret.trim()) &&
    config.destinations.length > 0
  );
}

export function getActiveHeaderMapping(mapping: HeaderMapping): HeaderMapping {
  return Object.fromEntries(
    Object.entries(mapping).filter(([, value]) => value && value.header.trim())
  ) as HeaderMapping;
}

export function formatMappingLabel(field: FieldKey, mapping: HeaderMapping): string | null {
  const config = mapping[field];
  if (!config?.header) {
    return null;
  }

  return config.required ? `${field} (required)` : field;
}

function storageGet<T>(key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(key, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(result[key] as T | undefined);
    });
  });
}

function storageSet<T>(key: string, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve();
    });
  });
}
