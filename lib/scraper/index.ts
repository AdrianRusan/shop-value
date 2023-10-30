import axios from 'axios';
import * as cheerio from 'cheerio';
import { extractPricesFlip, formatDescriptionFlip } from '../utils';

export async function scrapeFlipProduct(url: string) {
  if (!url) return;

  // BrightData proxy configuration
  const username = String(process.env.BRIGHTDATA_USERNAME);
  const password = String(process.env.BRIGHTDATA_PASSWORD);
  ``;
  const port = 22225;
  ``;
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
    const response = await axios.get(url, options);
    const $ = cheerio.load(response.data);

    let source = 'flip';
    let sourceSrc = '';

    const phoneTitle = $('.phone-title.new-phone-title');
    const lastTwoSpans = phoneTitle.find('span').slice(-2);
    const textContent = phoneTitle
      .contents()
      .filter(function () {
        return this.nodeType === 3; // Filter text nodes
      })
      .text()
      .trim();

    const title = textContent + ' ' + lastTwoSpans.text();

    const outOfStockElement = $(
      'span.badge.stoc-alert-new.py-2.mb-3.badge-secondary'
    );
    const outOfStockText = outOfStockElement.text().trim().toLowerCase();

    const isoutOfStock = outOfStockText === 'va reveni curand in stoc';

    const { originalPrice, currentPrice } = extractPricesFlip($);

    const image = $('.slider-image-container img').attr('src');
    const currency = $('.product-new-price').text().trim().slice(-3);
    const discountRate = $('p.product-this-deal')
      .text()
      .trim()
      .slice(-3)
      .replace(/[-%]/g, '');

    const description = formatDescriptionFlip($);

    const recommendedScraped = $('.positive-reviews').text().trim();
    const recommendedProduct = recommendedScraped.slice(
      0,
      Math.ceil(recommendedScraped.length / 2)
    );

    const stars =
      Number(
        $('.font-semibold.ml-1.rating-number')
          .text()
          .trim()
          .replace(/\D/g, '')
          .slice(-2)
      ) / 10;

    let reviewsScrapped = $('.general-opinion')
      .text()
      .trim()
      .replace(/\D/g, '');
    let reviewsCount = Number(
      reviewsScrapped.slice(0, Math.ceil(reviewsScrapped.length / 2))
    );

    const category = $('.route.content a:nth-child(1)').text().trim();
    const brand = $('.route.content a:nth-child(2)')
      .text()
      .trim()
      .toLowerCase();
    const model = $('.route.content a:nth-child(3)').text().trim();

    // Construct data object with scraped information
    const data = {
      url,
      source: source || 'unknown',
      sourceSrc: sourceSrc || '',
      currency: currency || 'RON',
      image: image || '',
      title,
      currentPrice: Number(currentPrice) || 0,
      originalPrice: Number(originalPrice) || 0,
      priceHistory: [],
      discountRate: Number(discountRate) || 0,
      category: category || '',
      brand: brand || '',
      model: model || '',
      reviewsCount: reviewsCount || 0,
      stars: stars || 0,
      isOutOfStock: isoutOfStock,
      description: description || '',
      recommendedProduct: recommendedProduct || '',
      lowestPrice: Number(currentPrice) || 0,
      highestPrice: Number(currentPrice) || 0,
      averagePrice: Number(currentPrice) || 0,
    };

    return data;
  } catch (error: any) {
    throw new Error(`Failed to scrape product: ${error.message}`);
  }
}
