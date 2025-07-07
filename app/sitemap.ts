import { getAllProducts } from '@/lib/actions';

// Force this to be dynamic to avoid build-time database calls
export const dynamic = 'force-dynamic';

export default async function sitemap() {
  const baseUrl = 'https://shop-value.vercel.app';

  try {
    const products = await getAllProducts();

    const productPaths = products?.map((product) => {
      return {
        url: `${baseUrl}/produse/${product.brand}/${product.productModel}/${product._id}`,
        lastModified: new Date(),
      };
    }) || [];

    return [
      {
        url: baseUrl,
        lastModified: new Date(),
      },
      {
        url: `${baseUrl}/produse`,
        lastModified: new Date(),
      },
      {
        url: `${baseUrl}/search`,
        lastModified: new Date(),
      },
      {
        url: `${baseUrl}/pricing`,
        lastModified: new Date(),
      },
      {
        url: `${baseUrl}/developers`,
        lastModified: new Date(),
      },
      ...productPaths,
    ];
  } catch (error) {
    console.error('Error generating sitemap:', error);
    // Return basic sitemap if database is unavailable
    return [
      {
        url: baseUrl,
        lastModified: new Date(),
      },
      {
        url: `${baseUrl}/produse`,
        lastModified: new Date(),
      },
      {
        url: `${baseUrl}/search`,
        lastModified: new Date(),
      },
      {
        url: `${baseUrl}/pricing`,
        lastModified: new Date(),
      },
      {
        url: `${baseUrl}/developers`,
        lastModified: new Date(),
      },
    ];
  }
}
