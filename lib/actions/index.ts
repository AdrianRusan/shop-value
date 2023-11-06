'use server';

import { revalidatePath } from 'next/cache';
import Product from '../models/product.model';
import { connectToDB } from '../mongoose';
import { scrapeFlipProduct } from '../scraper';
import { getAveragePrice, getHighestPrice, getLowestPrice } from '../utils';
import { generateEmailBody, sendEmail } from '../nodemailer';
import { User } from '@/types';

export async function scrapeAndScoreProductFlip(productUrl: string) {
  if (!productUrl) return;

  try {
    connectToDB();

    const scrapedProduct = await scrapeFlipProduct(productUrl);

    if (!scrapedProduct) return;

    let product = scrapedProduct;

    const existingProduct = await Product.findOne({ url: scrapedProduct.url });

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
          existingProduct.originalPrice
        ).price,
        averagePrice: getAveragePrice(
          updatedPriceHistory,
          existingProduct.originalPrice
        ),
      };
    }

    const newProduct = await Product.findOneAndUpdate(
      { url: scrapedProduct.url },
      product,
      { upsert: true, new: true }
    );

    revalidatePath(
      `/produse/${newProduct.brand}/${newProduct.model.replace(/ /g, '-')}/${
        newProduct._id
      }`
    );
  } catch (error: any) {
    throw new Error(`Failed to create/update product: ${error.message}`);
  }
}

export async function getProductById(productId: string) {
  try {
    connectToDB();

    const product = await Product.findOne({ _id: productId });

    if (!product) return;

    return product;
  } catch (error) {
    console.log(error);
  }
}

export async function getProductByTitle(productTitle: string) {
  try {
    connectToDB();
    const searchRegex = new RegExp(productTitle, 'i');

    const products = await Product.find({
      title: { $regex: searchRegex },
    })
      .select(
        'title image source category brand model isOutOfStock originalPrice currentPrice currency'
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
    connectToDB();
    const searchRegex = new RegExp(productBrand, 'i');

    const products = await Product.find({
      brand: { $regex: searchRegex },
    })
      .select(
        'title image source category brand model isOutOfStock originalPrice currentPrice currency'
      )
      .lean();

    return JSON.parse(JSON.stringify(products));
  } catch (error) {
    console.log(error);
  }
}

export async function getProductByModel(productModel: string) {
  try {
    connectToDB();
    const searchRegex = new RegExp(productModel, 'i');

    const products = await Product.find({
      model: { $regex: searchRegex },
    })
      .select(
        'title image source category brand model isOutOfStock originalPrice currentPrice currency'
      )
      .lean();

    return JSON.parse(JSON.stringify(products));
  } catch (error) {
    console.log(error);
  }
}

export async function searchProducts(searchTerm: string) {
  try {
    connectToDB();

    const searchTerms = searchTerm.split(' ');

    const brands = await Product.distinct('brand', {
      brand: { $regex: new RegExp(searchTerms.join('|'), 'i') },
    });

    const orConditions = searchTerms.map((term) => ({
      model: { $regex: new RegExp(term, 'i') },
    }));

    const models = await Product.find(
      {
        $or: orConditions,
      },
      'brand model -_id'
    ).limit(4);

    const brandModelObjects = models.map((product) => ({
      brand: product.brand,
      model: product.model,
    }));

    // Get the top 4 most searched products
    const topSearchedProducts = await Product.find(
      {
        model: { $regex: new RegExp(searchTerms.join('|'), 'i') },
      },
      'model brand -_id'
    )
      .limit(4)
      .sort({ hits: -1 })
      .lean();

    return { brands, brandModelObjects, topSearchedProducts };
  } catch (error) {
    console.error('An error occurred:', error);
    throw error;
  }
}

export async function getAllProducts() {
  try {
    connectToDB();

    const products = await Product.find();

    return products;
  } catch (error) {
    console.log(error);
  }
}

export async function getSimilarProducts(productId: string) {
  try {
    connectToDB();

    const currentProduct = await Product.findById(productId);

    if (!currentProduct) return;

    const similarProducts = await Product.find({
      _id: { $ne: productId },
      brand: currentProduct.brand,
    }).limit(4);

    return similarProducts;
  } catch (error) {
    console.log(error);
  }
}

export async function addUserEmailToProduct(
  productId: string,
  userEmail: string
) {
  try {
    const product = await Product.findById(productId);

    if (!product) return;

    const userExists: any = product.users.some(
      (user: User) => user.email === userEmail
    );

    if (!userExists) {
      product.users.push({ email: userEmail });

      await product.save();

      const emailContent = await generateEmailBody(product, 'WELCOME');

      await sendEmail(emailContent, [userEmail]);
    }
  } catch (error) {
    console.log(error);
  }
}
