import TrackModal from "@/components/TrackModal";
import PriceInfoCard from "@/components/PriceInfoCard";
import { getProductById, getSimilarProducts } from "@/lib/actions";
import { PriceHistoryItem, Product } from "@/types";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import FormatPrices from "@/components/FormatPrices";
import ShareModal from "@/components/ShareModal";
import { headers } from 'next/headers'
import dynamic from "next/dynamic";
import { getHighestPrice, getLowestPrice } from "@/lib/utils";
import ProductDescription from "@/components/ProductDescription";
import { Metadata } from "next";

type Props = {
  params: {
    id: string
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product: Product = await getProductById(params.id);
    if (!product) return {
      title: "Produsul nu a fost gasit.",
      description: "Produsul nu a fost gasit."
    }

    return {
      title: `ShopValue - ${product.title.split(',')[0]}`,
      description: `ShopValue - ${product.title}`,
      alternates: {
        canonical: `/products/${params.id}`,
        languages:{
          "ro-RO": `/products/${params.id}`,
        },
      },
      openGraph: {
        url: `/products/${params.id}`,
        title: `ShopValue - ${product.title.split(',')[0]}`,
        description: `ShopValue - ${product.title}`,
        type: 'website',
        siteName: 'ShopValue',
        locale: 'ro_RO',
      },
    }

}

const ProductDetails = async ({ params } : Props) => {
  const product: Product = await getProductById(params.id);
  if (!product) redirect('/')

  const similarProducts = await getSimilarProducts(params.id)
  let sortedProducts = [];

  if (similarProducts && similarProducts?.length > 0) {
    sortedProducts = similarProducts
      .sort((a, b) => b.priceHistory.length - a.priceHistory.length)
      .slice(0, Math.min(4, similarProducts.length));
  }

  const priceHistory = product.priceHistory.map((priceData) => ({
    date: new Date(priceData.date),
    price: priceData.price,
  }));

  const filteredPriceHistory = priceHistory.filter((item) => item.price !== 0);


  const ThemedIcon = dynamic(() => import('../../../components/ThemedIcon'))
  const PriceTableChart = dynamic(() => import('../../../components/PriceTableChart'))
  const ProductCard = dynamic(() => import('../../../components/ProductCard'))


  const lowestPriceItem: PriceHistoryItem = getLowestPrice(priceHistory);
  const highestPriceItem: PriceHistoryItem = getHighestPrice(priceHistory, product.originalPrice);

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(date).toLocaleDateString(undefined, options);
  };

  const headersList = headers();
  const domain = headersList.get("x-forwarded-host") || "";
  const protocol = headersList.get("x-forwarded-proto") || "";
  const flipURL = `${protocol}://${domain}/assets/images/flip.jpg`;

  let differentPrices = true;
  if (product.lowestPrice === product.highestPrice) differentPrices = false;

  return (
    <div className="product-container">
      <div className="flex gap-28 xl:flex-row flex-col">
        <div className="product-image">
        {product.source === 'emag' ? (
            <Image
              src={product.sourceSrc}
              alt={product.source}
              width={100}
              height={100}
              className="absolute"
              priority
            />
          ) : (
            <Image
              src={flipURL}
              alt={product.source}
              width={75}
              height={75}
              className="absolute ml-1 -mt-2"
              priority
            />          
          )}
          <Image 
            src={product.image}
            alt={product.title}
            width={480}
            height={480}
            className="mx-auto w-auto h-auto"
            sizes="(max-width: 425px) 100vw, (max-width: 768px) 768px, (max-width: 1024px) 1024px, (max-width: 1440px) 1440px, (max-width: 2560px) 2560px, 425px"
            priority
          />
        </div>

        <div className="flex flex-1 flex-col">
          <div className="flex justify-between items-start gap-5 flex-wrap pb-6">
            <div className="flex flex-col gap-3">
              <p className="text-[28px] text-secondary dark:text-white-200 font-semibold">
                {product.title}
              </p>

              <div className="flex items-center gap-3">
                <Link
                  href={product.url}
                  target="_blank"
                  className="text-base text-black dark:text-white-200 opacity-75"
                  rel="preload"
                >
                  Visit Product
                </Link>

                <ShareModal />
              </div>
            </div>
          </div>

          <div className="product-info">
            {product.isOutOfStock ? (
              <p className="text-[34px] text-primary font-bold">
                Stoc Epuizat
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-[34px] text-secondary dark:text-white-200 font-bold tracking-wide ">
                  {<FormatPrices num={product.currentPrice}/>} {product.currency}
                </p>
                {product.originalPrice > 0 && (
                <p className="text-[21px] text-black dark:text-white-200 opacity-75 line-through">
                  {<FormatPrices num={product.originalPrice}/>} {product.currency}
                </p>
                )}
              </div>
            )}

            <div className="flex flex-col">
              <div className="flex gap-3">
                <div className="product-stars">
                  <Image 
                    src="/assets/icons/star.svg"
                    alt="star"
                    width={0}
                    height={0}
                    className="w-auto h-auto"
                    priority
                  />
                  <p className="text-sm text-secondary font-semibold">
                    {product.stars.toFixed(2)} stars
                  </p>
                </div>

                <div className="product-reviews">
                  <Image 
                    src="/assets/icons/comment.svg"
                    alt="comment"
                    width={0}
                    height={0}
                    className="w-auto h-auto"
                    priority
                  />
                  <button className="text-sm text-secondary font-semibold">
                    <Link
                      href={`${product.url}#shop-reviews`}
                      target="_blank"
                    >
                      {product.reviewsCount} Review{product.reviewsCount > 1 ? 's' : ''}
                    </Link>
                  </button>
                </div>
              </div>

              <p className="text-sm">
                <span className="dark:text-[#39AA41] text-[#0B680C] font-semibold">
                  {product.recommendedProduct}
                </span>
              </p>
            </div>
          </div>

        <div className="text-lg font-bold text-secondary dark:text-white-200 pt-2 text-center">
          Tracked since: {formatDate(filteredPriceHistory[0].date)}
        </div>
          <div className="my-7 flex flex-col">
            <div className="flex gap-5 flex-wrap">
              <PriceInfoCard 
                title="Current Price"
                iconSrc="/assets/icons/price-tag.svg"
                value={<FormatPrices num={product.currentPrice}/>}
                currency={product.currency}
                outOfStock={product.isOutOfStock}
              />
              <PriceInfoCard 
                title="Highest Price"
                iconSrc="/assets/icons/arrow-up.svg"
                value={<FormatPrices num={product.highestPrice}/>}
                currency={product.currency}
                outOfStock={product.isOutOfStock}
                date={highestPriceItem.date}
                differentPrices={differentPrices}
              />
              <PriceInfoCard 
                title="Lowest Price"
                iconSrc="/assets/icons/arrow-down.svg"
                value={<FormatPrices num={product.lowestPrice}/>}
                currency={product.currency}
                outOfStock={product.isOutOfStock}
                date={lowestPriceItem.date}
                differentPrices={differentPrices}
              />
              <PriceInfoCard 
                title="Average Price"
                iconSrc="/assets/icons/chart.svg"
                value={<FormatPrices num={product.averagePrice}/>}
                currency={product.currency}
                outOfStock={product.isOutOfStock}
              />
            </div>
          </div>

          <TrackModal productId={params.id} />
        </div>
      </div>

      <div className="flex flex-col gap-16">
        <div className="flex flex-col gap-5 ">

        <ProductDescription description={product?.description} />

        </div>

        <button className="btn w-fit mx-auto flex items-center justify-center gap-3 min-w-[200px]">
          <ThemedIcon alt="bag" />
          <Link
            href={product.url}
            target="_blank"
            className="text-base text-white dark:text-black"
          >
            Buy Now
          </Link>
        </button>
      </div>

      {filteredPriceHistory.length > 0 && (
        <div className="my-7">
          <p className="section-text">Price History</p>
          <PriceTableChart priceHistory={filteredPriceHistory} />
        </div>
      )}

      {sortedProducts && sortedProducts?.length > 0 && (
        <div className="py-14 flex flex-col gap-2 w-full">
          <p className="section-text">
            Similar Products
          </p>

          <div className="flex flex-wrap gap-8 mt-7 w-full">
            {sortedProducts.map((product) => (
              <ProductCard 
                key={product._id} 
                product={product}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductDetails