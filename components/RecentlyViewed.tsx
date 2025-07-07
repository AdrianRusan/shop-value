'use client'

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon, ClockIcon } from '@heroicons/react/24/outline';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { Product } from '@/types';

interface RecentlyViewedProps {
  className?: string;
  showClearAll?: boolean;
  maxItems?: number;
  itemWidth?: string;
}

const RecentlyViewed: React.FC<RecentlyViewedProps> = ({ 
  className = '', 
  showClearAll = true, 
  maxItems = 10,
  itemWidth = 'w-48'
}) => {
  const { items, isLoading, removeItem, clearAll } = useRecentlyViewed({ maxItems });
  const [showScrollLeft, setShowScrollLeft] = useState(false);
  const [showScrollRight, setShowScrollRight] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check scroll indicators
    const container = containerRef.current;
    if (container) {
      const updateScrollIndicators = () => {
        setShowScrollLeft(container.scrollLeft > 0);
        setShowScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth);
      };

      updateScrollIndicators();
      container.addEventListener('scroll', updateScrollIndicators);
      window.addEventListener('resize', updateScrollIndicators);

      return () => {
        container.removeEventListener('scroll', updateScrollIndicators);
        window.removeEventListener('resize', updateScrollIndicators);
      };
    }
  }, [items]);

  const handleRemoveItem = (productId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    removeItem(productId);
  };

  const handleClearAll = () => {
    clearAll();
  };

  const scrollLeft = () => {
    const container = containerRef.current;
    if (container) {
      container.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    const container = containerRef.current;
    if (container) {
      container.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) {
      return `${days} zi${days > 1 ? 'le' : ''} în urmă`;
    } else if (hours > 0) {
      return `${hours} oră${hours > 1 ? 'e' : ''} în urmă`;
    } else if (minutes > 0) {
      return `${minutes} minut${minutes > 1 ? 'e' : ''} în urmă`;
    } else {
      return 'Acum';
    }
  };

  const getProductUrl = (item: any) => {
    const product = item.product as Partial<Product>;
    
    // Ensure we have a valid product ID
    if (!product._id || typeof product._id !== 'string' || product._id.trim().length === 0) {
      console.warn('Product missing valid ID for URL generation', { product });
      return '/produse'; // Fallback to products listing page
    }
    
    // Safely handle productModel - ensure it's a string before calling replace
    const productModel = typeof product.productModel === 'string' 
      ? product.productModel.replace(/ /g, '-') 
      : 'unknown';
    
    const brand = product.brand || 'unknown';
    
    return `/produse/${brand}/${productModel}/${product._id}`;
  };

  const getDiscountPercentage = (original: number, current: number) => {
    if (!original || original <= current) return 0;
    return Math.round(((original - current) / original) * 100);
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className={`recently-viewed-section ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <ClockIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        </div>
        <div className="flex gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className={`${itemWidth} flex-shrink-0 bg-gray-200 dark:bg-gray-700 rounded-lg h-64 animate-pulse`}
            />
          ))}
        </div>
      </div>
    );
  }

  // Don't render if no items
  if (items.length === 0) {
    return null;
  }

  return (
    <div className={`recently-viewed-section ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ClockIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Vizualizate recent
          </h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            ({items.length})
          </span>
        </div>
        
        {showClearAll && items.length > 0 && (
          <button
            onClick={handleClearAll}
            className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
          >
            Șterge tot
          </button>
        )}
      </div>

      <div className="relative">
        {/* Left scroll button */}
        {showScrollLeft && (
          <button
            onClick={scrollLeft}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-gray-800 shadow-lg rounded-full p-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            aria-label="Scroll left"
          >
            <ChevronLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        )}

        {/* Right scroll button */}
        {showScrollRight && (
          <button
            onClick={scrollRight}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-gray-800 shadow-lg rounded-full p-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            aria-label="Scroll right"
          >
            <ChevronRightIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
        )}

        {/* Products container */}
        <div
          ref={containerRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {items.filter(item => {
            // Filter out items with invalid IDs to prevent rendering issues
            const product = item.product as Partial<Product>;
            if (!product._id || typeof product._id !== 'string' || product._id.trim().length === 0) {
              console.warn('Filtering out recently viewed item with invalid ID', { item });
              return false;
            }
            return true;
          }).map((item) => {
            const product = item.product as Partial<Product>;
            const hasDiscount = product.originalPrice && product.currentPrice && product.originalPrice > product.currentPrice;
            const discountPercentage = hasDiscount ? getDiscountPercentage(product.originalPrice!, product.currentPrice!) : 0;

            return (
              <div
                key={item.id}
                className={`${itemWidth} flex-shrink-0 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700 relative group`}
              >
                {/* Remove button */}
                <button
                  onClick={(e) => handleRemoveItem(item.id, e)}
                  className="absolute top-2 right-2 z-10 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove from recently viewed"
                >
                  <XMarkIcon className="w-3 h-3" />
                </button>

                <Link
                  href={getProductUrl(item)}
                  className="block p-3"
                >
                  {/* Product image */}
                  <div className="aspect-square mb-3 relative overflow-hidden rounded-md bg-gray-100 dark:bg-gray-700">
                    {product.image ? (
                      <Image
                        src={product.image}
                        alt={product.title || 'Product'}
                        fill
                        className="object-contain"
                        sizes="200px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                        <span className="text-xs">No Image</span>
                      </div>
                    )}
                    
                    {/* Discount badge */}
                    {hasDiscount && (
                      <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                        -{discountPercentage}%
                      </div>
                    )}
                  </div>

                  {/* Product info */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 leading-tight">
                      {product.title || 'Untitled Product'}
                    </h3>
                    
                    <div className="space-y-1">
                      {/* Price */}
                      <div className="flex flex-col">
                        {hasDiscount && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 line-through">
                            {product.originalPrice} {product.currency || 'RON'}
                          </span>
                        )}
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {product.currentPrice} {product.currency || 'RON'}
                        </span>
                      </div>
                      
                      {/* Stock status */}
                      <div className={`text-xs px-2 py-1 rounded-full inline-block ${
                        product.isOutOfStock
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      }`}>
                        {product.isOutOfStock ? 'Indisponibil' : 'În stoc'}
                      </div>
                    </div>

                    {/* View info */}
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex justify-between">
                      <span>{formatTimeAgo(item.viewedAt)}</span>
                      {item.viewCount > 1 && (
                        <span>{item.viewCount} vizualizări</span>
                      )}
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};

export default RecentlyViewed;