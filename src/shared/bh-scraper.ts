import { extractBestPriceFromText, normalizeCanonicalUrl, parsePriceValue } from "./price";
import type { ScrapedProduct } from "./types";

const PRODUCT_PATH_RE = /^\/c\/product\//;
const TITLE_BRANDING_RE = /\s*[-|]\s*B&H Photo(?: Video)?\s*$/i;

export function isSupportedBhUrl(href: string): boolean {
  try {
    const url = new URL(href);
    return (
      (url.hostname === "www.bhphotovideo.com" || url.hostname === "bhphotovideo.com") &&
      PRODUCT_PATH_RE.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export function scrapeBhProductDocument(document: Document, href: string): ScrapedProduct {
  if (!isSupportedBhUrl(href)) {
    throw new Error("Open a B&H product page to capture an item.");
  }

  const url = extractCanonicalUrl(document, href);
  const title = extractTitle(document);
  const price = extractPrice(document);

  if (!title) {
    throw new Error("Could not find the product title on this B&H page.");
  }

  if (price === null) {
    throw new Error("Could not find a numeric product price on this B&H page.");
  }

  return {
    vendor: "B&H",
    title,
    price,
    url
  };
}

function extractCanonicalUrl(document: Document, href: string): string {
  const canonicalHref = document
    .querySelector<HTMLLinkElement>('link[rel="canonical"]')
    ?.getAttribute("href");

  if (canonicalHref) {
    return normalizeCanonicalUrl(new URL(canonicalHref, href).toString());
  }

  return normalizeCanonicalUrl(href);
}

function extractTitle(document: Document): string {
  const title =
    document.querySelector("h1")?.textContent?.trim() ||
    document
      .querySelector<HTMLMetaElement>('meta[property="og:title"]')
      ?.getAttribute("content")
      ?.trim() ||
    "";

  return title.replace(TITLE_BRANDING_RE, "").trim();
}

function extractPrice(document: Document): number | null {
  const metaCandidates = [
    document
      .querySelector<HTMLMetaElement>('meta[property="product:price:amount"]')
      ?.getAttribute("content"),
    document.querySelector<HTMLMetaElement>('meta[itemprop="price"]')?.getAttribute("content")
  ];

  for (const candidate of metaCandidates) {
    const parsed = parsePriceValue(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  const jsonLdPrice = extractPriceFromJsonLd(document);
  if (jsonLdPrice !== null) {
    return jsonLdPrice;
  }

  const selectorCandidates = [
    '[data-selenium="pricingPrice"]',
    '[data-selenium="smallProductPrice"]',
    '[data-selenium="productPrice"]',
    '[data-selenium*="price" i]',
    '[itemprop="price"]'
  ];

  for (const selector of selectorCandidates) {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
    for (const element of elements) {
      const price = extractBestPriceFromText(element.textContent ?? "");
      if (price !== null) {
        return price;
      }
    }
  }

  return null;
}

function extractPriceFromJsonLd(document: Document): number | null {
  const scripts = Array.from(
    document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')
  );

  for (const script of scripts) {
    const content = script.textContent?.trim();
    if (!content) {
      continue;
    }

    try {
      const data = JSON.parse(content);
      const price = findPriceInJsonLd(data);
      if (price !== null) {
        return price;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function findPriceInJsonLd(value: unknown): number | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const price = findPriceInJsonLd(item);
      if (price !== null) {
        return price;
      }
    }
    return null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  if ("price" in record) {
    const parsed = parsePriceValue(record.price as string | number | null | undefined);
    if (parsed !== null) {
      return parsed;
    }
  }

  for (const nested of Object.values(record)) {
    const price = findPriceInJsonLd(nested);
    if (price !== null) {
      return price;
    }
  }

  return null;
}

