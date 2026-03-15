import { JSDOM } from "jsdom";
import { scrapeAmazonProductDocument } from "../shared/amazon-scraper";

describe("Amazon scraper", () => {
  it("captures title, price, and canonical URL", () => {
    const dom = new JSDOM(
      `<!doctype html>
      <html>
        <head>
          <link rel="canonical" href="https://www.amazon.com/Demo-Product/dp/B012345678?psc=1" />
        </head>
        <body>
          <span id="productTitle">Demo Amazon Product</span>
          <div id="corePrice_feature_div">
            <span class="a-price"><span class="a-offscreen">$129.99</span></span>
          </div>
        </body>
      </html>`,
      {
        url: "https://www.amazon.com/Demo-Product/dp/B012345678/ref=abc"
      }
    );

    expect(scrapeAmazonProductDocument(dom.window.document, dom.window.location.href)).toEqual({
      source: "Amazon",
      vendor: "Amazon",
      title: "Demo Amazon Product",
      price: 129.99,
      url: "https://www.amazon.com/Demo-Product/dp/B012345678"
    });
  });

  it("fails cleanly when no numeric price is present", () => {
    const dom = new JSDOM(
      `<!doctype html>
      <html>
        <body>
          <span id="productTitle">Demo Amazon Product</span>
          <div id="corePrice_feature_div">Currently unavailable</div>
        </body>
      </html>`,
      {
        url: "https://www.amazon.com/Demo-Product/dp/B012345678"
      }
    );

    expect(() => scrapeAmazonProductDocument(dom.window.document, dom.window.location.href)).toThrow(
      "Could not find a numeric product price on this Amazon page."
    );
  });
});
