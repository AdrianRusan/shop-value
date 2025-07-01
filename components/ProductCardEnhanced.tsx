'use client';

import { Product } from "@/types";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
// Using HTML symbols instead of icon library to avoid dependencies

interface TrackingInfo {
  isTracked: boolean;
  userNotes?: string;
  personalRating?: number;
  alertSettings?: {
    priceDecrease: boolean;
    priceIncrease: boolean;
    backInStock: boolean;
    threshold?: number;
  };
  addedAt?: Date;
  priceChangePercentage?: number;
}

interface Props {
  product: Product;
  trackingInfo?: TrackingInfo;
  showTrackingControls?: boolean;
  onTrackingToggle?: (productId: string, isTracked: boolean) => Promise<void>;
  onUpdateTracking?: (productId: string, updates: Partial<TrackingInfo>) => Promise<void>;
}

const ProductCardEnhanced = ({ 
  product, 
  trackingInfo, 
  showTrackingControls = true,
  onTrackingToggle,
  onUpdateTracking 
}: Props) => {
  const { user, isSignedIn } = useUser();
  const [isTracking, setIsTracking] = useState(trackingInfo?.isTracked || false);
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);

  const flipURL = `/assets/images/flip.jpg`;
  const productImage = product.image || flipURL;

  // Calculate price change
  const priceChangePercentage = trackingInfo?.priceChangePercentage || 
    ((product.currentPrice - product.originalPrice) / product.originalPrice) * 100;

  const isPriceUp = priceChangePercentage > 0;
  const isPriceDown = priceChangePercentage < 0;

  // Handle tracking toggle
  const handleTrackingToggle = async () => {
    if (!isSignedIn || !onTrackingToggle) return;
    
    setIsLoading(true);
    try {
      await onTrackingToggle(product._id!, !isTracking);
      setIsTracking(!isTracking);
    } catch (error) {
      console.error('Error toggling tracking:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle quick rating
  const handleQuickRating = async (rating: number) => {
    if (!isSignedIn || !onUpdateTracking) return;
    
    try {
      await onUpdateTracking(product._id!, { personalRating: rating });
    } catch (error) {
      console.error('Error updating rating:', error);
    }
  };

  return (
    <div className="group relative mx-0 transition-all duration-300 hover:shadow-lg">
      {/* Tracking Indicator */}
      {isSignedIn && isTracking && (
        <div className="absolute top-2 left-2 z-10 bg-blue-500 text-white px-2 py-1 rounded-full text-xs font-medium">
          Urmărești
        </div>
      )}

      {/* Price Change Indicator */}
      {trackingInfo && Math.abs(priceChangePercentage) > 0.01 && (
        <div className={`absolute top-2 right-2 z-10 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
          isPriceDown ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {isPriceDown ? <span>📉</span> : <span>📈</span>}
          {Math.abs(priceChangePercentage).toFixed(1)}%
        </div>
      )}

      <Link 
        href={`/produse/${product.brand}/${product.productModel?.replace(/ /g, '-') || 'unknown'}/${product._id}`} 
        className="product-card min-h-[490px] block"
      >
        <div className="product-card_img-container border border-slate-200 dark:bg-white relative">
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

          {/* Quick Actions Overlay */}
          {isSignedIn && showTrackingControls && (
            <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    handleTrackingToggle();
                  }}
                  disabled={isLoading}
                  className={`p-2 rounded-full transition-colors ${
                    isTracking 
                      ? 'bg-red-500 hover:bg-red-600 text-white' 
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={isTracking ? 'Oprește urmărirea' : 'Începe urmărirea'}
                >
                  <span>❤️</span>
                </button>

                {isTracking && trackingInfo?.alertSettings && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      setShowQuickActions(!showQuickActions);
                    }}
                    className="p-2 rounded-full bg-yellow-500 hover:bg-yellow-600 text-white"
                    title="Setări alerte"
                  >
                    {trackingInfo.alertSettings.priceDecrease ? <span>🔔</span> : <span>🔕</span>}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="product-title">
            {product.title}
          </h3>

          {/* User Rating */}
          {isTracking && trackingInfo?.personalRating && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-600 dark:text-gray-400">Rating personal:</span>
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    className={
                      star <= trackingInfo.personalRating! 
                        ? 'text-yellow-500' 
                        : 'text-gray-300'
                    }
                  >
                    ⭐
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* User Notes Preview */}
          {isTracking && trackingInfo?.userNotes && (
            <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
              📝 {trackingInfo.userNotes}
            </div>
          )}

          <div className="flex justify-between items-center">
            <p className="flex h-[6vh] text-black dark:text-white-200 opacity-75 capitalize text-lg text-center items-center">
              {product.category}
            </p>
            
            {product.isOutOfStock ? (
              <p className="text-sm text-primary font-semibold">
                Stoc Epuizat
              </p>
            ) : (
              <div className="flex flex-col whitespace-nowrap">
                {product.originalPrice > 0 && product.originalPrice !== product.currentPrice && (
                  <p className="text-sm text-black opacity-75 dark:text-white-200 line-through">
                    <span>{product.originalPrice} </span>
                    <span>{product?.currency}</span>
                  </p>
                )}
                <div className="flex items-center gap-1">
                  <p className="text-black text-lg font-semibold dark:text-white-200">
                    <span>{product.currentPrice} </span>
                    <span>{product?.currency}</span>
                  </p>
                  {isPriceDown && (
                    <span className="text-green-500">📉</span>
                  )}
                  {isPriceUp && (
                    <span className="text-red-500">📈</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Tracking Metadata */}
          {isTracking && trackingInfo?.addedAt && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Urmărești din {new Date(trackingInfo.addedAt).toLocaleDateString('ro-RO')}
            </div>
          )}
        </div>
      </Link>

      {/* Quick Actions Panel */}
      {showQuickActions && isTracking && (
        <div className="absolute top-full left-0 right-0 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 mt-1">
          <div className="space-y-2">
            <div className="text-sm font-medium">Rating rapid:</div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => handleQuickRating(star)}
                  className="hover:scale-110 transition-transform"
                >
                  <span
                    className={
                      star <= (trackingInfo?.personalRating || 0)
                        ? 'text-yellow-500' 
                        : 'text-gray-300 hover:text-yellow-400'
                    }
                  >
                    ⭐
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductCardEnhanced;