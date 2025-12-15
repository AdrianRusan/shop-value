import { getAllProducts } from "@/lib/actions";
import ProductCard from "./ProductCard";
import { Product } from "@/types";

const TrendingSection = async () => {

  const allProducts = await getAllProducts();

  let sortedProducts: Product[] = [];

  if (allProducts && allProducts?.length > 0) {
    sortedProducts = allProducts
      .filter(product => product.priceHistory && product.priceHistory.length > 0)
      .sort((a, b) => b.priceHistory.length - a.priceHistory.length)
      .slice(0, Math.min(12, allProducts.length));
  }

  const dateOptions: Intl.DateTimeFormatOptions = { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric', 
    hour: 'numeric', 
    minute: 'numeric', 
    timeZone: 'Europe/Bucharest' 
  };

  return (
    <>
      {sortedProducts && sortedProducts?.length > 0 && (
        <section className="trending-section ">
          <h2 className="section-text">Ultimele Căutări</h2>

          <div className={`flex flex-wrap gap-x-8 md:gap-x-24 lg:gap-x-7 xl:gap-x-16 gap-y-16 justify-start`}>
            {sortedProducts.map((product) => (
              <div key={product._id} className="flex flex-col">
                <p>{new Date(product.priceHistory[product.priceHistory.length - 1].date).toLocaleString('ro-RO', dateOptions)}</p>
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}

export default TrendingSection