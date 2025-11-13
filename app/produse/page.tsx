import { getAllProducts } from '@/lib/actions';
import { ProductListing } from '@/components/ProductListing';

// Revalidate every hour
export const revalidate = 3600;

const ProductsPage = async () => {
  const allProducts = await getAllProducts();

  return <ProductListing products={allProducts} emptyMessage="Nu există produse disponibile" />;
}

export default ProductsPage