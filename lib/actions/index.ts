'use server';

import { revalidatePath } from 'next/cache';
import ProductModel from '../models/product.model';
import { connectToDB } from '../mongoose';
import { scrapeFlipProduct } from '../scraper';
import { queueProductScraping } from '../scraper/queue-service';
import { getAveragePrice, getHighestPrice, getLowestPrice } from '../utils';
import { emailService } from '../resend';
import { User, Product } from '@/types';
import { Types } from 'mongoose';

// Enhanced function that uses queue-based scraping by default
export async function scrapeAndScoreProductFlip(
  productUrl: string,
  options?: {
    userId?: string;
    userTier?: 'free' | 'pro' | 'enterprise';
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    immediate?: boolean; // For backward compatibility - forces direct scraping
  }
) {
  if (!productUrl) return;

  try {
    await connectToDB();

    // Check if product already exists
    let existingProduct = await ProductModel.findOne({ url: productUrl });
    
    // If product doesn't exist, create it first (backward compatibility)
    if (!existingProduct) {
      console.log(`📦 Product not found, creating new product for: ${productUrl}`);
      
      // First scrape to get basic product info for creation
      const scrapedProduct = await scrapeFlipProduct(productUrl);
      if (!scrapedProduct) {
        throw new Error('Failed to scrape initial product data');
      }

      // Create the product in the database
      existingProduct = await ProductModel.create({
        ...scrapedProduct,
        tenantId: 'default',
        trackingStatus: 'active',
        isActive: true,
      });

      console.log(`✅ New product created with ID: ${existingProduct._id}`);
    }

    const productId = existingProduct._id?.toString() || '';

    // Use queue-based scraping by default unless immediate is requested
    if (!options?.immediate) {
      const queueResult = await queueProductScraping(productId, productUrl, {
        userId: options?.userId || 'anonymous',
        userTier: options?.userTier || 'free',
        priority: options?.priority || 'medium',
        tenantId: existingProduct.tenantId || 'default',
      });

      if (queueResult.success) {
        console.log(`✅ Product ${productId} queued for scraping with job ID: ${queueResult.jobId}`);
        return {
          success: true,
          message: 'Product queued for scraping',
          jobId: queueResult.jobId,
          productId,
        };
      } else {
        console.warn(`⚠️ Failed to queue product ${productId}, falling back to direct scraping:`, queueResult.error);
        // Fall through to direct scraping
      }
    }

    // Direct scraping (fallback or when immediate is requested)
    console.log(`🔄 Performing direct scraping for product ${productId}`);
    const scrapedProduct = await scrapeFlipProduct(productUrl);

    if (!scrapedProduct) {
      throw new Error('Failed to scrape product data');
    }

    let product = scrapedProduct;

    const updatedPriceHistory: any = [
      ...existingProduct.priceHistory,
      { price: scrapedProduct.currentPrice },
    ];

    product = {
      ...scrapedProduct,
      priceHistory: updatedPriceHistory,
      lowestPrice: getLowestPrice(updatedPriceHistory).price,
      highestPrice: getHighestPrice(
        updatedPriceHistory,
        existingProduct.currentPrice
      ).price,
      averagePrice: getAveragePrice(
        updatedPriceHistory,
        existingProduct.currentPrice
      ),
    };

    const newProduct = await ProductModel.findOneAndUpdate(
      { url: scrapedProduct.url },
      product,
      { upsert: true, new: true }
    );

    revalidatePath(
      `/produse/${newProduct.brand}/${newProduct.productModel?.replace(/ /g, '-') || 'unknown'}/${
        newProduct._id
      }`
    );

    return {
      success: true,
      message: 'Product scraped and updated directly',
      productId: newProduct._id?.toString() || '',
      immediate: true,
    };

  } catch (error: any) {
    console.error('Error in scrapeAndScoreProductFlip:', error);
    throw new Error(`Failed to create/update product: ${error.message}`);
  }
}

// Queue-based product creation and scraping
export async function createAndQueueProduct(
  productUrl: string,
  options: {
    userId: string;
    userTier?: 'free' | 'pro' | 'enterprise';
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    tenantId?: string;
  }
) {
  if (!productUrl) {
    throw new Error('Product URL is required');
  }

  try {
    await connectToDB();

    // First scrape to get basic product info for creation
    const scrapedProduct = await scrapeFlipProduct(productUrl);
    if (!scrapedProduct) {
      throw new Error('Failed to scrape initial product data');
    }

    // Create product in database
    const newProduct = await ProductModel.create({
      ...scrapedProduct,
      tenantId: options.tenantId || 'default',
      trackingStatus: 'active',
      isActive: true,
    });

    // Queue for regular scraping updates
    const queueResult = await queueProductScraping(
      newProduct._id?.toString() || '',
      productUrl,
      {
        userId: options.userId,
        userTier: options.userTier || 'free',
        priority: options.priority || 'medium',
        tenantId: options.tenantId || 'default',
      }
    );

    revalidatePath(
      `/produse/${newProduct.brand}/${newProduct.productModel?.replace(/ /g, '-') || 'unknown'}/${
        newProduct._id
      }`
    );

    return {
      success: true,
      product: newProduct,
      queueResult,
    };

  } catch (error: any) {
    console.error('Error in createAndQueueProduct:', error);
    throw new Error(`Failed to create and queue product: ${error.message}`);
  }
}

export async function getProductById(productId: string): Promise<Product | null> {
  try {
    await connectToDB();

    const product = await ProductModel.findOne({ _id: productId }).lean();

    if (!product) return null;

    // Properly serialize the data to avoid Next.js warnings about toJSON methods
    return JSON.parse(JSON.stringify({
      ...product,
      _id: product._id?.toString(), // Convert ObjectId to string
    })) as Product;
  } catch (error) {
    console.log(error);
    return null;
  }
}

export async function getProductByTitle(productTitle: string) {
  try {
    await connectToDB();
    const searchRegex = new RegExp(productTitle, 'i');

    const products = await ProductModel.find({
      title: { $regex: searchRegex },
    })
      .select(
        'title image source category brand productModel isOutOfStock originalPrice currentPrice currency'
      )
      .lean()
      .limit(8);

    return JSON.parse(JSON.stringify(products));
  } catch (error) {
    console.log(error);
  }
}

export async function getProductByBrand(productBrand: string) {
  try {
    await connectToDB();
    const searchRegex = new RegExp(productBrand, 'i');

    const products = await ProductModel.find({
      brand: { $regex: searchRegex },
    })
      .select(
        'title image source category brand productModel isOutOfStock originalPrice currentPrice currency'
      )
      .lean();

    return JSON.parse(JSON.stringify(products));
  } catch (error) {
    console.log(error);
  }
}

export async function getProductByModel(productModel: string) {
  try {
    await connectToDB();

    // Split the productModel into individual words and create a regex to match any of them
    const searchTerms = productModel.split(' ');
    const searchRegex = new RegExp(searchTerms.join('|'), 'i');

    const products = await ProductModel.find({
      productModel: { $regex: searchRegex },
    })
      .select(
        'title image source category brand productModel isOutOfStock originalPrice currentPrice currency'
      )
      .lean();

    return JSON.parse(JSON.stringify(products));
  } catch (error) {
    console.log(error);
  }
}

export async function searchProducts(searchTerm: string) {
  try {
    await connectToDB();

    const searchTerms = searchTerm.split(' ');

    const brands = await ProductModel.distinct('brand', {
      brand: { $regex: new RegExp(searchTerms.join('|'), 'i') },
    });

    const orConditions = searchTerms.map((term) => ({
      productModel: { $regex: new RegExp(term, 'i') },
    }));

    const models = await ProductModel.find(
      {
        $or: orConditions,
      },
      'brand productModel -_id'
    ).limit(4);

    const brandModelObjects = models.map((product) => ({
      brand: product.brand,
      model: product.productModel,
    }));

    // Get the top 4 most searched products
    const topSearchedProducts = await ProductModel.find(
      {
        productModel: { $regex: new RegExp(searchTerms.join('|'), 'i') },
      },
      'productModel brand -_id'
    )
      .limit(4)
      .sort({ hits: -1 })
      .lean();

    // Include the searchTerm in the returned object
    return { searchTerm, brands, brandModelObjects, topSearchedProducts };
  } catch (error) {
    console.error('An error occurred:', error);
    throw error;
  }
}

export async function getAllProducts(): Promise<Product[]> {
  try {
    await connectToDB();

    const products = await ProductModel.find().lean();

    // Properly serialize the data to avoid Next.js warnings about toJSON methods
    return JSON.parse(JSON.stringify(products.map(product => ({
      ...product,
      _id: product._id?.toString(), // Convert ObjectId to string
    })))) as Product[];
  } catch (error) {
    console.log(error);
    return [];
  }
}

export async function getSimilarProducts(productId: string): Promise<Product[]> {
  try {
    await connectToDB();

    const currentProduct = await ProductModel.findById(productId);

    if (!currentProduct) return [];

    const similarProducts = await ProductModel.find({
      _id: { $ne: productId },
      brand: currentProduct.brand,
    }).limit(4).lean();

    // Properly serialize the data to avoid Next.js warnings about toJSON methods
    return JSON.parse(JSON.stringify(similarProducts.map(product => ({
      ...product,
      _id: product._id?.toString(), // Convert ObjectId to string
    })))) as Product[];
  } catch (error) {
    console.log(error);
    return [];
  }
}

export async function addUserEmailToProduct(
  productId: string,
  userEmail: string
) {
  try {
    // First check if the product exists and if user already tracks it
    const product = await ProductModel.findById(productId).lean();

    if (!product) return;

    const userExists = product.trackingUsers?.some(
      (user) => user.email === userEmail
    );

    if (!userExists) {
      // Use findByIdAndUpdate to only update the trackingUsers field
      // This avoids triggering validation on the entire document
      await ProductModel.findByIdAndUpdate(
        productId,
        {
          $push: {
            trackingUsers: {
              userId: new Types.ObjectId(), // Generate a new ObjectId for userId
              email: userEmail,
              addedAt: new Date(),
              alertSettings: {
                priceDecrease: true,
                priceIncrease: false,
                backInStock: true,
                threshold: undefined
              }
            }
          }
        },
        { new: true }
      );

      // Use new Resend email system
      try {
        const firstName = userEmail.split('@')[0]; // Extract name from email
        await emailService.sendWelcomeEmail({
          firstName,
          email: userEmail,
          dashboardUrl: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard`,
        });
        console.log('Welcome email sent successfully to:', userEmail);
      } catch (emailError) {
        // Log email error but don't fail the entire operation
        console.error('Failed to send welcome email:', emailError);
      }
    }
  } catch (error) {
    console.log(error);
  }
}
