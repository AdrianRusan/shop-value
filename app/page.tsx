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
      .slice(0, Math.min(8, allProducts.length));
  }

  return (
    <>
      <section className="px-6 md:px-20 py-5  ">
        <div className="flex max-xl:flex-col gap-16">
          <div className="flex flex-col justify-center">
            <p className="small-text">
              Smart Shopping Starts Here
              <Image 
                src="/assets/icons/arrow-right.svg"
                alt="arrow-right"
                width={16}
                height={16}
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

          <div className="flex flex-wrap gap-x-8 gap-y-16 justify-between">
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