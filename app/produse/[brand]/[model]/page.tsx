import ProductCard from '@/components/ProductCard';
import { getProductByModel } from '@/lib/actions';
import { Product } from '@/types';

type Props = {
  params: {
    model: string,
  }
}

const ModelsPage = async ({ params }: Props) => {
  const allProducts = await getProductByModel(params.model.replace(/-/g, ' '));

  return (
    <>
      {allProducts && allProducts?.length > 0 && (
        <section className="trending-section ">
          <div className={`flex flex-wrap gap-x-8 md:gap-x-24 lg:gap-x-7 xl:gap-x-16 gap-y-16 justify-start`}>
          {allProducts?.map((product: Product) => (
            <ProductCard key={product._id} product={product} />
          ))}
          </div>
        </section>
      )}  
    </>
  )
}

export default ModelsPage