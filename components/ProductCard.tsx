import { Product } from "@/types"
import Image from "next/image";
import Link from "next/link";

interface Props {
  product: Product;
}
const ProductCard = ({ product }: Props) => {

  const flipURL = `/assets/images/flip.jpg`;

  // TODO: Add default image
  const productImage = product.image || flipURL;

  return (
    <div className="mx-0">
      <Link href={`/produse/${product.brand}/${product.productModel?.replace(/ /g, '-') || 'unknown'}/${product._id}`} className="product-card min-h-[490px]">
        <div className="product-card_img-container border  border-slate-200 dark:bg-white">
          <Image
            src={productImage}
            alt={product.title}
            width={200}
            height={200}
            className="product-card_img"
            priority
          />
          {product.source === 'flip' && (
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
            {product.isOutOfStock ? (
              <p className="text-sm text-primary font-semibold">
                Stoc Epuizat
              </p>
            ) : (
              <div className="flex flex-col whitespace-nowrap">
                <p className={`text-sm text-black opacity-75 dark:text-white-200 line-through ${product.originalPrice > 0 ? '' : 'hidden'}`}>
                  <span>{product.originalPrice} </span>
                  <span>{product?.currency}</span>
                </p>
                <p className="text-black text-lg font-semibold dark:text-white-200">
                  <span>{product.currentPrice} </span>
                  <span>{product?.currency}</span>
                </p>
              </div>
            )}

          </div>
        </div>
      </Link>
    </div>
  )
}

export default ProductCard