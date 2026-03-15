import { isSupportedBhUrl } from "../shared/bh-scraper";
import { formatUsd } from "../shared/price";
import { buildSaveQuoteRequest } from "../shared/save-payload";
import { getConfig, hasReadyConfig } from "../shared/storage";
import type {
  DestinationConfig,
  SaveQuoteResponse,
  ScrapeActiveProductResponse,
  ScrapedProduct
} from "../shared/types";

const statusMessage = document.querySelector<HTMLParagraphElement>("#status-message");
const configWarning = document.querySelector<HTMLParagraphElement>("#config-warning");
const captureForm = document.querySelector<HTMLFormElement>("#capture-form");
const destinationSelect = document.querySelector<HTMLSelectElement>("#destination-select");
const previewTitle = document.querySelector<HTMLParagraphElement>("#preview-title");
const previewPrice = document.querySelector<HTMLParagraphElement>("#preview-price");
const previewUrl = document.querySelector<HTMLParagraphElement>("#preview-url");
const quantityInput = document.querySelector<HTMLInputElement>("#quantity-input");
const notesInput = document.querySelector<HTMLTextAreaElement>("#notes-input");
const saveButton = document.querySelector<HTMLButtonElement>("#save-button");
const openOptionsButton = document.querySelector<HTMLButtonElement>("#open-options");

let currentProduct: ScrapedProduct | null = null;
let destinations: DestinationConfig[] = [];
let configReady = false;

openOptionsButton?.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

captureForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentProduct) {
    setStatus("Open a B&H product page to capture an item.", "error");
    return;
  }

  const destination = destinations.find((item) => item.id === destinationSelect?.value);
  if (!destination) {
    setStatus("Choose a destination before saving.", "error");
    return;
  }

  const quantity = Number.parseInt(quantityInput?.value ?? "1", 10);
  if (!Number.isInteger(quantity) || quantity < 1) {
    setStatus("Quantity must be a whole number of at least 1.", "error");
    return;
  }

  if ((notesInput?.value.length ?? 0) > 500) {
    setStatus("Notes must be 500 characters or fewer.", "error");
    return;
  }

  setSaving(true);
  setStatus("Saving to Google Sheets...", "info");

  const payload = buildSaveQuoteRequest({
    destination,
    product: currentProduct,
    quantity,
    notes: notesInput?.value ?? ""
  });

  try {
    const response = await sendRuntimeMessage<SaveQuoteResponse>({
      type: "SAVE_QUOTE",
      payload
    });

    if (response.ok) {
      const rowText = response.rowNumber ? ` Row ${response.rowNumber}.` : "";
      setStatus(`Saved to ${destination.label}.${rowText}`, "success");
    } else {
      setStatus(formatSaveError(response), "error");
    }
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Unable to save this quote item.", "error");
  }

  setSaving(false);
});

void initializePopup().catch((error) => {
  setStatus(
    error instanceof Error ? error.message : "Unable to initialize the popup.",
    "error"
  );
});

async function initializePopup(): Promise<void> {
  const [config, activeTab] = await Promise.all([getConfig(), getActiveTab()]);

  destinations = config.destinations;
  configReady = hasReadyConfig(config);

  renderDestinations(destinations);
  toggleConfigWarning(!configReady);

  if (!activeTab?.id || !activeTab.url || !isSupportedBhUrl(activeTab.url)) {
    showUnsupportedState();
    return;
  }

  setStatus("Loading product data...", "info");

  const scrapeResponse = await scrapeActiveProduct(activeTab.id);

  if (!scrapeResponse.ok) {
    setStatus(scrapeResponse.error, "error");
    return;
  }

  currentProduct = scrapeResponse.product;
  previewTitle!.textContent = scrapeResponse.product.title;
  previewPrice!.textContent = formatUsd(scrapeResponse.product.price);
  previewUrl!.textContent = scrapeResponse.product.url;

  captureForm?.classList.remove("hidden");
  setStatus(
    configReady
      ? "Review the item and save it to Google Sheets."
      : "Item captured. Finish setup in Options before saving.",
    "info"
  );
  updateSaveButtonState();
}

function renderDestinations(nextDestinations: DestinationConfig[]): void {
  if (!destinationSelect) {
    return;
  }

  destinationSelect.innerHTML = "";

  for (const destination of nextDestinations) {
    const option = document.createElement("option");
    option.value = destination.id;
    option.textContent = destination.label;
    if (destination.isDefault) {
      option.selected = true;
    }
    destinationSelect.appendChild(option);
  }

  if (!destinationSelect.value && nextDestinations[0]) {
    destinationSelect.value = nextDestinations[0].id;
  }
}

function showUnsupportedState(): void {
  captureForm?.classList.add("hidden");
  setStatus("Open a B&H product page to capture an item.", "error");
}

function updateSaveButtonState(): void {
  if (!saveButton) {
    return;
  }

  saveButton.disabled = !configReady || !currentProduct || destinations.length === 0;
}

function setSaving(isSaving: boolean): void {
  if (saveButton) {
    saveButton.disabled = isSaving || !configReady || !currentProduct;
    saveButton.textContent = isSaving ? "Saving..." : "Save to Google Sheets";
  }
}

function toggleConfigWarning(show: boolean): void {
  configWarning?.classList.toggle("hidden", !show);
}

function setStatus(message: string, tone: "info" | "error" | "success"): void {
  if (!statusMessage) {
    return;
  }

  statusMessage.textContent = message;
  statusMessage.dataset.tone = tone;
}

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  return tabs[0];
}

function sendRuntimeMessage<T>(message: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: T) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(response);
    });
  });
}

function sendTabMessage<T>(tabId: number, message: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response: T) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(response);
    });
  });
}

async function scrapeActiveProduct(tabId: number): Promise<ScrapeActiveProductResponse> {
  try {
    return await sendTabMessage<ScrapeActiveProductResponse>(tabId, {
      type: "SCRAPE_ACTIVE_PRODUCT"
    });
  } catch (error) {
    if (!isRecoverableConnectionError(error)) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to read this B&H page."
      };
    }
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });

    return await sendTabMessage<ScrapeActiveProductResponse>(tabId, {
      type: "SCRAPE_ACTIVE_PRODUCT"
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Unable to read this page: ${error.message}`
          : "Unable to read this page. Refresh the B&H tab and try again."
    };
  }
}

function isRecoverableConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("receiving end does not exist") ||
    message.includes("could not establish connection") ||
    message.includes("message port closed")
  );
}

function formatSaveError(response: Extract<SaveQuoteResponse, { ok: false }>): string {
  if (!response.details?.length) {
    return response.error;
  }

  return `${response.error}: ${response.details.join(" | ")}`;
}
