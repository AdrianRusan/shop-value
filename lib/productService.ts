import Product from '@/lib/models/product.model';
import { scrapeFlipProduct } from '@/lib/scraper';
import { getLowestPrice, getHighestPrice, getAveragePrice } from '@/lib/utils';
import { PriceHistoryItem, Product as ProductType } from '@/types';

export async function fetchProducts() {
  try {
    const products = await Product.find({});
    if (!products.length) throw new Error('No products found');
    return products;
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
}

export async function updateProductDetails(currentProduct: ProductType) {
  try {
    const scrapedProduct =
      currentProduct.source === 'flip'
        ? await scrapeFlipProduct(currentProduct.url)
        : null;
    if (!scrapedProduct) return null;

    const updatedPriceHistory = [
      ...currentProduct.priceHistory,
      { price: scrapedProduct.currentPrice },
    ];

    const product = {
      ...scrapedProduct,
      priceHistory: updatedPriceHistory as PriceHistoryItem[],
      lowestPrice: getLowestPrice(updatedPriceHistory as PriceHistoryItem[])
        .price,
      highestPrice: getHighestPrice(
        updatedPriceHistory as PriceHistoryItem[],
        currentProduct.currentPrice
      ).price,
      averagePrice: getAveragePrice(
        updatedPriceHistory as PriceHistoryItem[],
        currentProduct.currentPrice
      ),
    };

    const updatedProduct = await Product.findOneAndUpdate(
      { url: product.url },
      product,
      { new: true }
    );
    return updatedProduct;
  } catch (error) {
    console.error('Error updating product details:', error);
    throw error;
  }
}
