import { getConfig, validateDestination } from "../shared/storage";
import type { SaveQuoteMessage, SaveQuoteResponse } from "../shared/types";

type AppsScriptTransportPayload = SaveQuoteMessage["payload"] & {
  secret: string;
};

chrome.runtime.onMessage.addListener((message: SaveQuoteMessage, _sender, sendResponse) => {
  if (message.type !== "SAVE_QUOTE") {
    return undefined;
  }

  void handleSave(message.payload)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected save error."
      });
    });
  return true;
});

async function handleSave(payload: SaveQuoteMessage["payload"]): Promise<SaveQuoteResponse> {
  const config = await getConfig();
  logInfo("Starting save request", {
    appsScriptUrl: config.appsScriptUrl,
    spreadsheetId: payload.destination.spreadsheetId,
    sheetTabName: payload.destination.sheetTabName,
    mappingKeys: Object.keys(payload.destination.mapping || {}),
    title: payload.item.title,
    price: payload.item.price,
    quantity: payload.item.quantity,
    hasNotes: Boolean(payload.item.notes),
    timestamp: payload.item.timestamp
  });

  if (!config.appsScriptUrl || !config.sharedSecret) {
    logWarn("Missing Apps Script configuration", {
      hasAppsScriptUrl: Boolean(config.appsScriptUrl),
      hasSharedSecret: Boolean(config.sharedSecret)
    });
    return {
      ok: false,
      error: "Complete the Apps Script URL and shared secret in the extension options before saving."
    };
  }

  const destinationErrors = validateDestination({
    id: "save-target",
    isDefault: false,
    label: "Save target",
    spreadsheetId: payload.destination.spreadsheetId,
    sheetTabName: payload.destination.sheetTabName,
    mapping: payload.destination.mapping
  });

  if (destinationErrors.length) {
    logWarn("Destination validation failed", {
      destinationErrors
    });
    return {
      ok: false,
      error: destinationErrors[0],
      details: destinationErrors
    };
  }

  const transportPayload: AppsScriptTransportPayload = {
    ...payload,
    secret: config.sharedSecret
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(config.appsScriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Quote-Builder-Secret": config.sharedSecret
      },
      body: JSON.stringify(transportPayload),
      signal: controller.signal
    });

    const text = await response.text();
    const parsed = safeParseJson(text);
    logInfo("Received Apps Script response", {
      status: response.status,
      finalUrl: response.url,
      isJson: Boolean(parsed),
      bodyPreview: text.trim().replace(/\s+/g, " ").slice(0, 200)
    });

    if (!response.ok) {
      return {
        ok: false,
        error: parsed?.error || formatNonJsonResponse(response.status, text, response.url)
      };
    }

    if (!parsed) {
      return {
        ok: false,
        error: formatNonJsonResponse(response.status, text, response.url)
      };
    }

    if (!parsed.ok) {
      logWarn("Apps Script returned application error", parsed);
    }

    return parsed;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      logWarn("Save request timed out", {});
      return {
        ok: false,
        error: "Timed out while saving to Google Sheets."
      };
    }

    logError("Save request threw", {
      error: error instanceof Error ? error.message : String(error)
    });
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to reach Apps Script."
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function safeParseJson(value: string): SaveQuoteResponse | null {
  try {
    return JSON.parse(value) as SaveQuoteResponse;
  } catch {
    return null;
  }
}

function formatNonJsonResponse(status: number, body: string, finalUrl: string): string {
  const trimmed = body.trim();
  const compact = trimmed.replace(/\s+/g, " ").slice(0, 180);

  if (/<!doctype html|<html[\s>]/i.test(trimmed)) {
    if (finalUrl.includes("accounts.google.com")) {
      return "Apps Script redirected to a Google sign-in page. Deploy the web app using the /exec URL and allow access for Anyone, then try again.";
    }

    return "Apps Script returned HTML instead of JSON. Check that you pasted the deployed /exec web app URL and that the deployment is accessible to Anyone.";
  }

  if (!compact) {
    return `Apps Script request failed with ${status}.`;
  }

  return `Apps Script request failed with ${status}: ${compact}`;
}

function logInfo(message: string, data: Record<string, unknown>): void {
  console.log(`[Quote Builder] ${message}`, data);
}

function logWarn(message: string, data: Record<string, unknown>): void {
  console.warn(`[Quote Builder] ${message}`, data);
}

function logError(message: string, data: Record<string, unknown>): void {
  console.error(`[Quote Builder] ${message}`, data);
}
