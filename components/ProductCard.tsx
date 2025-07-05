import { Product } from "@/types"
import Image from "next/image";
import Link from "next/link";
import { memo, useMemo } from "react";

interface Props {
  product: Product;
  priority?: boolean;
  loading?: 'eager' | 'lazy';
}

const ProductCard = memo(({ product, priority = false, loading = 'lazy' }: Props) => {
  const flipURL = `/assets/images/flip.jpg`;

  // Memoize calculated values to prevent unnecessary recalculations
  const productData = useMemo(() => {
    const hasDiscount = product.originalPrice > 0 && product.originalPrice > product.currentPrice;
    const discountPercentage = hasDiscount 
      ? Math.round(((product.originalPrice - product.currentPrice) / product.originalPrice) * 100)
      : 0;
    
    const imageUrl = product.image || flipURL;
    const linkUrl = `/produse/${product.brand}/${product.productModel?.replace(/ /g, '-') || 'unknown'}/${product._id}`;
    const displayTitle = product.title.length > 60 ? `${product.title.substring(0, 60)}...` : product.title;

    return {
      hasDiscount,
      discountPercentage,
      imageUrl,
      linkUrl,
      displayTitle
    };
  }, [product.originalPrice, product.currentPrice, product.image, product.brand, product.productModel, product._id, product.title]);

  // Error handling for missing required product data
  if (!product || !product._id || !product.title) {
    return (
      <div className="mx-0">
        <div className="product-card min-h-[490px] block border border-red-200 bg-red-50 rounded-lg p-4 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 text-sm font-medium">Product data unavailable</p>
            <p className="text-red-500 text-xs mt-1">Please try refreshing the page</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-0">
      <Link 
        href={productData.linkUrl} 
        className="product-card min-h-[490px] block hover:shadow-lg transition-shadow duration-200"
        aria-label={`View details for ${product.title}`}
      >
        <div className="product-card_img-container border border-slate-200 dark:bg-white relative">
          {/* Optimized image loading with proper dimensions and loading strategy */}
          <Image
            src={productData.imageUrl}
            alt={product.title}
            width={200}
            height={200}
            className="product-card_img"
            priority={priority}
            placeholder="blur"
            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
            sizes="(max-width: 640px) 200px, (max-width: 1024px) 250px, 300px"
            style={{
              objectFit: 'contain',
              objectPosition: 'center',
            }}
            onError={(e) => {
              console.warn('Failed to load product image:', productData.imageUrl);
              (e.target as HTMLImageElement).src = flipURL;
            }}
          />
          
          {/* Discount badge */}
          {productData.hasDiscount && (
            <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              -{productData.discountPercentage}%
            </div>
          )}
          
          {/* Source badge */}
          {product.source === 'flip' && (
            <div className="absolute bottom-2 left-2">
              <Image
                src={flipURL}
                alt={`Available on ${product.source}`}
                width={50}
                height={50}
                className="rounded-md shadow-sm"
                onError={(e) => {
                  console.warn('Failed to load source badge image');
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 p-3">
          <h3 className="product-title" title={product.title}>
            {productData.displayTitle}
          </h3>
          
          <div className="flex justify-between items-center">
            <p className="flex h-[6vh] text-black dark:text-white-200 opacity-75 capitalize text-lg text-center items-center">
              {product.category || 'Uncategorized'}
            </p>
            
            {product.isOutOfStock ? (
              <div className="text-sm text-primary font-semibold bg-red-50 px-2 py-1 rounded">
                Stoc Epuizat
              </div>
            ) : (
              <div className="flex flex-col whitespace-nowrap text-right">
                {productData.hasDiscount && (
                  <p className="text-sm text-black opacity-75 dark:text-white-200 line-through">
                    <span>{product.originalPrice} </span>
                    <span>{product?.currency || 'RON'}</span>
                  </p>
                )}
                <p className="text-black text-lg font-semibold dark:text-white-200">
                  <span>{product.currentPrice} </span>
                  <span>{product?.currency || 'RON'}</span>
                </p>
              </div>
            )}
          </div>
          
          {/* Price history indicator */}
          {product.priceHistory && product.priceHistory.length > 1 && (
            <div className="text-xs text-gray-500 mt-1">
              Istoric prețuri disponibil
            </div>
          )}
        </div>
      </Link>
    </div>
  )
});

// Add display name for debugging
ProductCard.displayName = 'ProductCard';

export default ProductCard