import { getAllProducts } from '@/lib/actions';
import { ProductListing } from '@/components/ProductListing';

// Revalidate every hour
export const revalidate = 3600;

const ProductsPage = async () => {
  const allProducts = await getAllProducts();

  const breadcrumbs = [
    { label: 'Acasă', href: '/' },
    { label: 'Produse' },
  ];

  return (
    <ProductListing
      products={allProducts}
      emptyMessage="Nu există produse disponibile"
      breadcrumbs={breadcrumbs}
    />
  );
}

export default ProductsPage