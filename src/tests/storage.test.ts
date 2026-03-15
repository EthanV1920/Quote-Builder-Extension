import {
  normalizeDestinations,
  parseSpreadsheetId,
  validateDestination
} from "../shared/storage";

describe("storage helpers", () => {
  it("extracts a spreadsheet ID from a full URL", () => {
    expect(
      parseSpreadsheetId(
        "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890/edit#gid=0"
      )
    ).toBe("1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890");
  });

  it("ensures exactly one default destination", () => {
    const destinations = normalizeDestinations([
      {
        id: "one",
        label: "One",
        spreadsheetId: "sheet-1",
        sheetTabName: "Quotes",
        mapping: {
          title: { header: "Title", required: true },
          price: { header: "Price", required: true },
          url: { header: "URL", required: true }
        },
        isDefault: false
      },
      {
        id: "two",
        label: "Two",
        spreadsheetId: "sheet-2",
        sheetTabName: "Quotes",
        mapping: {
          title: { header: "Title", required: true },
          price: { header: "Price", required: true },
          url: { header: "URL", required: true }
        },
        isDefault: false
      }
    ]);

    expect(destinations.filter((destination) => destination.isDefault)).toHaveLength(1);
    expect(destinations[0].isDefault).toBe(true);
  });

  it("requires at least one mapped column", () => {
    expect(
      validateDestination({
        id: "dest",
        label: "Quotes",
        spreadsheetId: "sheet-id",
        sheetTabName: "Quotes",
        mapping: {},
        isDefault: true
      })
    ).toContain("Add at least one mapped column header.");
  });

  it("migrates legacy string mappings to field mapping objects", () => {
    const [destination] = normalizeDestinations([
      {
        id: "legacy",
        label: "Legacy",
        spreadsheetId: "sheet-id",
        sheetTabName: "Quotes",
        mapping: {
          title: "Title",
          timestamp: "Time"
        },
        isDefault: true
      } as never
    ]);

    expect(destination.mapping.title).toEqual({ header: "Title", required: true });
    expect(destination.mapping.timestamp).toEqual({ header: "Time", required: false });
  });
});
