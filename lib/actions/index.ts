'use server';

import { scrapeEmagProduct } from '../scrapper';

export async function scrapeAndScoreProduct(productUrl: string) {
  if (!productUrl) return;

  try {
    const scrappedProduct = await scrapeEmagProduct(productUrl);

    if (!scrappedProduct) return;
  } catch (error: any) {
    throw new Error(`Failed to create/update product: ${error.message}`);
  }
}
