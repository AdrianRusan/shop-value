import { getAllProducts } from '@/lib/actions';

// Revalidate the sitemap every hour (3600 seconds)
export const revalidate = 3600;

function getStaticPages(baseUrl: string) {
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

export default async function sitemap() {
  const baseUrl = 'https://shop-value.vercel.app';
  const staticPages = getStaticPages(baseUrl);

  try {
    const products = await getAllProducts();

    const productPaths = products
      ?.filter((product) => 
        product.brand && 
        product.productModel && 
        product._id &&
        typeof product.brand === 'string' &&
        typeof product.productModel === 'string'
      )
      ?.map((product) => {
        const encodedBrand = encodeURIComponent(product.brand.trim());
        const encodedModel = encodeURIComponent(product.productModel.trim());
        
        return {
          url: `${baseUrl}/produse/${encodedBrand}/${encodedModel}/${product._id}`,
          lastModified: new Date(),
        };
      }) || [];

    return [...staticPages, ...productPaths];
  } catch (error) {
    console.error('Error generating sitemap:', error);
    // Return basic sitemap if database is unavailable
    return staticPages;
  }
}
