import HeroCarousel from "@/components/HeroCarousel"
import Searchbar from "@/components/Searchbar"
import Image from "next/image"
import SampleProductsSection from "@/components/SampleProductsSection"

const Home = async () => {

  return (
    <>
      <section className="px-6 md:px-20 min-h-[calc(100vh-167.5px)] md:min-h-[calc(100vh-72px)] flex items-center justify-center">
        <div className="flex max-lg:flex-col gap-8 lg:gap-16 items-center">
          <div className="flex flex-col justify-center md:py-20 md:gap-y-8 lg:gap-y-0 xl:w-1/2 max-lg:text-center">
            <p className="small-text w-auto h-auto justify-center lg:justify-start">
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
            <p className="mt-6 dark:text-white-200 text-lg max-w-xl">
              Descoperă Tendințele de Prețuri pentru Produsele de pe Flip. Urmărește prețurile, primește alerte și economisește bani cu platforma noastră avansată de monitorizare.
            </p>

            <div className="mt-8">
              <Searchbar />
            </div>

            {/* Feature highlights */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2 justify-center lg:justify-start">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-gray-600 dark:text-gray-400">Alerte în timp real</span>
              </div>
              <div className="flex items-center gap-2 justify-center lg:justify-start">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-gray-600 dark:text-gray-400">Istoric prețuri</span>
              </div>
              <div className="flex items-center gap-2 justify-center lg:justify-start">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span className="text-gray-600 dark:text-gray-400">Gratuit să folosești</span>
              </div>
            </div>
          </div>

          <div className="xl:w-1/2 flex justify-center">
            <HeroCarousel />
          </div>
        </div>
      </section>

      <SampleProductsSection />
    </>
  )
}

export default Home