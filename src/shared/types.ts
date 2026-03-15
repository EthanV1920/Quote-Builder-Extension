export const FIELD_KEYS = [
  "source",
  "vendor",
  "title",
  "price",
  "url",
  "timestamp",
  "quantity",
  "notes"
] as const;

export type FieldKey = (typeof FIELD_KEYS)[number];

export type FieldMapping = {
  header: string;
  required: boolean;
};

export type HeaderMapping = Partial<Record<FieldKey, FieldMapping>>;

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

export type ProductSource = "B&H" | "Amazon";

export type ScrapedProduct = {
  source: ProductSource;
  vendor: ProductSource;
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
    source: ProductSource;
    vendor: ProductSource;
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
