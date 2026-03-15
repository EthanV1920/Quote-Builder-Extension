import { scrapeAmazonProductDocument, isSupportedAmazonUrl } from "./amazon-scraper";
import { scrapeBhProductDocument, isSupportedBhUrl } from "./bh-scraper";
import type { ScrapedProduct } from "./types";

export function isSupportedProductUrl(href: string): boolean {
  return isSupportedBhUrl(href) || isSupportedAmazonUrl(href);
}

export function scrapeSupportedProductDocument(document: Document, href: string): ScrapedProduct {
  if (isSupportedBhUrl(href)) {
    return scrapeBhProductDocument(document, href);
  }

  if (isSupportedAmazonUrl(href)) {
    return scrapeAmazonProductDocument(document, href);
  }

  throw new Error("Open a supported product page on B&H or Amazon.");
}

