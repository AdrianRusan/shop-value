import axios from 'axios';
import * as cheerio from 'cheerio';

export async function scrapeEmagProduct(url: string) {
  if (!url) return;

  // BrightData proxy configuration
  const username = String(process.env.BRIGHTDATA_USERNAME);
  const password = String(process.env.BRIGHTDATA_PASSWORD);
  const port = 22225;
  const session_id = (1000000 * Math.random()) | 0;

  const options = {
    auth: {
      username: `${username}-session-${session_id}`,
      password: password,
    },
    host: 'brd.superproxy.io',
    port,
    rejectUnauthorized: false,
  };

  try {
    // Fetch the product page
    const response = await axios.get(url, options);
    const $ = cheerio.load(response.data);

    const title = $('.page-title').text().trim();
    const originalPriceString = $('.rrp-lp30d-content')
      .text()
      .trim()
      .replace(/\D/g, '');

    let originalPrice, currentPriceString, currentPrice;

    if (originalPriceString.length > 0) {
      originalPrice = originalPriceString.slice(
        0,
        originalPriceString.length / 2
      );
      currentPriceString = $('p.product-new-price.has-deal')
        .text()
        .trim()
        .replace(/\D/g, '');
    } else {
      (originalPrice = ''),
        (currentPriceString = $('.pricing-block')
          .text()
          .trim()
          .replace(/\D/g, ''));
    }

    currentPrice = currentPriceString.slice(0, currentPriceString.length / 2);

    const outOfStock =
      $('.stock-and-genius span.label').text().trim().toLowerCase() ===
      'stoc epuizat';

    const image = $('.thumbnail.product-gallery-image img').attr('src');
    const currency = $('.product-new-price').text().trim().slice(-3);
    const discountRate = $('p.product-this-deal')
      .text()
      .trim()
      .slice(-3)
      .replace(/[-%]/g, '');

    const description = $('#description-body').text().trim();

    // Construct data object with scraped information
    const data = {
      url,
      currency: currency || 'RON',
      image,
      title,
      currentPrice:
        (Number(currentPrice) / 100).toFixed(2) ||
        (Number(originalPrice) / 100).toFixed(2),
      originalPrice:
        (Number(originalPrice) / 100).toFixed(2) ||
        (Number(currentPrice) / 100).toFixed(2),
      priceHistory: [],
      discountRate: Number(discountRate),
      category: 'category', // TBD
      reviewsCount: 100, // TBD
      stars: 4.5, // TBD
      isOutOfStock: outOfStock,
      description,
      lowestPrice:
        (Number(currentPrice) / 100).toFixed(2) ||
        (Number(originalPrice) / 100).toFixed(2),
      highestPrice:
        (Number(originalPrice) / 100).toFixed(2) ||
        (Number(currentPrice) / 100).toFixed(2),
      averagePrice:
        (Number(currentPrice) / 100).toFixed(2) ||
        (Number(originalPrice) / 100).toFixed(2),
    };

    return data;
  } catch (error: any) {
    throw new Error(`Failed to scrape product: ${error.message}`);
  }
}
