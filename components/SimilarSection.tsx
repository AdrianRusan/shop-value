import { getSimilarProducts } from "@/lib/actions";
import { Product } from "@/types";
import ProductCard from "./ProductCard";

interface SimilarProps {
  id: string;
}

const SimilarSection = async ({ id }: SimilarProps) => {

  const similarProducts = await getSimilarProducts(id)

  const sortedProducts: Product[] = similarProducts?.slice(0, 4).sort((a, b) => b.priceHistory.length - a.priceHistory.length) || [];

  return (
    <>
      {sortedProducts && sortedProducts.length > 0 && (
        <div className="py-14 flex flex-col gap-2 w-full">
          <p className="section-text">Produse Similare</p>

          <div className="flex flex-wrap gap-8 mt-7 w-full">
            {sortedProducts.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

export default SimilarSection