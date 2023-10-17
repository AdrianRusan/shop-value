import { PriceHistoryItem, Product } from '@/types';

const Notification = {
  WELCOME: 'WELCOME',
  CHANGE_OF_STOCK: 'CHANGE_OF_STOCK',
  LOWEST_PRICE: 'LOWEST_PRICE',
  THRESHOLD_MET: 'THRESHOLD_MET',
};

const THRESHOLD_PERCENTAGE = 40;

export function extractPrices($: any) {
  let originalPriceString = $('p.rrp-lp30d span:nth-child(2)')
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
    (originalPrice = 0),
      (currentPriceString = $('.pricing-block p.product-new-price')
        .text()
        .trim()
        .replace(/\D/g, ''));
  }

  currentPrice = currentPriceString.slice(0, currentPriceString.length / 2);

  return {
    originalPrice: Number(originalPrice) / 100 || 0,
    currentPrice: Number(currentPrice) / 100 || 0,
  };
}

// Extracts and returns the price from a list of possible elements.
export function extractPrice(...elements: any) {
  for (const element of elements) {
    const priceText = element.text().trim();

    if (priceText) {
      const cleanPrice = priceText.replace(/[^\d.]/g, '');

      let firstPrice;

      if (cleanPrice) {
        firstPrice = cleanPrice.match(/\d+\.\d{2}/)?.[0];
      }

      return firstPrice || cleanPrice;
    }
  }

  return '';
}

// Extracts and returns the currency symbol from an element.
export function extractCurrency(element: any) {
  const currencyText = element.text().trim().slice(0, 1);
  return currencyText ? currencyText : '';
}

export function formatDescription($: any): string {
  const descriptionContainer = $('#description-body');

  let description = '';

  descriptionContainer.children().each((index: any, element: any) => {
    const elementType = element.name;
    if (elementType === 'ul') {
      description += `${$(element).text().trim()}\n`;

      const children = $(element).children();
      children.each((childIndex: any, childElement: any) => {
        const childType = childElement.name;
        if (childType === 'li') {
          description += ` - ${$(childElement).text().trim()}\n`;
        }
      });
    } else if (elementType === 'table') {
      const table = $(element);
      table.children().each((rowIndex: any, rowElement: any) => {
        const row = $(rowElement);
        row.children().each((colIndex: any, colElement: any) => {
          const column = $(colElement);
          column.children().each((cellIndex: any, cellElement: any) => {
            const cellType = cellElement.name;
            if (cellType === 'td') {
              description += `${$(cellElement).text().trim()}\n`;
            }
          });
        });
      });
    } else {
      description += `${$(element).text().trim()}\n`;
    }
  });

  description = description.trim();

  return description;
}

// Extracts description from two possible elements from amazon
export function extractDescription($: any) {
  // these are possible elements holding description of the product
  const selectors = [
    '.a-unordered-list .a-list-item',
    '.a-expander-content p',
    // Add more selectors here if needed
  ];

  for (const selector of selectors) {
    const elements = $(selector);
    if (elements.length > 0) {
      const textContent = elements
        .map((_: any, element: any) => $(element).text().trim())
        .get()
        .join('\n');
      return textContent;
    }
  }

  // If no matching elements were found, return an empty string
  return '';
}

export function getHighestPrice(priceList: PriceHistoryItem[]) {
  let highestPrice = priceList[0];

  for (let i = 0; i < priceList.length; i++) {
    if (priceList[i].price > highestPrice.price) {
      highestPrice = priceList[i];
    }
  }

  return highestPrice.price;
}

export function getLowestPrice(priceList: PriceHistoryItem[]) {
  let lowestPrice = priceList[0];

  for (let i = 0; i < priceList.length; i++) {
    if (priceList[i].price < lowestPrice.price) {
      lowestPrice = priceList[i];
    }
  }

  return lowestPrice.price;
}

export function getAveragePrice(priceList: PriceHistoryItem[]) {
  const sumOfPrices = priceList.reduce((acc, curr) => acc + curr.price, 0);
  const averagePrice = sumOfPrices / priceList.length || 0;

  return averagePrice;
}

export const getEmailNotifType = (
  scrapedProduct: Product,
  currentProduct: Product
) => {
  const lowestPrice = getLowestPrice(currentProduct.priceHistory);

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

export const formatNumber = (num: number = 0) => {
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};
