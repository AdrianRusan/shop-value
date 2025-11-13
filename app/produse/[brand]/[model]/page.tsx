import { getProductByModel } from '@/lib/actions';
import { ProductListing } from '@/components/ProductListing';

// Revalidate every hour
export const revalidate = 3600;

type Props = {
  params: {
    model: string,
  }
}

const ModelsPage = async ({ params }: Props) => {
  const allProducts = await getProductByModel(params.model);

  return <ProductListing products={allProducts || []} emptyMessage={`Nu s-au găsit produse pentru modelul ${params.model}`} />;
}

export default ModelsPage