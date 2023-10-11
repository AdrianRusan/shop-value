import { Product } from "@/types"
import Image from "next/image";
import Link from "next/link";
import FormatPrices from "./FormatPrices";
interface Props {
  product: Product;
}
const ProductCard = ({ product } : Props ) => {

  return (
    <Link href={`/products/${product._id}`} className="product-card">
      <div className="product-card_img-container">
        <Image
          src={product.image}
          alt={product.title}
          width={200}
          height={200}
          className="product-card_img"
        />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="product-title">{product.title}</h3>

        <div className="flex justify-between items-end">
          <p className="text-black opacity-50 text-lg capitalize">
            {product.category}
          </p>
          <div className="flex flex-col">
            {/* {product.originalPrice > 0 && ( */}
              <p className={`text-sm text-black opacity-50 line-through ${product.originalPrice > 0 ? '' : 'invisible'}`}>
                <span><FormatPrices num={product.originalPrice}/> </span>
                <span>{product?.currency}</span>
              </p>
            {/* )} */}
            <p className="text-black text-lg font-semibold">
              <span><FormatPrices num={product.currentPrice}/> </span>
              <span>{product?.currency}</span>
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default ProductCard