import type { DestinationConfig, SaveQuoteRequest, ScrapedProduct } from "./types";
import { getActiveHeaderMapping } from "./storage";

export function buildSaveQuoteRequest(args: {
  destination: DestinationConfig;
  product: ScrapedProduct;
  quantity: number;
  notes: string;
}): SaveQuoteRequest {
  return {
    destination: {
      spreadsheetId: args.destination.spreadsheetId,
      sheetTabName: args.destination.sheetTabName,
      mapping: getActiveHeaderMapping(args.destination.mapping)
    },
    item: {
      source: args.product.source,
      vendor: args.product.vendor,
      title: args.product.title,
      price: args.product.price,
      url: args.product.url,
      timestamp: new Date().toISOString(),
      quantity: args.quantity,
      notes: args.notes.trim()
    }
  };
}
