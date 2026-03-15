type ScrapedProduct = {
  source: "B&H" | "Amazon";
  vendor: "B&H" | "Amazon";
  title: string;
  price: number;
  url: string;
};

type ScrapeActiveProductMessage = {
  type: "SCRAPE_ACTIVE_PRODUCT";
};

type ScrapeActiveProductResponse =
  | {
      ok: true;
      product: ScrapedProduct;
    }
  | {
      ok: false;
      error: string;
    };

const BH_PRODUCT_PATH_RE = /^\/c\/product\//;
const AMAZON_PRODUCT_PATH_RE = /\/(?:gp\/product|dp)\//;
const BH_TITLE_BRANDING_RE = /\s*[-|]\s*B&H Photo(?: Video)?\s*$/i;
const DISPLAY_PRICE_RE = /\$\s*\d[\d,]*(?:\.\d{2})?/g;

function scrapeBhProductDocument(document: Document, href: string): ScrapedProduct {
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
    source: "B&H",
    vendor: "B&H",
    title,
    price,
    url
  };
}

function isSupportedBhUrl(href: string): boolean {
  try {
    const url = new URL(href);
    return (
      (url.hostname === "www.bhphotovideo.com" || url.hostname === "bhphotovideo.com") &&
      BH_PRODUCT_PATH_RE.test(url.pathname)
    );
  } catch {
    return false;
  }
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

  return title.replace(BH_TITLE_BRANDING_RE, "").trim();
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

function scrapeAmazonProductDocument(document: Document, href: string): ScrapedProduct {
  if (!isSupportedAmazonUrl(href)) {
    throw new Error("Open an Amazon product page to capture an item.");
  }

  const url = extractCanonicalUrl(document, href);
  const title = extractAmazonTitle(document);
  const price = extractAmazonPrice(document);

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

function isSupportedAmazonUrl(href: string): boolean {
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

function extractAmazonTitle(document: Document): string {
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

function extractAmazonPrice(document: Document): number | null {
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

function normalizeCanonicalUrl(href: string): string {
  const url = new URL(href);
  url.search = "";
  url.hash = "";
  return url.toString();
}

function parsePriceValue(value: string | number | null | undefined): number | null {
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

function extractBestPriceFromText(text: string): number | null {
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

chrome.runtime.onMessage.addListener(
  (
    message: ScrapeActiveProductMessage,
    _sender,
    sendResponse: (response: ScrapeActiveProductResponse) => void
  ) => {
    if (message.type !== "SCRAPE_ACTIVE_PRODUCT") {
      return undefined;
    }

    try {
      const product = scrapeSupportedProductDocument(document, window.location.href);
      sendResponse({ ok: true, product });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Unable to capture this B&H page."
      });
    }

    return false;
  }
);

function scrapeSupportedProductDocument(document: Document, href: string): ScrapedProduct {
  if (isSupportedBhUrl(href)) {
    return scrapeBhProductDocument(document, href);
  }

  if (isSupportedAmazonUrl(href)) {
    return scrapeAmazonProductDocument(document, href);
  }

  throw new Error("Open a supported product page on B&H or Amazon.");
}
