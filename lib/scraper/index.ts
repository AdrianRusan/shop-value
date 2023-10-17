import axios from 'axios';
import * as cheerio from 'cheerio';
import { extractPrices, formatDescription } from '../utils';

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

    // const title = $('.page-title').text().trim();

    const phoneTitle = $('.phone-title.new-phone-title');
    const lastTwoSpans = phoneTitle.find('span').slice(-2);
    const textContent = phoneTitle
      .contents()
      .filter(function () {
        return this.nodeType === 3; // Filter text nodes
      })
      .text()
      .trim();

    // Combine the text content and the text content of the last two spans into a single string
    const title = textContent + ' ' + lastTwoSpans.text();

    // const title = $('.phone-title.new-phone-title').text().trim();
    const { originalPrice, currentPrice } = extractPrices($);

    console.log('originalPrice', originalPrice);
    console.log('currentPrice', currentPrice);

    const outOfStock =
      $('.stock-and-genius span.label').text().trim().toLowerCase() ===
      'stoc epuizat';

    const image = $('.slider-image-container img').attr('src');
    const currency = $('.product-new-price').text().trim().slice(-3);
    const discountRate = $('p.product-this-deal')
      .text()
      .trim()
      .slice(-3)
      .replace(/[-%]/g, '');

    const descriptionElement = $('#modelDescription .content').html();

    const description = formatDescription($);

    console.log('description', description);

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
    let reviewsCount = reviewsScrapped.slice(
      0,
      Math.ceil(reviewsScrapped.length / 2)
    );

    console.log('reviewsCount', reviewsCount);

    // if (starsScraped.length > 0) {
    //   stars = Number(
    //     starsScraped.slice(0, Math.ceil(starsScraped.length / 2)).split(' ')[0]
    //   );

    //   reviewsCount = Number(
    //     starsScraped
    //       .slice(0, Math.ceil(starsScraped.length / 2))
    //       .split('(')[1]
    //       .split(' ')[0]
    //   );
    // }

    // const category = phoneTitle.find('span').slice(0, 1).text().trim();

    // Combine the text content and the text content of the last two spans into a single string
    // const category = $('ol.breadcrumb li:nth-child(3)').text().trim();
    const category = $('.route.content a:nth-child(1)').text().trim();
    const biggerCategory = $('ol.breadcrumb li:nth-child(2)').text().trim();

    // Construct data object with scraped information
    const data = {
      url,
      currency: currency || 'RON',
      image: image || '',
      title,
      currentPrice: Number(currentPrice) || 0,
      originalPrice: Number(originalPrice) || 0,
      priceHistory: [],
      discountRate: Number(discountRate) || 0,
      category: category || '',
      biggerCategory: biggerCategory || '',
      reviewsCount: reviewsCount || 0,
      stars: stars || 0,
      isOutOfStock: outOfStock,
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
