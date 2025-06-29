'use server';

import { revalidatePath } from 'next/cache';
import ProductModel from '../models/product.model';
import { connectToDB } from '../mongoose';
import { scrapeFlipProduct } from '../scraper';
import { getAveragePrice, getHighestPrice, getLowestPrice } from '../utils';
import { generateEmailBody, sendEmail } from '../nodemailer';
import { User, Product } from '@/types';
import { Types } from 'mongoose';

export async function scrapeAndScoreProductFlip(productUrl: string) {
  if (!productUrl) return;

  try {
    await connectToDB();

    const scrapedProduct = await scrapeFlipProduct(productUrl);

    if (!scrapedProduct) return;

    let product = scrapedProduct;

    const existingProduct = await ProductModel.findOne({ url: scrapedProduct.url });

    if (existingProduct) {
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
    }

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
  } catch (error: any) {
    throw new Error(`Failed to create/update product: ${error.message}`);
  }
}

export async function getProductById(productId: string): Promise<Product | null> {
  try {
    await connectToDB();

    const product = await ProductModel.findOne({ _id: productId }).lean();

    if (!product) return null;

    // Convert to proper Product type
    return {
      ...product,
      _id: product._id?.toString(), // Convert ObjectId to string
    } as Product;
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

    // Convert to proper Product type
    return products.map(product => ({
      ...product,
      _id: product._id?.toString(), // Convert ObjectId to string
    })) as Product[];
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

    // Convert to proper Product type
    return similarProducts.map(product => ({
      ...product,
      _id: product._id?.toString(), // Convert ObjectId to string
    })) as Product[];
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
    const product = await ProductModel.findById(productId);

    if (!product) return;

    const userExists = product.trackingUsers.some(
      (user) => user.email === userEmail
    );

    if (!userExists) {
      product.trackingUsers.push({ 
        userId: new Types.ObjectId(), // Generate a new ObjectId for userId
        email: userEmail,
        addedAt: new Date(),
        alertSettings: {
          priceDecrease: true,
          priceIncrease: false,
          backInStock: true,
          threshold: undefined
        }
      });

      await product.save();

      const emailContent = await generateEmailBody(product, 'WELCOME');

      await sendEmail(emailContent, [userEmail]);
    }
  } catch (error) {
    console.log(error);
  }
}
