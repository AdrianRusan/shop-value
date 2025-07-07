"use client"

import React, { useState, useCallback } from "react";
import { Product } from "@/types"
import Image from "next/image";
import Link from "next/link";
import { useUser } from '@clerk/nextjs';
import { addToRecentlyViewed } from "@/lib/recentlyViewed";

interface Props {
  product: Product;
  priority?: boolean;
  loading?: 'eager' | 'lazy';
}

const ProductCard = ({ product, priority = false, loading = 'lazy' }: Props) => {
  const { user } = useUser();
  const flipURL = `/assets/images/flip.jpg`;
  const [imageError, setImageError] = useState(false);
  const [fallbackError, setFallbackError] = useState(false);
  const [isAddingToWishlist, setIsAddingToWishlist] = useState(false);

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

  // Calculate values with safe defaults
  const hasDiscount = product.originalPrice > 0 && product.originalPrice > product.currentPrice;
  const discountPercentage = hasDiscount 
    ? Math.round(((product.originalPrice - product.currentPrice) / product.originalPrice) * 100)
    : 0;
  
  // Handle product click - add to recently viewed
  const handleProductClick = useCallback(() => {
    try {
      addToRecentlyViewed(product);
    } catch (error) {
      console.warn('Failed to add product to recently viewed:', error);
    }
  }, [product]);

  // Handle adding to wishlist
  const handleAddToWishlist = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation when clicking the wishlist button
    e.stopPropagation();
    
    if (!user?.id) {
      alert('Te rog să te autentifici pentru a adăuga produse în wishlist.');
      return;
    }

    if (!product._id) {
      alert('Eroare: ID-ul produsului nu este disponibil.');
      return;
    }

    setIsAddingToWishlist(true);

    try {
      const response = await fetch(`/api/products/user/${user.id}/wishlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product._id,
          category: product.category,
          priority: 'medium'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 409) {
          alert('Produsul este deja în wishlist!');
        } else {
          throw new Error(errorData.error || 'Failed to add to wishlist');
        }
        return;
      }

      // Success notification
      alert('Produsul a fost adăugat în wishlist cu succes! 🎉');
    } catch (error) {
      console.error('Error adding to wishlist:', error);
      alert('Eroare la adăugarea în wishlist. Te rog încearcă din nou.');
    } finally {
      setIsAddingToWishlist(false);
    }
  }, [user?.id, product._id, product.category]);

  // Determine image source based on error states
  const getImageUrl = useCallback(() => {
    if (fallbackError) {
      // Both original and fallback failed, use a placeholder
      return "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMDAgNzBMMTMwIDEwMEg3MEwxMDAgNzBaTTE0MCA2MEwxNzAgOTBIMTEwTDE0MCA2MFoiIGZpbGw9IiNEMUQ1REIiLz4KPHRleHQgeD0iMTAwIiB5PSIxMzAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM2QjczODAiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIj5JbWFnZSBOb3QgRm91bmQ8L3RleHQ+Cjwvc3ZnPg==";
    }
    if (imageError) {
      // Original failed, use fallback
      return flipURL;
    }
    // Use original image or fallback if no original image
    return product.image || flipURL;
  }, [imageError, fallbackError, product.image, flipURL]);
  
  const imageUrl = getImageUrl();
  const linkUrl = `/produse/${product.brand || 'unknown'}/${product.productModel?.replace(/ /g, '-') || 'unknown'}/${product._id}`;
  const displayTitle = product.title.length > 60 ? `${product.title.substring(0, 60)}...` : product.title;

  // Fixed image error handler that prevents race conditions
  const handleImageError = useCallback(() => {
    console.warn('Failed to load product image:', imageUrl);
    
    // Use functional state updates to avoid stale closure issues
    setImageError(prevImageError => {
      setFallbackError(prevFallbackError => {
        // If we haven't tried the original image yet and it exists and is different from fallback
        if (!prevImageError && product.image && product.image !== flipURL) {
          // Original image failed, switch to fallback
          return prevFallbackError; // Don't change fallbackError state
        }
        // If original failed and we're now on fallback, or if no original image exists
        else if (prevImageError && !prevFallbackError) {
          // Fallback image failed, switch to placeholder
          return true; // Set fallbackError to true
        }
        return prevFallbackError; // No change needed
      });
      
      // Set imageError to true if we haven't already
      if (!prevImageError && product.image && product.image !== flipURL) {
        return true;
      }
      return prevImageError;
    });
  }, [imageUrl, product.image, flipURL]);

  return (
    <div className="mx-0">
      <Link 
        href={linkUrl} 
        className="product-card min-h-[490px] block hover:shadow-lg transition-shadow duration-200"
        aria-label={`View details for ${product.title}`}
        onClick={handleProductClick}
      >
        <div className="product-card_img-container border border-slate-200 dark:bg-white relative">
          {/* Optimized image loading with proper dimensions and loading strategy */}
          <Image
            src={imageUrl}
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
            onError={handleImageError}
          />
          
          {/* Wishlist button */}
          <button
            onClick={handleAddToWishlist}
            disabled={isAddingToWishlist || !user}
            className={`absolute top-2 left-2 p-2 rounded-full transition-all duration-200 ${
              user 
                ? 'bg-white/80 hover:bg-white text-gray-600 hover:text-pink-600 shadow-md hover:shadow-lg' 
                : 'bg-gray-300/80 text-gray-400 cursor-not-allowed'
            } ${isAddingToWishlist ? 'animate-pulse' : ''}`}
            title={user ? 'Adaugă în wishlist' : 'Autentifică-te pentru wishlist'}
          >
            {isAddingToWishlist ? (
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            )}
          </button>

          {/* Discount badge */}
          {hasDiscount && (
            <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              -{discountPercentage}%
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
                  // Remove the badge from DOM by setting parent display to none
                  const parent = e.currentTarget.parentElement;
                  if (parent) {
                    parent.style.display = 'none';
                  }
                }}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 p-3">
          <h3 className="product-title" title={product.title}>
            {displayTitle}
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
                {hasDiscount && (
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
};

export default ProductCard