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
      .sort((a, b) => b.priceHistory.length - a.priceHistory.length)
      .slice(0, Math.min(12, allProducts.length));
  }

  return (
    <>       
      <section className="px-6 md:px-20 py-5  ">
        <div className="flex max-lg:flex-col gap-16">
          <div className="flex flex-col justify-center py-7 gap-y-5 md:py-20 md:gap-y-8 lg:gap-y-0">
            <p className="small-text w-auto h-auto">
              Smart Shopping Starts Here
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
              Unleash the Power of
              <span className="text-primary"> ShopValue</span>
            </h1>
            <p className="mt-6 dark:text-white-200">
              Powerful, self-serve product and growth analytics to help you convert, engage, and retain more.
            </p>

            <Searchbar />
          </div>

          <HeroCarousel />
        </div>
      </section>
      
      {sortedProducts && sortedProducts?.length > 0 && (
        <section className="trending-section ">
          <h2 className="section-text">Trending</h2>

          <div className={`flex flex-wrap gap-x-8 md:gap-x-24 lg:gap-x-7 xl:gap-x-16 gap-y-16 justify-start`}>
          {sortedProducts.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
          </div>
        </section>
      )}
    </>
  )
}

export default Home