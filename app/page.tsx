import HeroCarousel from "@/components/HeroCarousel"
import Searchbar from "@/components/Searchbar"
import Image from "next/image"
import { getAllProducts } from "@/lib/actions"
import ProductCard from "@/components/ProductCard"

const Home = async () => {

  const allProducts = await getAllProducts();

  let sortedProducts = [];

  if (allProducts && allProducts?.length > 0) {
    sortedProducts = allProducts
      .sort((a, b) => b.priceHistory.length - a.priceHistory[a.priceHistory.length - 1].date)
      .slice(0, Math.min(12, allProducts.length));
  }

  const dateOptions = { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: 'numeric', timeZone: 'Europe/Bucharest' };

  return (
    <>
      <section className="px-6 md:px-20 min-h-[calc(100vh-167.5px)] md:min-h-[calc(100vh-72px)] flex items-center justify-center">
        <div className="flex max-lg:flex-col">
          <div className="flex flex-col justify-center gap-y-5 md:py-20 md:gap-y-8 lg:gap-y-0 xl:w-1/2">
            <p className="small-text w-auto h-auto">
              Cumpărăturile Inteligente Încep Aici
              <Image
                src="/assets/icons/arrow-right.svg"
                alt="arrow-right"
                width={0}
                height={0}
                className="w-auto h-auto"
                priority
              />
            </p>
            <h1 className="head-text dark:text-white-200">
              Orice preț, oricând, oriunde -
              <span className="text-primary"> ShopValue</span>
            </h1>
            <p className="mt-6 dark:text-white-200">
              Descoperă Tendințele de Prețuri pentru Produsele de pe Flip.
            </p>

            <Searchbar />
          </div>

          <HeroCarousel />
        </div>
      </section>

      {sortedProducts && sortedProducts?.length > 0 && (
        <section className="trending-section ">
          <h2 className="section-text">Ultimele Căutări</h2>

          <div className={`flex flex-wrap gap-x-8 md:gap-x-24 lg:gap-x-7 xl:gap-x-16 gap-y-16 justify-start`}>
            {sortedProducts.map((product) => (
              <div key={product._id} className="flex flex-col">
                <p>{product.priceHistory[product.priceHistory.length - 1].date.toLocaleString('ro-RO', dateOptions)}</p>
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}

export default Home