import { buildSaveQuoteRequest } from "../shared/save-payload";

describe("save payload builder", () => {
  it("includes quantity and notes in the payload", () => {
    const payload = buildSaveQuoteRequest({
      destination: {
        id: "dest",
        label: "Main",
        spreadsheetId: "sheet-id",
        sheetTabName: "Quotes",
        mapping: {
          title: "Title",
          price: "Price",
          url: "URL"
        },
        isDefault: true
      },
      product: {
        vendor: "B&H",
        title: "Sony Camera",
        price: 1999,
        url: "https://www.bhphotovideo.com/c/product/1234-REG/sony_camera.html"
      },
      quantity: 3,
      notes: "Interview kit"
    });

    expect(payload.item.quantity).toBe(3);
    expect(payload.item.notes).toBe("Interview kit");
    expect(payload.destination.mapping.title).toBe("Title");
  });
});

