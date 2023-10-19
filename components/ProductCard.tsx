import { Product } from "@/types"
import Image from "next/image";
import Link from "next/link";
import FormatPrices from "./FormatPrices";
import { headers } from 'next/headers'

interface Props {
  product: Product;
}
const ProductCard = ({ product } : Props ) => {

  const headersList = headers();
  const domain = headersList.get("x-forwarded-host") || "";
  const protocol = headersList.get("x-forwarded-proto") || "";
  const flipURL = `${protocol}://${domain}/assets/images/flip.jpg`;

  return (
    <div className="mx-0">
      <Link href={{pathname: `/products/${product._id}`, query: {flipURL}}} className="product-card min-h-[490px]">
        <div className="product-card_img-container border  border-slate-200 dark:bg-white">
          <Image
            src={product.image}
            alt={product.title}
            width={200}
            height={200}
            className="product-card_img"
          />
          {product.source === 'emag' ? (
            <Image
              src={product.sourceSrc}
              alt={product.source}
              width={50}
              height={50}
            />
          ) : (
            <Image
              src={flipURL}
              alt={product.source}
              width={50}
              height={50}
            />          
          )}

        </div>

        <div className="flex flex-col gap-2">
          <h3 className="product-title">
            {product.title}
          </h3>
          <div className="flex justify-between items-center">
            <p className={`flex h-[6vh] text-black dark:text-white-200 opacity-75 capitalize text-lg text-center items-center`}>
              {product.category}
            </p>
            <div className="flex flex-col whitespace-nowrap">
                <p className={`text-sm text-black opacity-75 dark:text-white-200 line-through ${product.originalPrice > 0 ? '' : 'hidden'}`}>
                  <span><FormatPrices num={product.originalPrice}/> </span>
                  <span>{product?.currency}</span>
                </p>
              <p className="text-black text-lg font-semibold dark:text-white-200">
                <span><FormatPrices num={product.currentPrice}/> </span>
                <span>{product?.currency}</span>
              </p>
            </div>
          </div>
        </div>
      </Link>
    </div>
  )
}

export default ProductCard