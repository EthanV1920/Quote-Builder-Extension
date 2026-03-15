export const FIELD_KEYS = [
  "vendor",
  "title",
  "price",
  "url",
  "timestamp",
  "quantity",
  "notes"
] as const;

export type FieldKey = (typeof FIELD_KEYS)[number];

export type HeaderMapping = Partial<Record<FieldKey, string>>;

export type DestinationConfig = {
  id: string;
  label: string;
  spreadsheetId: string;
  sheetTabName: string;
  mapping: HeaderMapping;
  isDefault: boolean;
};

export type AppConfig = {
  appsScriptUrl: string;
  sharedSecret: string;
  destinations: DestinationConfig[];
};

export type ScrapedProduct = {
  vendor: "B&H";
  title: string;
  price: number;
  url: string;
};

export type SaveQuoteRequest = {
  destination: {
    spreadsheetId: string;
    sheetTabName: string;
    mapping: HeaderMapping;
  };
  item: {
    vendor: "B&H";
    title: string;
    price: number;
    url: string;
    timestamp: string;
    quantity: number;
    notes: string;
  };
};

export type SaveQuoteResponse =
  | {
      ok: true;
      rowNumber: number;
    }
  | {
      ok: false;
      error: string;
      details?: string[];
    };

export type ScrapeActiveProductMessage = {
  type: "SCRAPE_ACTIVE_PRODUCT";
};

export type ScrapeActiveProductResponse =
  | {
      ok: true;
      product: ScrapedProduct;
    }
  | {
      ok: false;
      error: string;
    };

export type SaveQuoteMessage = {
  type: "SAVE_QUOTE";
  payload: SaveQuoteRequest;
};

