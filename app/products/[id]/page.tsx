import TrackModal from "@/components/TrackModal";
import PriceInfoCard from "@/components/PriceInfoCard";
import ProductCard from "@/components/ProductCard";
import { getProductById, getSimilarProducts } from "@/lib/actions";
import { Product } from "@/types";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import FormatPrices from "@/components/FormatPrices";
import ProductButtons from "@/components/ProductButtons";
import ShareModal from "@/components/ShareModal";

type Props = {
  params: {
    id: string
  }
}

const ProductDetails = async ({ params: { id }  } : Props) => {
  const product: Product = await getProductById(id);

  if (!product) redirect('/')

  const similarProducts = await getSimilarProducts(id)

  return (
    <div className="product-container">
      <div className="flex gap-28 xl:flex-row flex-col">
        <div className="product-image">
          <Image 
            src={product.image}
            alt={product.title}
            width={480}
            height={400}
            className="mx-auto"
          />
        </div>

        <div className="flex flex-1 flex-col">
          <div className="flex justify-between items-start gap-5 flex-wrap pb-6">
            <div className="flex flex-col gap-3">
              <p className="text-[28px] text-secondary font-semibold">
                {product.title}
              </p>

              <Link
                href={product.url}
                target="_blank"
                className="text-base text-black opacity-50"
              >
                Visit Product
              </Link>
            </div>

            <div className="flex items-center gap-3">
              <div className="product-hearts">
                <Image 
                  src='/assets/icons/red-heart.svg'
                  alt="heart"
                  width={20}
                  height={20}
                />

                <p className="text-base font-semibold text-[#D46F77]">
                  {product.reviewsCount}
                </p>
              </div>

              <div className="p-2 bg-white-200 rounded-10">
                <Image 
                  src='/assets/icons/bookmark.svg'
                  alt='bookmark'
                  width={20}
                  height={20}
                /> 
              </div>

              <div className="p-2 bg-white-200 rounded-10 flex justify-center items-center">
                <ShareModal />
              </div>

              <ProductButtons src="/assets/icons/share.svg" alt="share" product={product} />
            </div>
          </div>

          <div className="product-info">
            <div className="flex flex-col gap-2">
              <p className="text-[34px] text-secondary font-bold tracking-wide ">
                {<FormatPrices num={product.currentPrice}/>} {product.currency}
              </p>
              {product.originalPrice > 0 && (
              <p className="text-[21px] text-black opacity-50 line-through">
                {<FormatPrices num={product.originalPrice}/>} {product.currency}
              </p>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex gap-3">
                <div className="product-stars">
                  <Image 
                    src="/assets/icons/star.svg"
                    alt="star"
                    width={16}
                    height={16}
                  />
                  <p className="text-sm text-primary-orange font-semibold">
                    {product.stars.toFixed(2)} stars
                  </p>
                </div>

                <div className="product-reviews">
                  <Image 
                    src="/assets/icons/comment.svg"
                    alt="comment"
                    width={16}
                    height={16}
                  />
                  <button className="text-sm text-secondary font-semibold">
                    <Link
                      href={`${product.url}#reviews-section`}
                      target="_blank"
                    >
                      {product.reviewsCount} Review{product.reviewsCount > 1 ? 's' : ''}
                    </Link>
                  </button>
                </div>
              </div>

              <p className="text-sm text-black opacity-50">
                <span className="text-primary-green font-semibold">
                  {product.recommendedProduct}
                </span>
              </p>
            </div>
          </div>

          <div className="my-7 flex flex-col gap-5">
            <div className="flex gap-5 flex-wrap">
              <PriceInfoCard 
                title="Current Price"
                iconSrc="/assets/icons/price-tag.svg"
                value={<FormatPrices num={product.currentPrice}/>}
                currency={product.currency}
              />
              <PriceInfoCard 
                title="Average Price"
                iconSrc="/assets/icons/chart.svg"
                value={<FormatPrices num={product.averagePrice}/>}
                currency={product.currency}
              />
              <PriceInfoCard 
                title="Highest Price"
                iconSrc="/assets/icons/arrow-up.svg"
                value={<FormatPrices num={product.highestPrice}/>}
                currency={product.currency}
              />
              <PriceInfoCard 
                title="Lowest Price"
                iconSrc="/assets/icons/arrow-down.svg"
                value={<FormatPrices num={product.lowestPrice}/>}
                currency={product.currency}
              />
            </div>
          </div>

          <TrackModal productId={id} />
        </div>
      </div>

      <div className="flex flex-col gap-16">
        <div className="flex flex-col gap-5 ">
          <h3 className="text-2xl text-secondary font-semibold">
            Product Description
          </h3>

          <div className="flex flex-col gap-4 whitespace-pre-line">
            {product?.description.split("\n").map((paragraph) => (
              <p key={paragraph}>
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        <button className="btn w-fit mx-auto flex items-center justify-center gap-3 min-w-[200px]">
          <Image 
            src="/assets/icons/bag.svg"
            alt="check"
            width={22}
            height={22}
          />

          <Link
            href="/"
            className="text-base text-white"
          >
            Buy Now
          </Link>
        </button>
      </div>

      {similarProducts && similarProducts?.length > 0 && (
        <div className="py-14 flex flex-col gap-2 w-full">
          <p className="section-text">
            Similar Products
          </p>

          <div className="flex flex-wrap gap-8 mt-7 w-full">
            {similarProducts.map((product) => (
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