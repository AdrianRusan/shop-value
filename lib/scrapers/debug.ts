import 'dotenv/config'; // Load .env variables
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';

/**
 * Debug Amazon scraping to see what we're actually getting back
 */
async function debugAmazonScraping(asin: string = 'B08N5WRWNW') {
  const url = `https://www.amazon.com/dp/${asin}`;

  console.log('='.repeat(80));
  console.log('AMAZON SCRAPING DEBUG');
  console.log('='.repeat(80));
  console.log(`Testing ASIN: ${asin}`);
  console.log(`URL: ${url}\n`);

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      },
      timeout: 15000
    });

    console.log('✅ HTTP REQUEST SUCCESSFUL\n');
    console.log('Response Details:');
    console.log(`  Status: ${response.status} ${response.statusText}`);
    console.log(`  Content-Type: ${response.headers['content-type']}`);
    console.log(`  Content-Length: ${response.data.length} bytes`);
    console.log('');

    // Save full HTML to file for inspection
    const htmlFile = `amazon_${asin}_debug.html`;
    fs.writeFileSync(htmlFile, response.data);
    console.log(`✅ Saved full HTML to: ${htmlFile}\n`);

    // Parse with Cheerio
    const $ = cheerio.load(response.data);

    console.log('-'.repeat(80));
    console.log('SELECTOR TESTS');
    console.log('-'.repeat(80));

    // Test title selectors
    console.log('\n1. Title Selectors:');
    const titleSelectors = ['#productTitle', 'h1.a-size-large', '#title'];
    titleSelectors.forEach(selector => {
      const text = $(selector).text().trim();
      console.log(`   ${selector}: ${text ? `"${text.substring(0, 60)}..."` : '❌ NOT FOUND'}`);
    });

    // Test price selectors
    console.log('\n2. Price Selectors:');
    const priceSelectors = [
      '.a-price-whole',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '.a-price .a-offscreen',
      '#price_inside_buybox'
    ];
    priceSelectors.forEach(selector => {
      const text = $(selector).text().trim();
      console.log(`   ${selector}: ${text || '❌ NOT FOUND'}`);
    });

    // Test availability
    console.log('\n3. Availability:');
    const availText = $('#availability span').text().trim();
    console.log(`   #availability span: ${availText || '❌ NOT FOUND'}`);

    // Test image
    console.log('\n4. Image Selectors:');
    const imgSelectors = ['#landingImage', '#imgBlkFront', '.a-dynamic-image'];
    imgSelectors.forEach(selector => {
      const src = $(selector).attr('src');
      console.log(`   ${selector}: ${src ? 'FOUND' : '❌ NOT FOUND'}`);
    });

    // Check for CAPTCHA
    console.log('\n5. Bot Detection Check:');
    const hasCaptcha = response.data.includes('captcha') || response.data.includes('Robot Check');
    const hasError503 = response.data.includes('503 Service Temporarily Unavailable');
    console.log(`   CAPTCHA detected: ${hasCaptcha ? '⚠️  YES - BOT DETECTED!' : '✅ No'}`);
    console.log(`   503 Error: ${hasError503 ? '⚠️  YES' : '✅ No'}`);

    // Show first 1000 chars of body
    console.log('\n' + '-'.repeat(80));
    console.log('HTML PREVIEW (first 1000 chars):');
    console.log('-'.repeat(80));
    console.log(response.data.substring(0, 1000));
    console.log('...');

  } catch (error: any) {
    console.log('❌ HTTP REQUEST FAILED\n');
    console.log('Error Details:');
    console.log(`  Message: ${error.message}`);
    console.log(`  Code: ${error.code}`);
    if (error.response) {
      console.log(`  Status: ${error.response.status}`);
      console.log(`  Status Text: ${error.response.statusText}`);
    }
  }

  console.log('\n' + '='.repeat(80));
}

// Run debug
const asin = process.argv[2] || 'B08N5WRWNW';
debugAmazonScraping(asin);
