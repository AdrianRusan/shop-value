import HeroCarousel from "@/components/HeroCarousel"
import Searchbar from "@/components/Searchbar"
import TrendingSection from "@/components/TrendingSection"
import Image from "next/image"
import dynamic from "next/dynamic";


const Home = async () => {

  const TrendingSection = dynamic(() => import('../components/TrendingSection'))

  return (
    <>
      <section className="px-6 md:px-20 py-5  ">
        <div className="flex max-lg:flex-col gap-16">
          <div className="flex flex-col justify-center py-7 gap-y-5 md:py-20 md:gap-y-8 lg:gap-y-0">
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

      <TrendingSection />
    </>
  )
}

export default Home