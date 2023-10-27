import { getAllProducts } from '@/lib/actions';

export default async function sitemap() {
  const baseUrl = 'https://shop-value.vercel.app';

  const products = await getAllProducts();

  if (!products) return;

  const productPaths = products.map((product) => {
    return {
      url: `${baseUrl}/product/${product.id}`,
      lastModified: new Date(),
    };
  });

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
    },
    ...productPaths,
  ];
}
