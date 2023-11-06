import TrackModal from "@/components/TrackModal";
import PriceInfoCard from "@/components/PriceInfoCard";
import { getProductById } from "@/lib/actions";
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
    brand: string,
    model: string,
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
      canonical: `/produse/${params.brand}/${params.model.replace(/ /g, '-')}/${params.id}`,
      languages: {
        "ro-RO": `/produse/${params.brand}/${params.model.replace(/ /g, '-')}/${params.id}`,
      },
    },
    openGraph: {
      url: `/produse/${params.brand}/${params.model.replace(/ /g, '-')}/${params.id}`,
      title: `ShopValue - ${product.title.split(',')[0]}`,
      description: `ShopValue - ${product.title}`,
      type: 'website',
      siteName: 'ShopValue',
      locale: 'ro_RO',
      images: [
        {
          url: product.image,
          width: 250,
          height: 250,
          alt: product.title,
        }
      ],
    },
  }
}

const formatDate = (date: Date) =>
  new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

const ProductDetails = async ({ params }: Props) => {

  const ThemedIcon = dynamic(() => import('../../../../../components/ThemedIcon'))
  const PriceTableChart = dynamic(() => import('../../../../../components/PriceTableChart'))
  const SimilarSection = dynamic(() => import('../../../../../components/SimilarSection'))

  const product = await getProductById(params.id) as Product;

  if (!product) {
    redirect('/');
  }

  const priceHistory = product.priceHistory.map((priceData) => ({
    date: new Date(priceData.date),
    price: priceData.price,
  }));

  const filteredPriceHistory = priceHistory.filter((item) => item.price !== 0);

  const lowestPriceItem: PriceHistoryItem = getLowestPrice(priceHistory);
  const highestPriceItem: PriceHistoryItem = getHighestPrice(priceHistory, product.originalPrice);

  const headersList = headers();
  const domain = headersList.get("x-forwarded-host") || "";
  const protocol = headersList.get("x-forwarded-proto") || "";
  const flipURL = `${protocol}://${domain}/assets/images/flip.jpg`;

  let differentPrices = true;
  if (product.lowestPrice === product.highestPrice) differentPrices = false;

  return (
    <div className="product-container">
      <div className="flex gap-1 xl:gap-28 xl:flex-row flex-col min-h-[calc(100vh-167.5px)] xl:min-h-[calc(100vh-72px)] items-center justify-center">
        <div className="product-image xl:mb-24 object-contain">
          {product.source === 'flip' && (
            <Image
              src={flipURL}
              alt={product.source}
              width={75}
              height={75}
              className="absolute ml-1"
              priority
            />
          )}
          <Image
            src={product.image}
            alt={product.title}
            width={250}
            height={250}
            className="mx-auto w-auto h-auto"
            priority
          />
        </div>

        <div className="flex flex-1 flex-col">
          <div className="flex justify-between items-start gap-5 flex-wrap pb-6">
            <div className="flex flex-col gap-3">
              <p className="text-[28px] text-secondary dark:text-white-200 font-semibold max-sm:text-center">
                {product.title}
              </p>

              <div className="flex items-center gap-3 max-sm:justify-center">
                <Link
                  href={product.url}
                  target="_blank"
                  className="text-base text-black dark:text-white-200 opacity-75"
                  rel="preload"
                >
                  Vezi Produsul
                </Link>

                <ShareModal />
              </div>
            </div>
          </div>

          <div className="product-info max-sm:justify-center">
            {product.isOutOfStock ? (
              <p className="text-[34px] text-primary font-bold">
                Stoc Epuizat
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-[34px] text-secondary dark:text-white-200 font-bold tracking-wide ">
                  {<FormatPrices num={product.currentPrice} />} {product.currency}
                </p>
                {product.originalPrice > 0 && (
                  <p className="text-[21px] text-black dark:text-white-200 opacity-75 line-through">
                    {<FormatPrices num={product.originalPrice} />} {product.currency}
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
                    {product.stars.toFixed(2)}
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
                      {product.reviewsCount} Review{product.reviewsCount > 1 ? '-uri' : ''}
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
            Evidență ținută din: {formatDate(filteredPriceHistory[0].date)}
          </div>
          <div className="my-7 flex flex-col">
            <div className="flex gap-5 flex-wrap">
              <PriceInfoCard
                title="Prețul Actual"
                iconSrc="/assets/icons/price-tag.svg"
                value={<FormatPrices num={product.currentPrice} />}
                currency={product.currency}
                outOfStock={product.isOutOfStock}
              />
              <PriceInfoCard
                title="Cel mai Mare Preț"
                iconSrc="/assets/icons/arrow-up.svg"
                value={<FormatPrices num={product.highestPrice} />}
                currency={product.currency}
                outOfStock={product.isOutOfStock}
                date={highestPriceItem.date}
                differentPrices={differentPrices}
              />
              <PriceInfoCard
                title="Cel mai Mic Preț"
                iconSrc="/assets/icons/arrow-down.svg"
                value={<FormatPrices num={product.lowestPrice} />}
                currency={product.currency}
                outOfStock={product.isOutOfStock}
                date={lowestPriceItem.date}
                differentPrices={differentPrices}
              />
              <PriceInfoCard
                title="Media Prețurilor"
                iconSrc="/assets/icons/chart.svg"
                value={<FormatPrices num={product.averagePrice} />}
                currency={product.currency}
                outOfStock={product.isOutOfStock}
              />
            </div>
          </div>

          <TrackModal productId={params.id} />
        </div>
      </div>

      <div className="flex flex-col gap-16">
        <div className="flex flex-col gap-5">
          <ProductDescription description={product?.description} />
        </div>

        <button className="btn w-fit mx-auto flex items-center justify-center gap-3 min-w-[200px]">
          <ThemedIcon alt="bag" />
          <Link
            href={product.url}
            target="_blank"
            className="text-base text-white dark:text-black"
          >
            Cumpără Acum
          </Link>
        </button>
      </div>

      {filteredPriceHistory.length > 0 && (
        <div className="my-7">
          <p className="section-text">Istoricul Prețurilor</p>
          <PriceTableChart priceHistory={filteredPriceHistory} />
        </div>
      )}

      <SimilarSection id={params.id} />
    </div>
  );
}

export default ProductDetails