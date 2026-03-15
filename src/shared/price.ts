const DISPLAY_PRICE_RE = /\$\s*\d[\d,]*(?:\.\d{2})?/g;

export function normalizeCanonicalUrl(href: string): string {
  const url = new URL(href);
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function parsePriceValue(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replace(/[$,\s]/g, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function extractBestPriceFromText(text: string): number | null {
  if (!text) {
    return null;
  }

  const matches = [...text.matchAll(DISPLAY_PRICE_RE)];
  const candidates = matches
    .map((match) => {
      const suffix = text.slice(match.index ?? 0, (match.index ?? 0) + 18).toLowerCase();
      if (suffix.includes("/mo") || suffix.includes("month")) {
        return null;
      }

      return parsePriceValue(match[0]);
    })
    .filter((value): value is number => value !== null);

  if (!candidates.length) {
    return null;
  }

  return Math.max(...candidates);
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amount);
}

