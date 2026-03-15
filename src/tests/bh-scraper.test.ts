import { JSDOM } from "jsdom";
import { scrapeBhProductDocument } from "../shared/bh-scraper";

describe("B&H scraper", () => {
  it("captures title, price, and canonical URL", () => {
    const dom = new JSDOM(
      `<!doctype html>
      <html>
        <head>
          <link rel="canonical" href="https://www.bhphotovideo.com/c/product/1065514-REG/demo_product.html?query=yes" />
          <meta property="product:price:amount" content="295.00" />
        </head>
        <body>
          <h1>Demo Product | B&H Photo</h1>
        </body>
      </html>`,
      {
        url: "https://www.bhphotovideo.com/c/product/1065514-REG/demo_product.html?sts=pi"
      }
    );

    expect(scrapeBhProductDocument(dom.window.document, dom.window.location.href)).toEqual({
      vendor: "B&H",
      title: "Demo Product",
      price: 295,
      url: "https://www.bhphotovideo.com/c/product/1065514-REG/demo_product.html"
    });
  });

  it("fails cleanly when no numeric price is present", () => {
    const dom = new JSDOM(
      `<!doctype html>
      <html>
        <head></head>
        <body>
          <h1>Demo Product</h1>
          <div data-selenium="pricingPrice">Call for price</div>
        </body>
      </html>`,
      {
        url: "https://www.bhphotovideo.com/c/product/1065514-REG/demo_product.html"
      }
    );

    expect(() => scrapeBhProductDocument(dom.window.document, dom.window.location.href)).toThrow(
      "Could not find a numeric product price on this B&H page."
    );
  });
});

