import { Product } from '@/types';

// Configuration constants
const STORAGE_KEY = 'shopvalue_recently_viewed';
const MAX_ITEMS = 20;
const STORAGE_VERSION = '1.0';

// Types
export interface RecentlyViewedItem {
  id: string;
  product: Partial<Product>;
  viewedAt: number;
  viewCount: number;
}

export interface RecentlyViewedData {
  version: string;
  items: RecentlyViewedItem[];
  lastUpdated: number;
}

// Storage event for cross-tab synchronization
let storageEventListeners: ((data: RecentlyViewedData) => void)[] = [];

// Initialize storage event listener
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const data = JSON.parse(e.newValue) as RecentlyViewedData;
        storageEventListeners.forEach(listener => listener(data));
      } catch (error) {
        console.warn('Failed to parse recently viewed data from storage event:', error);
      }
    }
  });
}

/**
 * Clean up invalid items from the recently viewed list
 */
function cleanupInvalidItems(items: RecentlyViewedItem[]): RecentlyViewedItem[] {
  const validItems = items.filter(item => {
    // Check if item has valid ID
    if (!item.id || typeof item.id !== 'string' || item.id.trim().length === 0) {
      console.warn('Removing invalid recently viewed item: missing or invalid ID', { item });
      return false;
    }
    
    // Check if item has valid product data
    if (!item.product || typeof item.product !== 'object') {
      console.warn('Removing invalid recently viewed item: missing product data', { item });
      return false;
    }
    
    return true;
  });
  
  return validItems;
}

/**
 * Get recently viewed products from local storage
 */
export function getRecentlyViewed(): RecentlyViewedItem[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const data: RecentlyViewedData = JSON.parse(stored);
    
    // Version check - migrate if needed
    if (data.version !== STORAGE_VERSION) {
      return migrateData(data);
    }
    
    // Clean up old items (older than 30 days)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    let validItems = data.items.filter(item => item.viewedAt > thirtyDaysAgo);
    
    // Clean up invalid items (items with missing/invalid IDs)
    const beforeCleanup = validItems.length;
    validItems = cleanupInvalidItems(validItems);
    const afterCleanup = validItems.length;
    
    // Save back to storage if items were removed
    if (validItems.length !== data.items.length || beforeCleanup !== afterCleanup) {
      console.info(`Cleaned up recently viewed items: ${data.items.length - validItems.length} items removed`);
      saveRecentlyViewed(validItems);
    }
    
    return validItems;
  } catch (error) {
    console.warn('Failed to get recently viewed products:', error);
    return [];
  }
}

/**
 * Validate if a product has a valid ID for recently viewed tracking
 */
function hasValidProductId(product: Product): boolean {
  return Boolean(product._id && typeof product._id === 'string' && product._id.trim().length > 0);
}

/**
 * Generate a fallback ID for products without valid IDs (as last resort)
 */
function generateFallbackId(product: Product): string {
  // Use a combination of available product data to create a unique identifier
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  const productInfo = [
    product.title?.slice(0, 10),
    product.brand,
    product.productModel?.slice(0, 10),
    product.currentPrice?.toString()
  ].filter(Boolean).join('-') || 'unknown';
  
  return `fallback-${productInfo}-${timestamp}-${random}`;
}

/**
 * Add a product to recently viewed list
 */
export function addToRecentlyViewed(product: Product): void {
  if (typeof window === 'undefined') return;
  
  // Validate product has required data
  if (!product || typeof product !== 'object') {
    console.warn('Cannot add invalid product to recently viewed');
    return;
  }

  // Skip products without valid IDs - they're likely incomplete/corrupted data
  if (!hasValidProductId(product)) {
    console.warn('Cannot add product to recently viewed: missing or invalid ID', {
      productId: product._id,
      productTitle: product.title
    });
    return;
  }
  
  try {
    const items = getRecentlyViewed();
    const now = Date.now();
    const productId = product._id!; // We know it's valid from the check above
    
    // Check if product already exists
    const existingIndex = items.findIndex(item => item.id === productId);
    
    if (existingIndex !== -1) {
      // Update existing item - move to top and increment view count
      const existingItem = items[existingIndex];
      items.splice(existingIndex, 1);
      items.unshift({
        ...existingItem,
        viewedAt: now,
        viewCount: existingItem.viewCount + 1,
        product: sanitizeProductForStorage(product)
      });
    } else {
      // Add new item to the beginning
      items.unshift({
        id: productId,
        product: sanitizeProductForStorage(product),
        viewedAt: now,
        viewCount: 1
      });
    }
    
    // Limit the number of items
    const limitedItems = items.slice(0, MAX_ITEMS);
    
    saveRecentlyViewed(limitedItems);
  } catch (error) {
    console.warn('Failed to add product to recently viewed:', error);
  }
}

/**
 * Remove a product from recently viewed list
 */
export function removeFromRecentlyViewed(productId: string): void {
  if (typeof window === 'undefined') return;
  
  // Validate productId
  if (!productId || typeof productId !== 'string' || productId.trim().length === 0) {
    console.warn('Cannot remove product from recently viewed: invalid product ID', { productId });
    return;
  }
  
  try {
    const items = getRecentlyViewed();
    const filteredItems = items.filter(item => item.id !== productId);
    
    if (filteredItems.length !== items.length) {
      saveRecentlyViewed(filteredItems);
    }
  } catch (error) {
    console.warn('Failed to remove product from recently viewed:', error);
  }
}

/**
 * Clear all recently viewed products
 */
export function clearRecentlyViewed(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(STORAGE_KEY);
    notifyListeners([]);
  } catch (error) {
    console.warn('Failed to clear recently viewed products:', error);
  }
}

/**
 * Get recently viewed products count
 */
export function getRecentlyViewedCount(): number {
  return getRecentlyViewed().length;
}

/**
 * Subscribe to recently viewed changes (for cross-tab synchronization)
 */
export function subscribeToRecentlyViewed(callback: (items: RecentlyViewedItem[]) => void): () => void {
  const listener = (data: RecentlyViewedData) => {
    callback(data.items);
  };
  
  storageEventListeners.push(listener);
  
  // Return unsubscribe function
  return () => {
    storageEventListeners = storageEventListeners.filter(l => l !== listener);
  };
}

/**
 * Private helper: Save recently viewed items to local storage
 */
function saveRecentlyViewed(items: RecentlyViewedItem[]): void {
  try {
    const data: RecentlyViewedData = {
      version: STORAGE_VERSION,
      items,
      lastUpdated: Date.now()
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    notifyListeners(items);
  } catch (error) {
    console.warn('Failed to save recently viewed products:', error);
  }
}

/**
 * Private helper: Notify listeners of changes
 */
function notifyListeners(items: RecentlyViewedItem[]): void {
  // Note: Storage event only fires for other tabs, so we manually notify for same-tab updates
  // Create RecentlyViewedData object to match the expected listener signature
  const data: RecentlyViewedData = {
    version: STORAGE_VERSION,
    items,
    lastUpdated: Date.now()
  };
  
  // Notify all registered listeners
  storageEventListeners.forEach(listener => {
    try {
      listener(data);
    } catch (error) {
      console.warn('Failed to notify recently viewed listener:', error);
    }
  });
}

/**
 * Private helper: Sanitize product data for storage (keep only essential fields)
 */
function sanitizeProductForStorage(product: Product): Partial<Product> {
  return {
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
  };
}

/**
 * Private helper: Migrate data from older versions
 */
function migrateData(oldData: any): RecentlyViewedItem[] {
  try {
    // Handle migration from older versions if needed
    // For now, just clear and start fresh
    console.info('Migrating recently viewed data to new version');
    return [];
  } catch (error) {
    console.warn('Failed to migrate recently viewed data:', error);
    return [];
  }
}

/**
 * Check if local storage is available
 */
export function isLocalStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get storage usage statistics
 */
export function getStorageStats(): { itemCount: number; estimatedSize: number; maxItems: number } {
  const items = getRecentlyViewed();
  const estimatedSize = JSON.stringify(items).length;
  
  return {
    itemCount: items.length,
    estimatedSize,
    maxItems: MAX_ITEMS
  };
}

/**
 * Export validation function for testing purposes
 * @internal - for testing only
 */
export function _testValidateProductId(product: Product): boolean {
  return hasValidProductId(product);
}

/**
 * Export cleanup function for testing purposes  
 * @internal - for testing only
 */
export function _testCleanupInvalidItems(items: RecentlyViewedItem[]): RecentlyViewedItem[] {
  return cleanupInvalidItems(items);
}