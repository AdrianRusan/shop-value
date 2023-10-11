import axios from 'axios';
import * as cheerio from 'cheerio';
import { extractPrices } from '../utils';

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
    const { originalPrice, currentPrice } = extractPrices($);

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

    const recommendedScraped = $('.positive-reviews').text().trim();
    const recommendedProduct = recommendedScraped.slice(
      0,
      Math.ceil(recommendedScraped.length / 2)
    );

    const starsScraped = $('.rating-text').text().trim();
    const stars = Number(
      starsScraped.slice(0, Math.ceil(starsScraped.length / 2)).split(' ')[0]
    );

    const reviewsCount = Number(
      starsScraped
        .slice(0, Math.ceil(starsScraped.length / 2))
        .split('(')[1]
        .split(' ')[0]
    );

    const category = $('ol.breadcrumb li:nth-child(3)').text().trim();

    // Construct data object with scraped information
    const data = {
      url,
      currency: currency || 'RON',
      image: image || '',
      title,
      currentPrice: Number(currentPrice) / 100 || 0,
      originalPrice: Number(originalPrice) / 100 || 0,
      priceHistory: [],
      discountRate: Number(discountRate) || 0,
      category: category || '',
      reviewsCount: reviewsCount || 0,
      stars: stars || 0,
      isOutOfStock: outOfStock,
      description: description || '',
      recommendedProduct: recommendedProduct || '',
      lowestPrice: Number(currentPrice) / 100 || 0,
      highestPrice: Number(currentPrice) / 100 || 0,
      averagePrice: Number(currentPrice) / 100 || 0,
    };

    return data;
  } catch (error: any) {
    throw new Error(`Failed to scrape product: ${error.message}`);
  }
}
