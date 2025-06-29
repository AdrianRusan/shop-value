import axios from 'axios';
import * as cheerio from 'cheerio';

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

    // Extract breadcrumbs
    const breadcrumbs: string[] = [];
    $('.flex.flex-row.mt-4.w-full span, .flex.flex-row.mt-4.w-full div').each(
      (i, el) => {
        const crumb = $(el).text().trim();
        if (!crumb.includes('/')) {
          breadcrumbs.push(crumb);
        }
      }
    );

    // Extract product name and variant details
    const productName = $('#pdp-title .leading-3.font-semibold').text().trim();
    const variantDetails = $('#pdp-title .tablet2\\:text-gray-dark')
      .text()
      .trim();

    const title = productName + ', ' + variantDetails;

    // console.log('title', title);
    // console.log('productName', productName);
    // console.log('variantDetails', variantDetails);

    // Extract benefits (Revised)
    const benefits: string[] = [];
    $('.tablet2\\:bg-\\[transparent\\] .flex.items-center.gap-2').each(
      (i, el) => {
        const benefit = $(el).find('div').last().text().trim();
        if (benefit) benefits.push(benefit);
      }
    );

    // Helper function to extract numeric value and treat the last two digits as decimals
    const extractNumericPrice = (priceText: string): number => {
      // Remove all non-numeric characters (including dots/commas)
      const numericPrice = priceText.replace(/[^\d]/g, '');

      // Parse the remaining numeric part
      const priceWithoutDecimal = parseInt(numericPrice, 10);

      // Convert to float by treating the last two digits as decimals
      return priceWithoutDecimal / 100;
    };

    // Extract price details (Handle duplicates by choosing first valid)
    const originalPriceText = $('#pdp-price-new-value').first().text().trim(); // First occurrence
    const currentPriceText = $('#pdp-price-value').first().text().trim(); // First occurrence
    const discountText = $('#pdp-price-save-value').first().text().trim(); // First occurrence

    // Use helper function to extract and format the numeric prices
    const originalPrice = extractNumericPrice(originalPriceText);
    const currentPrice = extractNumericPrice(currentPriceText);
    const discountRate = extractNumericPrice(discountText) * 100; // If you want to format the discount value too

    // Extract rating and review count (Handle empty case)
    const stars = $('.text-sm.text-gray-charcoal.font-semibold')
      .first()
      .text()
      .trim();
    // Extract review count from the specific container
    const reviewsCountText = $('div.flex.items-center.gap-x-1 p')
      .first()
      .text()
      .trim(); // Extract the review count text
    const reviewsCount = parseInt(reviewsCountText.replace(/[^\d]/g, ''), 10); // Remove any non-numeric characters and parse the number

    // Extract delivery information (Handle the case of multiple paragraphs or single)
    const deliveryInfo = $('#pdp-delivery p').first().text().trim();
    const deliveryPrice =
      $('#pdp-delivery p').eq(1).text().trim() !== deliveryInfo
        ? $('#pdp-delivery p').eq(1).text().trim()
        : 'Delivery price not available';

    // Extract additional features
    const additionalFeatures: string[] = [];
    $('#pdp-tests .flex-48\\.8').each((i, el) => {
      additionalFeatures.push($(el).find('p').text().trim());
    });

    // Extract colors and mark disabled ones
    const colors: {
      name: string;
      disabled: boolean;
      selected: boolean;
    }[] = [];
    $('[id^=pdp-color-button]').each((i, el) => {
      const colorName =
        $(el).find('div.text-[14px]').text().trim() ||
        $(el).find('img').attr('alt')?.trim() ||
        '';

      // Check if the color is disabled (via opacity or specific class)
      const isDisabled =
        $(el).find('img').hasClass('opacity-70') ||
        $(el).hasClass('disabledColorButton');

      // Check if this color option is selected
      const isSelected =
        $(el).hasClass('border-blue') || $(el).hasClass('bg-blue-background'); // Assuming selected color has these classes

      if (colorName) {
        colors.push({
          name: colorName,
          disabled: isDisabled,
          selected: isSelected, // Mark if this is the selected color
        });
      }
    });

    const storageOptions: {
      storage: string;
      disabled: boolean;
      selected: boolean;
    }[] = [];
    $('[id^=pdp-storage-button]').each((i, el) => {
      const storageText = $(el).find('span').first().text().trim(); // Get storage size text
      const isDisabled =
        $(el).find('span').hasClass('line-through') ||
        $(el).find('span').hasClass('text-gray-placeholder') ||
        $(el).hasClass('border-gray-placeholder');
      const isSelected = $(el).find('img[src*="checked"]').length > 0; // Check if this option is selected
      if (storageText) {
        storageOptions.push({
          storage: storageText,
          disabled: isDisabled,
          selected: isSelected, // Mark if this is the selected storage option
        });
      }
    });

    // Extract conditions
    const conditions: {
      condition: string;
      disabled: boolean;
      selected: boolean;
    }[] = [];
    $('[id^=pdp-shape-button]').each((i, el) => {
      const conditionText = $(el).find('span').first().text().trim(); // Get condition text
      const isDisabled =
        $(el).find('span').hasClass('line-through') ||
        $(el).find('span').hasClass('text-gray-placeholder') ||
        $(el).hasClass('border-gray-placeholder');
      const isSelected = $(el).find('img[src*="checked"]').length > 0; // Check if this option is selected
      if (conditionText) {
        conditions.push({
          condition: conditionText,
          disabled: isDisabled,
          selected: isSelected, // Mark if this is the selected condition option
        });
      }
    });

    // Extract the description
    const descriptionSection = $('#pdp-description').find('div > div').html(); // Extract inner HTML of the description container

    // Process the extracted HTML to ensure it is well formatted
    let formattedDescription = descriptionSection
      ? descriptionSection
          .replace(/<h2>/g, '\n\n### ') // Convert h2 tags to headings with markdown-style
          .replace(/<\/h2>/g, '\n')
          .replace(/<ul[^>]*>/g, '\n') // Handle start of lists
          .replace(/<\/ul>/g, '\n') // Handle end of lists
          .replace(/<li[^>]*>/g, '\n- ') // Convert list items to markdown-style lists
          .replace(/<\/li>/g, '') // Remove closing list tags
          .replace(/<p[^>]*>/g, '\n') // Convert paragraphs
          .replace(/<\/p>/g, '\n') // Remove closing p tags
          .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
          .replace(/<[^>]+>/g, '') // Remove any other remaining HTML tags
      : 'No description found';

    // Trim any excessive new lines
    formattedDescription = formattedDescription.trim();

    const images: { src: string; alt: string; isMain: boolean }[] = [];

    // Iterate over the buttons that contain images
    $('button img').each((i, el) => {
      const imgSrc = $(el).attr('src') || ''; // Get the src attribute of each img
      const imgAlt = $(el).attr('alt') || ''; // Get the alt attribute of each img

      // Find the parent button and check if it has the 'outline-blue' class (indicating the main image)
      const parentButton = $(el).closest('button');
      const isMain = parentButton.hasClass('outline-blue'); // Check if it's the main image

      if (imgSrc) {
        // Push each image with the src, alt, and whether it's the main image
        images.push({
          src: imgSrc,
          alt: imgAlt,
          isMain: isMain, // Mark if it's the main image
        });
      }
    });

    // // Log or use the images array with main image information
    // console.log('Images:', images);

    // Optional: You can also filter to get only the main image like this
    const mainImage = images.find((image) => image.isMain) || null;
    // console.log('Main Image:', mainImage);

    // // Log the extracted data
    // console.log(
    //   'Breadcrumbs:',
    //   breadcrumbs.filter((crumb) => !crumb.includes('/'))
    // );

    // console.log('Product Name:', productName);
    // console.log('Variant Details:', variantDetails);
    // console.log('Benefits:', benefits.length ? benefits : 'No benefits found');
    // console.log('Original Price:', originalPrice);
    // console.log('Current Price:', currentPrice);
    // console.log('Discount:', discountRate);
    // console.log('Rating:', stars);
    // console.log('Review Count:', reviewsCount);
    // console.log('Delivery Info:', deliveryInfo);
    // console.log('Delivery Price:', deliveryPrice);
    // console.log(
    //   'Available Colors:',
    //   colors.length ? colors : 'No colors available'
    // );
    // console.log(
    //   'Available Storage Options:',
    //   storageOptions.length ? storageOptions : 'No storage options available'
    // );
    // console.log(
    //   'Available Conditions:',
    //   conditions.length ? conditions : 'No condition options available'
    // );

    const outOfStockElement = $(
      'span.badge.stoc-alert-new.py-2.mb-3.badge-secondary'
    );
    const outOfStockText = outOfStockElement.text().trim().toLowerCase();

    const isoutOfStock = outOfStockText === 'va reveni curand in stoc';

    const category = breadcrumbs[0];
    const brand = breadcrumbs[1].toLowerCase().replace(/\s/g, '-');
    const model = breadcrumbs[2].toLowerCase().replace(/\s/g, '-');

    const data = {
      url,
      source: source || 'unknown',
      currency: 'RON',
      image: mainImage?.src || '',
      title,
      currentPrice: Number(currentPrice.toFixed(2)) || 0,
      originalPrice: Number(originalPrice.toFixed(2)) || 0,
      priceHistory: [],
      discountRate: Number(discountRate) || 0,
      category: category || '',
      brand: brand || '',
      productModel: model || '',
      reviewsCount: reviewsCount || 0,
      stars: stars || 0,
      isOutOfStock: isoutOfStock,
      description: formattedDescription || '',
      lowestPrice: Number(currentPrice.toFixed(2)) || 0,
      highestPrice: Number(currentPrice.toFixed(2)) || 0,
      averagePrice: Number(currentPrice.toFixed(2)) || 0,
    };

    // console.log('data', data);

    return data;
  } catch (error: any) {
    throw new Error(`Failed to scrape product: ${error.message}`);
  }
}
