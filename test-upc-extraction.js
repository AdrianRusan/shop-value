const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config({ path: '.env.local' });

(async () => {
  try {
    const config = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      proxy: {
        host: 'brd.superproxy.io',
        port: 22225,
        auth: {
          username: process.env.BRIGHTDATA_USERNAME,
          password: process.env.BRIGHTDATA_PASSWORD
        },
        protocol: 'http'
      },
      timeout: 20000
    };

    console.log('[Test] Fetching Amazon product B09JQMJHXY...');
    const response = await axios.get('https://www.amazon.com/dp/B09JQMJHXY', config);
    const $ = cheerio.load(response.data);

    console.log('[Test] Page loaded, searching for UPC...\n');

    // Method 1: Look for UPC in table rows
    let upc = null;
    $('tr').each((i, row) => {
      const label = $(row).find('th').text().trim();
      const value = $(row).find('td').text().trim();
      if (label && (label.includes('UPC') || label.includes('EAN') || label.includes('Barcode'))) {
        console.log(`Found in table: ${label} = ${value}`);
        if (!upc) upc = value;
      }
    });

    // Method 2: Look in Product Information section
    $('#detailBullets_feature_div li').each((i, li) => {
      const text = $(li).text();
      if (text.includes('UPC') || text.includes('EAN')) {
        const match = text.match(/(?:UPC|EAN)[:\s]+([0-9\s]+)/i);
        if (match) {
          console.log(`Found in bullets: ${match[0]}`);
          if (!upc) upc = match[1].replace(/\s/g, '');
        }
      }
    });

    // Method 3: Look in detailed specs
    $('#productDetails_techSpec_section_1 tr, #productDetails_detailBullets_sections1 tr').each((i, row) => {
      const label = $(row).find('th').text().trim();
      const value = $(row).find('td').text().trim();
      if (label && (label.toLowerCase().includes('upc') || label.toLowerCase().includes('ean'))) {
        console.log(`Found in specs: ${label} = ${value}`);
        if (!upc) upc = value;
      }
    });

    console.log('\n=== RESULT ===');
    console.log('UPC:', upc || 'NOT FOUND');

    if (upc) {
      console.log('\n[Test] Now testing Walmart search with UPC:', upc);
      const walmartUrl = `https://www.walmart.com/search?q=${encodeURIComponent(upc)}`;
      console.log('Walmart URL:', walmartUrl);

      console.log('\n[Test] Testing Target search with UPC:', upc);
      const targetUrl = `https://www.target.com/s?searchTerm=${encodeURIComponent(upc)}`;
      console.log('Target URL:', targetUrl);
    }

  } catch (error) {
    console.error('[Test] Error:', error.message);
  }
})();
