import axios from 'axios';
import * as cheerio from 'cheerio';
import { extractPrice } from '../utils';

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

    // Extract the product title
    const title = $('.page-title').text().trim();
    const currentPriceString = $('p.product-new-price.has-deal')
      .text()
      .trim()
      .replace(/\D/g, '');

    const currentPrice = currentPriceString.slice(
      0,
      currentPriceString.length / 2
    );
    const originalPriceString = $('.rrp-lp30d-content')
      .text()
      .trim()
      .replace(/\D/g, '');

    const originalPrice = originalPriceString.slice(
      0,
      originalPriceString.length / 2
    );

    const outOfStock =
      $('.stock-and-genius span.label').text().trim().toLowerCase() ===
      'stoc epuizat';

    console.log({ title, currentPrice, originalPrice, outOfStock });
  } catch (error: any) {
    throw new Error(`Failed to scrape product: ${error.message}`);
  }
}
