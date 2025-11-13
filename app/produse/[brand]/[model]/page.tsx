import { getProductByModel } from '@/lib/actions';
import { ProductListing } from '@/components/ProductListing';

// Revalidate every hour
export const revalidate = 3600;

type Props = {
  params: {
    model: string,
    brand: string,
  }
}

const ModelsPage = async ({ params }: Props) => {
  const allProducts = await getProductByModel(params.model);

  const breadcrumbs = [
    { label: 'Acasă', href: '/' },
    { label: 'Produse', href: '/produse' },
    { label: params.brand, href: `/produse/${params.brand}` },
    { label: params.model },
  ];

  return (
    <ProductListing
      products={allProducts || []}
      emptyMessage={`Nu s-au găsit produse pentru modelul ${params.model}`}
      breadcrumbs={breadcrumbs}
    />
  );
}

export default ModelsPage