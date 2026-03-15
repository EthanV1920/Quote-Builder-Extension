import { extractBestPriceFromText, normalizeCanonicalUrl, parsePriceValue } from "../shared/price";

describe("price helpers", () => {
  it("parses a plain USD amount", () => {
    expect(parsePriceValue("$295.00")).toBe(295);
  });

  it("ignores installment-only pricing text", () => {
    expect(extractBestPriceFromText("$50 /mo. for 12 months")).toBeNull();
  });

  it("strips query strings and hashes from canonical URLs", () => {
    expect(
      normalizeCanonicalUrl(
        "https://www.bhphotovideo.com/c/product/1234-REG/test.html?sts=pi&pim=Y#overview"
      )
    ).toBe("https://www.bhphotovideo.com/c/product/1234-REG/test.html");
  });
});

