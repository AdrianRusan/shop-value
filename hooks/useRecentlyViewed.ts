import { useState, useEffect, useCallback } from 'react';
import { 
  getRecentlyViewed, 
  addToRecentlyViewed, 
  removeFromRecentlyViewed, 
  clearRecentlyViewed,
  subscribeToRecentlyViewed,
  getRecentlyViewedCount,
  isLocalStorageAvailable,
  RecentlyViewedItem 
} from '@/lib/recentlyViewed';
import { Product } from '@/types';

interface UseRecentlyViewedOptions {
  maxItems?: number;
  autoSync?: boolean;
}

interface UseRecentlyViewedReturn {
  items: RecentlyViewedItem[];
  count: number;
  isLoading: boolean;
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  clearAll: () => void;
  refresh: () => void;
  isStorageAvailable: boolean;
}

export function useRecentlyViewed(options: UseRecentlyViewedOptions = {}): UseRecentlyViewedReturn {
  const { maxItems = 20, autoSync = true } = options;
  
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStorageAvailable, setIsStorageAvailable] = useState(false);

  // Initialize and load data
  useEffect(() => {
    setIsStorageAvailable(isLocalStorageAvailable());
    
    if (isLocalStorageAvailable()) {
      const loadItems = () => {
        try {
          const recentItems = getRecentlyViewed();
          setItems(recentItems.slice(0, maxItems));
        } catch (error) {
          console.warn('Failed to load recently viewed items:', error);
          setItems([]);
        } finally {
          setIsLoading(false);
        }
      };

      loadItems();

      // Set up cross-tab synchronization if enabled
      if (autoSync) {
        const unsubscribe = subscribeToRecentlyViewed((updatedItems) => {
          setItems(updatedItems.slice(0, maxItems));
        });

        return unsubscribe;
      }
    } else {
      setIsLoading(false);
    }
  }, [maxItems, autoSync]);

  // Add item to recently viewed
  const addItem = useCallback((product: Product) => {
    if (!isLocalStorageAvailable()) {
      console.warn('Local storage not available, cannot add to recently viewed');
      return;
    }

    try {
      addToRecentlyViewed(product);
      
      // Update local state immediately for better UX
      setItems(prevItems => {
        const existingIndex = prevItems.findIndex(item => item.id === product._id);
        const now = Date.now();
        
        if (existingIndex !== -1) {
          // Update existing item
          const updatedItems = [...prevItems];
          const existingItem = updatedItems[existingIndex];
          updatedItems.splice(existingIndex, 1);
          updatedItems.unshift({
            ...existingItem,
            viewedAt: now,
            viewCount: existingItem.viewCount + 1,
            product: {
              _id: product._id,
              title: product.title,
              brand: product.brand,
              productModel: product.productModel,
              currentPrice: product.currentPrice,
              originalPrice: product.originalPrice,
              currency: product.currency,
              image: product.image,
              category: product.category,
              isOutOfStock: product.isOutOfStock,
              url: product.url,
              source: product.source
            }
          });
          return updatedItems.slice(0, maxItems);
        } else {
          // Add new item
          const newItem: RecentlyViewedItem = {
            id: product._id || '',
            product: {
              _id: product._id,
              title: product.title,
              brand: product.brand,
              productModel: product.productModel,
              currentPrice: product.currentPrice,
              originalPrice: product.originalPrice,
              currency: product.currency,
              image: product.image,
              category: product.category,
              isOutOfStock: product.isOutOfStock,
              url: product.url,
              source: product.source
            },
            viewedAt: now,
            viewCount: 1
          };
          return [newItem, ...prevItems].slice(0, maxItems);
        }
      });
    } catch (error) {
      console.warn('Failed to add item to recently viewed:', error);
    }
  }, [maxItems]);

  // Remove item from recently viewed
  const removeItem = useCallback((productId: string) => {
    if (!isLocalStorageAvailable()) {
      console.warn('Local storage not available, cannot remove from recently viewed');
      return;
    }

    try {
      removeFromRecentlyViewed(productId);
      setItems(prevItems => prevItems.filter(item => item.id !== productId));
    } catch (error) {
      console.warn('Failed to remove item from recently viewed:', error);
    }
  }, []);

  // Clear all recently viewed items
  const clearAll = useCallback(() => {
    if (!isLocalStorageAvailable()) {
      console.warn('Local storage not available, cannot clear recently viewed');
      return;
    }

    try {
      clearRecentlyViewed();
      setItems([]);
    } catch (error) {
      console.warn('Failed to clear recently viewed:', error);
    }
  }, []);

  // Refresh items from storage
  const refresh = useCallback(() => {
    if (!isLocalStorageAvailable()) return;

    try {
      const recentItems = getRecentlyViewed();
      setItems(recentItems.slice(0, maxItems));
    } catch (error) {
      console.warn('Failed to refresh recently viewed items:', error);
    }
  }, [maxItems]);

  // Get current count
  const count = isLocalStorageAvailable() ? getRecentlyViewedCount() : 0;

  return {
    items,
    count,
    isLoading,
    addItem,
    removeItem,
    clearAll,
    refresh,
    isStorageAvailable
  };
}