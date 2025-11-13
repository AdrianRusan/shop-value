import { getAllProducts } from '@/lib/actions';

export default async function sitemap() {
  const baseUrl = 'https://shop-value.vercel.app';

  // Get all products for sitemap (without pagination limit for SEO)
  const products = await getAllProducts(1000);

  if (!products || products.length === 0) {
    return [
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 1,
      },
    ];
  }

  // Generate product URLs with correct pattern
  const productPaths = products.map((product) => {
    const modelSlug = product.productModel?.replace(/ /g, '-') || 'unknown';
    return {
      url: `${baseUrl}/produse/${product.brand}/${modelSlug}/${product._id}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    };
  });

  // Get unique brands for brand pages
  const brands = [...new Set(products.map((p) => p.brand))];
  const brandPaths = brands.map((brand) => ({
    url: `${baseUrl}/produse/${brand}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.6,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1,
    },
    {
      url: `${baseUrl}/produse`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.9,
    },
    ...brandPaths,
    ...productPaths,
  ];
}
