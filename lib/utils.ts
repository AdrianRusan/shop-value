import { PriceHistoryItem, Product } from '@/types';

const Notification = {
  WELCOME: 'WELCOME',
  CHANGE_OF_STOCK: 'CHANGE_OF_STOCK',
  LOWEST_PRICE: 'LOWEST_PRICE',
  THRESHOLD_MET: 'THRESHOLD_MET',
};

const THRESHOLD_PERCENTAGE = 10;

export function extractPricesEmag($: any) {
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

export function formatDescriptionEmag($: any): string {
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
