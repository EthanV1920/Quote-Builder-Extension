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
        mapping: { title: "Title", price: "Price", url: "URL" },
        isDefault: false
      },
      {
        id: "two",
        label: "Two",
        spreadsheetId: "sheet-2",
        sheetTabName: "Quotes",
        mapping: { title: "Title", price: "Price", url: "URL" },
        isDefault: false
      }
    ]);

    expect(destinations.filter((destination) => destination.isDefault)).toHaveLength(1);
    expect(destinations[0].isDefault).toBe(true);
  });

  it("requires the standard title, price, and URL mappings", () => {
    expect(
      validateDestination({
        id: "dest",
        label: "Quotes",
        spreadsheetId: "sheet-id",
        sheetTabName: "Quotes",
        mapping: { title: "Title" },
        isDefault: true
      })
    ).toContain("Price column header is required.");
  });
});

