import {
  FIELD_KEYS,
  type AppConfig,
  type DestinationConfig,
  type HeaderMapping
} from "../shared/types";
import {
  generateId,
  getConfig,
  normalizeConfig,
  parseSpreadsheetId,
  saveConfig,
  validateAppsScriptUrl,
  validateDestination
} from "../shared/storage";

const globalForm = document.querySelector<HTMLFormElement>("#global-form");
const appsScriptUrlInput = document.querySelector<HTMLInputElement>("#apps-script-url");
const sharedSecretInput = document.querySelector<HTMLInputElement>("#shared-secret");
const statusBanner = document.querySelector<HTMLParagraphElement>("#status-banner");

const destinationsList = document.querySelector<HTMLDivElement>("#destinations-list");
const destinationsEmpty = document.querySelector<HTMLDivElement>("#destinations-empty");
const newDestinationButton = document.querySelector<HTMLButtonElement>("#new-destination");
const destinationForm = document.querySelector<HTMLFormElement>("#destination-form");
const destinationIdInput = document.querySelector<HTMLInputElement>("#destination-id");
const destinationLabelInput = document.querySelector<HTMLInputElement>("#destination-label");
const spreadsheetInput = document.querySelector<HTMLInputElement>("#spreadsheet-input");
const sheetTabNameInput = document.querySelector<HTMLInputElement>("#sheet-tab-name");
const destinationDefaultInput = document.querySelector<HTMLInputElement>("#destination-default");
const resetDestinationButton = document.querySelector<HTMLButtonElement>("#reset-destination");

const mappingInputs = {
  title: document.querySelector<HTMLInputElement>("#mapping-title"),
  price: document.querySelector<HTMLInputElement>("#mapping-price"),
  url: document.querySelector<HTMLInputElement>("#mapping-url"),
  vendor: document.querySelector<HTMLInputElement>("#mapping-vendor"),
  timestamp: document.querySelector<HTMLInputElement>("#mapping-timestamp"),
  quantity: document.querySelector<HTMLInputElement>("#mapping-quantity"),
  notes: document.querySelector<HTMLInputElement>("#mapping-notes")
};

let config: AppConfig = {
  appsScriptUrl: "",
  sharedSecret: "",
  destinations: []
};

globalForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const errors = [
    ...validateAppsScriptUrl(appsScriptUrlInput?.value ?? ""),
    ...((sharedSecretInput?.value ?? "").trim() ? [] : ["Shared secret is required."])
  ];

  if (errors.length) {
    showStatus(errors[0], "error");
    return;
  }

  config.appsScriptUrl = appsScriptUrlInput?.value.trim() ?? "";
  config.sharedSecret = sharedSecretInput?.value.trim() ?? "";

  try {
    await persistConfig("Apps Script settings saved.");
  } catch (error) {
    showStatus(error instanceof Error ? error.message : "Unable to save Apps Script settings.", "error");
  }
});

destinationForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const spreadsheetId = parseSpreadsheetId(spreadsheetInput?.value ?? "");
  if (!spreadsheetId) {
    showStatus("Enter a valid spreadsheet URL or spreadsheet ID.", "error");
    return;
  }

  const draftDestination: DestinationConfig = {
    id: destinationIdInput?.value || generateId(),
    label: destinationLabelInput?.value.trim() ?? "",
    spreadsheetId,
    sheetTabName: sheetTabNameInput?.value.trim() ?? "",
    mapping: readMappingFromForm(),
    isDefault: Boolean(destinationDefaultInput?.checked)
  };

  const errors = validateDestination(draftDestination);
  if (errors.length) {
    showStatus(errors[0], "error");
    return;
  }

  const existingIndex = config.destinations.findIndex((destination) => destination.id === draftDestination.id);
  const nextDestinations = [...config.destinations];

  if (existingIndex >= 0) {
    nextDestinations[existingIndex] = draftDestination;
  } else {
    nextDestinations.push(draftDestination);
  }

  if (draftDestination.isDefault || nextDestinations.length === 1) {
    for (const destination of nextDestinations) {
      destination.isDefault = destination.id === draftDestination.id;
    }
  }

  config.destinations = nextDestinations;

  try {
    await persistConfig(existingIndex >= 0 ? "Destination updated." : "Destination created.");
    resetDestinationForm();
  } catch (error) {
    showStatus(error instanceof Error ? error.message : "Unable to save destination.", "error");
  }
});

newDestinationButton?.addEventListener("click", () => {
  resetDestinationForm();
  destinationLabelInput?.focus();
});

resetDestinationButton?.addEventListener("click", () => {
  resetDestinationForm();
});

void initializeOptions().catch((error) => {
  showStatus(error instanceof Error ? error.message : "Unable to load extension settings.", "error");
});

async function initializeOptions(): Promise<void> {
  config = await getConfig();
  hydrateForms();
  renderDestinations();
}

function hydrateForms(): void {
  if (appsScriptUrlInput) {
    appsScriptUrlInput.value = config.appsScriptUrl;
  }

  if (sharedSecretInput) {
    sharedSecretInput.value = config.sharedSecret;
  }
}

function renderDestinations(): void {
  if (!destinationsList || !destinationsEmpty) {
    return;
  }

  destinationsList.innerHTML = "";
  destinationsEmpty.classList.toggle("hidden", config.destinations.length > 0);

  for (const destination of config.destinations) {
    destinationsList.appendChild(createDestinationCard(destination));
  }
}

function createDestinationCard(destination: DestinationConfig): HTMLElement {
  const card = document.createElement("article");
  card.className = "destination-card";

  const heading = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = destination.label;
  heading.appendChild(title);

  if (destination.isDefault) {
    const pill = document.createElement("span");
    pill.className = "default-pill";
    pill.textContent = "Default";
    heading.appendChild(pill);
  }

  const meta = document.createElement("p");
  meta.className = "destination-meta";
  meta.textContent = `${destination.sheetTabName} • ${destination.spreadsheetId}`;

  const mapping = document.createElement("p");
  mapping.className = "destination-meta";
  mapping.textContent = `Mapped headers: ${formatMappings(destination.mapping)}`;

  const actions = document.createElement("div");
  actions.className = "destination-actions";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "ghost-button";
  editButton.textContent = "Edit";
  editButton.addEventListener("click", () => {
    loadDestinationIntoForm(destination);
  });

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "ghost-button";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener("click", async () => {
    config.destinations = config.destinations.filter((item) => item.id !== destination.id);
    try {
      await persistConfig("Destination deleted.");
      resetDestinationForm();
    } catch (error) {
      showStatus(error instanceof Error ? error.message : "Unable to delete destination.", "error");
    }
  });

  actions.append(editButton, deleteButton);
  card.append(heading, meta, mapping, actions);
  return card;
}

function loadDestinationIntoForm(destination: DestinationConfig): void {
  if (destinationIdInput) {
    destinationIdInput.value = destination.id;
  }
  if (destinationLabelInput) {
    destinationLabelInput.value = destination.label;
  }
  if (spreadsheetInput) {
    spreadsheetInput.value = destination.spreadsheetId;
  }
  if (sheetTabNameInput) {
    sheetTabNameInput.value = destination.sheetTabName;
  }
  if (destinationDefaultInput) {
    destinationDefaultInput.checked = destination.isDefault;
  }

  for (const field of FIELD_KEYS) {
    const input = mappingInputs[field];
    if (input) {
      input.value = destination.mapping[field] ?? "";
    }
  }

  destinationLabelInput?.focus();
}

function resetDestinationForm(): void {
  destinationForm?.reset();
  if (destinationIdInput) {
    destinationIdInput.value = "";
  }

  if (config.destinations.length === 0 && destinationDefaultInput) {
    destinationDefaultInput.checked = true;
  }
}

function readMappingFromForm(): HeaderMapping {
  const mapping: HeaderMapping = {};

  for (const field of FIELD_KEYS) {
    const value = mappingInputs[field]?.value.trim();
    if (value) {
      mapping[field] = value;
    }
  }

  return mapping;
}

function formatMappings(mapping: HeaderMapping): string {
  return FIELD_KEYS.filter((field) => mapping[field]).join(", ");
}

async function persistConfig(successMessage: string): Promise<void> {
  config = normalizeConfig(config);
  await saveConfig(config);
  hydrateForms();
  renderDestinations();
  showStatus(successMessage, "success");
}

function showStatus(message: string, tone: "success" | "error"): void {
  if (!statusBanner) {
    return;
  }

  statusBanner.textContent = message;
  statusBanner.dataset.tone = tone;
  statusBanner.classList.remove("hidden");
}
