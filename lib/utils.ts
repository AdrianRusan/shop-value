import { PriceHistoryItem, Product } from '@/types';

const Notification = {
  WELCOME: 'WELCOME',
  CHANGE_OF_STOCK: 'CHANGE_OF_STOCK',
  LOWEST_PRICE: 'LOWEST_PRICE',
  THRESHOLD_MET: 'THRESHOLD_MET',
};

const THRESHOLD_PERCENTAGE = 10;

export function extractPricesFlip($: any) {
  let originalPrice = $('.previous-price.position-relative')
    .text()
    .trim()
    .replace(/\D/g, '');

  let currentPrice = $('.final-price.new-design-final-price')
    .text()
    .trim()
    .replace(/\D/g, '');

  return {
    originalPrice: Number(originalPrice) / 100 || 0,
    currentPrice: Number(currentPrice) / 100 || 0,
  };
}

export function formatDescriptionFlip($: any): string {
  const descriptionContainer = $('#modelDescription');

  let description = '';

  const children = descriptionContainer.children().children();

  // Exclude the last child element
  for (let index = 0; index < children.length - 1; index++) {
    const element = children[index];
    const elementText = $(element).text().trim();
    if (elementText) {
      description += elementText + '\n';
    }
  }

  description = description.trim();

  return description;
}

export function getHighestPrice(
  priceList: PriceHistoryItem[],
  originalPrice: number
) {
  let highestPriceItem: PriceHistoryItem = {
    date: new Date(),
    price: originalPrice,
  };

  for (const item of priceList) {
    if (item.price > highestPriceItem.price) {
      highestPriceItem = { date: item.date, price: item.price };
    }
  }

  return highestPriceItem;
}

export function getLowestPrice(priceList: PriceHistoryItem[]) {
  let lowestPriceItem: PriceHistoryItem | null = null;

  for (const item of priceList) {
    if (
      item.price !== 0 &&
      (!lowestPriceItem || item.price < lowestPriceItem.price)
    ) {
      lowestPriceItem = { date: item.date, price: item.price };
    }
  }

  return lowestPriceItem || { date: new Date(), price: 0 };
}

export function getAveragePrice(
  priceList: PriceHistoryItem[],
  originalPrice: number
) {
  // Create a new array with originalPrice included if it's greater than zero
  const pricesWithOriginal =
    originalPrice > 0
      ? [...priceList, { date: new Date(), price: originalPrice }]
      : priceList;

  const nonZeroPrices = pricesWithOriginal.filter((item) => item.price !== 0);

  // Check if there are non-zero prices
  if (nonZeroPrices.length === 0) {
    return originalPrice;
  }

  const sumOfPrices = nonZeroPrices.reduce((acc, curr) => acc + curr.price, 0);
  const averagePrice = sumOfPrices / nonZeroPrices.length;

  return averagePrice;
}

export const getEmailNotifType = (
  scrapedProduct: Product,
  currentProduct: Product
) => {
  const lowestPrice = getLowestPrice(currentProduct.priceHistory).price;

  if (scrapedProduct.currentPrice < lowestPrice) {
    return Notification.LOWEST_PRICE as keyof typeof Notification;
  }
  if (!scrapedProduct.isOutOfStock && currentProduct.isOutOfStock) {
    return Notification.CHANGE_OF_STOCK as keyof typeof Notification;
  }
  if (scrapedProduct.discountRate >= THRESHOLD_PERCENTAGE) {
    return Notification.THRESHOLD_MET as keyof typeof Notification;
  }

  return null;
};
