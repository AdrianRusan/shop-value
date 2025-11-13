import { getProductByBrand } from '@/lib/actions';
import { ProductListing } from '@/components/ProductListing';

// Revalidate every hour
export const revalidate = 3600;

type Props = {
  params: {
    brand: string,
  }
}

const BrandsPage = async ({ params }: Props) => {
  const allProducts = await getProductByBrand(params.brand);

  return <ProductListing products={allProducts || []} emptyMessage={`Nu s-au găsit produse pentru marca ${params.brand}`} />;
}

export default BrandsPage