import { extractBestPriceFromText, normalizeCanonicalUrl, parsePriceValue } from "./price";
import type { ScrapedProduct } from "./types";

const AMAZON_PRODUCT_PATH_RE = /\/(?:gp\/product|dp)\//;

export function isSupportedAmazonUrl(href: string): boolean {
  try {
    const url = new URL(href);
    return (
      (url.hostname === "www.amazon.com" || url.hostname === "amazon.com") &&
      AMAZON_PRODUCT_PATH_RE.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export function scrapeAmazonProductDocument(document: Document, href: string): ScrapedProduct {
  if (!isSupportedAmazonUrl(href)) {
    throw new Error("Open an Amazon product page to capture an item.");
  }

  const url = extractCanonicalUrl(document, href);
  const title = extractTitle(document);
  const price = extractPrice(document);

  if (!title) {
    throw new Error("Could not find the product title on this Amazon page.");
  }

  if (price === null) {
    throw new Error("Could not find a numeric product price on this Amazon page.");
  }

  return {
    source: "Amazon",
    vendor: "Amazon",
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
  return (
    document.querySelector("#productTitle")?.textContent?.trim() ||
    document
      .querySelector<HTMLMetaElement>('meta[property="og:title"]')
      ?.getAttribute("content")
      ?.trim() ||
    document.querySelector("h1")?.textContent?.trim() ||
    ""
  );
}

function extractPrice(document: Document): number | null {
  const metaCandidates = [
    document
      .querySelector<HTMLMetaElement>('meta[property="product:price:amount"]')
      ?.getAttribute("content"),
    document.querySelector<HTMLMetaElement>('meta[name="twitter:data1"]')?.getAttribute("content")
  ];

  for (const candidate of metaCandidates) {
    const parsed = parsePriceValue(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  const selectorCandidates = [
    "#corePrice_feature_div .a-price .a-offscreen",
    "#corePriceDisplay_desktop_feature_div .a-price .a-offscreen",
    "#corePrice_desktop .a-price .a-offscreen",
    "#apex_desktop .a-price .a-offscreen",
    "#price_inside_buybox",
    "#priceblock_ourprice",
    "#priceblock_dealprice",
    "#priceblock_saleprice"
  ];

  for (const selector of selectorCandidates) {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
    for (const element of elements) {
      const parsed = parsePriceValue(element.textContent);
      if (parsed !== null) {
        return parsed;
      }
    }
  }

  const blockSelectors = [
    "#corePrice_feature_div",
    "#corePriceDisplay_desktop_feature_div",
    "#apex_desktop",
    "#ppd",
    "#centerCol"
  ];

  for (const selector of blockSelectors) {
    const price = extractBestPriceFromText(document.querySelector(selector)?.textContent ?? "");
    if (price !== null) {
      return price;
    }
  }

  return null;
}

