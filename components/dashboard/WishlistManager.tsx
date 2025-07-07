'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import Image from 'next/image';
import Link from 'next/link';
// TODO: Fix react-beautiful-dnd module resolution issue
// import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { QuickActionsPanel } from './QuickActionsPanel';
import FormatPrices from '@/components/FormatPrices';

// Helper function to parse structured user notes with backward compatibility
function parseStructuredNotes(userNotes?: string) {
  if (!userNotes) {
    return { category: undefined, priority: 'medium', notes: undefined };
  }
  
  try {
    // Try to parse as JSON first (new format)
    const parsed = JSON.parse(userNotes);
    return {
      category: parsed.category || undefined,
      priority: parsed.priority || 'medium',
      notes: parsed.notes || undefined
    };
  } catch {
    // Fallback to old pipe-delimited format for backward compatibility
    const category = userNotes.includes('category:') 
      ? userNotes.split('category:')[1].split('|')[0] 
      : undefined;
    
    const priority = userNotes.includes('priority:')
      ? userNotes.split('priority:')[1].split('|')[0]
      : 'medium';
    
    // Extract notes by removing category and priority metadata
    let notes = userNotes
      .replace(/category:[^|]*\|?/g, '')
      .replace(/priority:[^|]*\|?/g, '')
      .replace(/^\|+|\|+$/g, '') // Remove leading/trailing pipes
      .trim();
    
    return {
      category: category || undefined,
      priority,
      notes: notes || undefined
    };
  }
}

// Helper function to calculate price change percentage correctly
function calculatePriceChangePercentage(currentPrice: number, originalPrice: number): number {
  if (typeof currentPrice !== 'number' || typeof originalPrice !== 'number' || 
      isNaN(currentPrice) || isNaN(originalPrice)) {
    return 0;
  }
  
  if (originalPrice === 0) {
    // If original price is 0, we can't calculate percentage change
    // Return 100% if current price > 0, otherwise 0%
    return currentPrice > 0 ? 100 : 0;
  }
  
  return ((currentPrice - originalPrice) / originalPrice) * 100;
}

// Types
interface WishlistItem {
  _id: string;
  userId: string;
  productId: {
    _id: string;
    title: string;
    brand: string;
    category: string;
    currentPrice: number;
    originalPrice: number;
    currency: string;
    image: string;
    isOutOfStock: boolean;
    url: string;
    priceHistory: Array<{
      price: number;
      date: Date;
    }>;
    lastScrapedAt: Date;
    updatedAt: Date;
  };
  addedAt: Date;
  userNotes?: string;
  personalRating?: number;
  isPublic: boolean;
  priceChangePercentage: number;
}

interface WishlistResponse {
  items: WishlistItem[];
  itemsByCategory: { [key: string]: WishlistItem[] };
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  summary: {
    totalItems: number;
    categories: number;
    averagePriceChange: number;
  };
}

interface WishlistManagerProps {
  onItemAdded?: () => void;
  onItemRemoved?: () => void;
  compact?: boolean;
}

export function WishlistManager({ onItemAdded, onItemRemoved, compact = false }: WishlistManagerProps) {
  const { user } = useUser();
  const [wishlistData, setWishlistData] = useState<WishlistResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'category'>('category');
  const [sortBy, setSortBy] = useState<'addedAt' | 'price' | 'title' | 'rating'>('addedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Combined filter state for QuickActionsPanel
  const [combinedFilters, setCombinedFilters] = useState({
    category: selectedCategory,
    status: 'all',
    sortBy: sortBy,
    sortOrder: sortOrder,
    search: searchTerm
  });

  // Fetch wishlist data
  const fetchWishlist = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        sortBy,
        sortOrder,
        limit: '100' // Get all items for better management
      });

      const response = await fetch(`/api/products/user/${user.id}/wishlist?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch wishlist: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error('Failed to fetch wishlist');
      }

      setWishlistData(data.data);
    } catch (error) {
      console.error('Error fetching wishlist:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [user?.id, sortBy, sortOrder]);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  // Sync filter states with combinedFilters
  useEffect(() => {
    setCombinedFilters({
      category: selectedCategory,
      status: 'all',
      sortBy: sortBy,
      sortOrder: sortOrder,
      search: searchTerm
    });
  }, [selectedCategory, sortBy, sortOrder, searchTerm]);

  // Filter and search items
  const filteredItems = useMemo(() => {
    if (!wishlistData) return [];

    let items = wishlistData.items;

    // Filter by category
    if (selectedCategory !== 'all') {
      items = items.filter((item: WishlistItem) => {
        const { category } = parseStructuredNotes(item.userNotes);
        const categoryName = category || 'Uncategorized';
        return categoryName === selectedCategory;
      });
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      items = items.filter((item: WishlistItem) => 
        item.productId.title.toLowerCase().includes(term) ||
        item.productId.brand.toLowerCase().includes(term) ||
        item.productId.category.toLowerCase().includes(term) ||
        (item.userNotes && item.userNotes.toLowerCase().includes(term))
      );
    }

    return items;
  }, [wishlistData, selectedCategory, searchTerm]);

  // Handle bulk actions for wishlist (functions defined inline to avoid dependency issues)
  const handleBulkAction = useCallback(async (action: string, itemIds: string[]) => {
    if (!user?.id || itemIds.length === 0) return;

    try {
      switch (action) {
        case 'delete':
          if (!confirm(`Sigur vrei să elimini ${itemIds.length} produse din wishlist?`)) return;
          const deleteResponse = await fetch(`/api/products/user/${user.id}/wishlist?trackingIds=${itemIds.join(',')}&softDelete=true`, {
            method: 'DELETE'
          });
          if (!deleteResponse.ok) throw new Error('Failed to remove items');
          await fetchWishlist();
          onItemRemoved?.();
          break;
          
        case 'startTracking':
          for (const itemId of itemIds) {
            const item = wishlistData?.items.find(i => i._id === itemId);
            if (item) {
              const response = await fetch(`/api/products/user/${user.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  productId: item.productId._id,
                  trackingReason: 'purchase_intent',
                  userNotes: item.userNotes,
                  personalRating: item.personalRating,
                  alertSettings: {
                    priceDecrease: true,
                    priceIncrease: false,
                    backInStock: true,
                    frequency: 'immediate'
                  }
                })
              });
              if (response.ok) {
                // Remove from wishlist after successful tracking
                await fetch(`/api/products/user/${user.id}/wishlist?trackingIds=${itemId}&softDelete=true`, {
                  method: 'DELETE'
                });
              }
            }
          }
          await fetchWishlist();
          break;
          
        case 'addToWishlist':
          // Already in wishlist, no action needed
          break;
          
        default:
          console.warn('Unknown bulk action for wishlist:', action);
      }
      setSelectedItems(new Set());
    } catch (error) {
      console.error('Wishlist bulk action failed:', error);
      alert('Eroare la executarea acțiunii în masă. Te rog încearcă din nou.');
    }
  }, [user?.id, wishlistData?.items, fetchWishlist, onItemRemoved]);

  // Handle filter changes from QuickActionsPanel
  const handleFilterChange = useCallback((newFilters: any) => {
    setCombinedFilters(newFilters);
    if (newFilters.search !== searchTerm) {
      setSearchTerm(newFilters.search);
    }
    if (newFilters.sortBy !== sortBy) {
      setSortBy(newFilters.sortBy);
    }
    if (newFilters.sortOrder !== sortOrder) {
      setSortOrder(newFilters.sortOrder);
    }
    if (newFilters.category !== selectedCategory) {
      setSelectedCategory(newFilters.category);
    }
  }, [searchTerm, sortBy, sortOrder, selectedCategory]);

  // Handle item selection
  const handleItemSelect = useCallback((itemId: string, selected: boolean) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(itemId);
      } else {
        newSet.delete(itemId);
      }
      return newSet;
    });
  }, []);

  // Add item to wishlist
  const handleAddToWishlist = async (productId: string, category?: string, notes?: string, rating?: number) => {
    if (!user?.id) return;

    try {
      const response = await fetch(`/api/products/user/${user.id}/wishlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          category,
          userNotes: notes,
          personalRating: rating,
          priority: 'medium'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to add item to wishlist');
      }

      await fetchWishlist();
      onItemAdded?.();
      setShowAddModal(false);
    } catch (error) {
      console.error('Error adding to wishlist:', error);
      alert('Eroare la adăugarea în wishlist. Te rog încearcă din nou.');
    }
  };

  // Remove items from wishlist
  const handleRemoveItems = async (trackingIds: string[]) => {
    if (!user?.id || trackingIds.length === 0) return;

    if (!confirm(`Sigur vrei să elimini ${trackingIds.length} produse din wishlist?`)) return;

    try {
      const response = await fetch(`/api/products/user/${user.id}/wishlist?trackingIds=${trackingIds.join(',')}&softDelete=true`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to remove items');
      }

      await fetchWishlist();
      onItemRemoved?.();
      setSelectedItems(new Set());
    } catch (error) {
      console.error('Error removing items:', error);
      alert('Eroare la eliminarea produselor. Te rog încearcă din nou.');
    }
  };

  // Update item category or notes
  const handleUpdateItem = async (trackingId: string, updates: { category?: string; userNotes?: string; personalRating?: number }) => {
    if (!user?.id) return;

    try {
      const response = await fetch(`/api/products/user/${user.id}/wishlist`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackingId,
          ...updates
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update item');
      }

      await fetchWishlist();
      setEditingItem(null);
    } catch (error) {
      console.error('Error updating item:', error);
      alert('Eroare la actualizarea produsului. Te rog încearcă din nou.');
    }
  };

  // Organize wishlist (drag and drop)
  const handleDragEnd = async (result: any) => {
    setIsDragging(false);
    
    if (!result.destination || !wishlistData) return;

    const { source, destination } = result;
    
    // If dropped in the same position, do nothing
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    // Extract category from droppable ID
    const sourceCategory = source.droppableId.replace('category-', '');
    const destinationCategory = destination.droppableId.replace('category-', '');

    // Prepare organization data
    const itemsToUpdate = [];
    
    // If moving between categories
    if (sourceCategory !== destinationCategory) {
      // Fix: Search in full items list instead of filtered items to handle cases when filters are active
      const draggedItem = wishlistData.items.find((item: WishlistItem) => item._id === result.draggableId);
      if (draggedItem) {
        itemsToUpdate.push({
          trackingId: draggedItem._id,
          // Fix: Set category to undefined (not empty string) for 'Uncategorized' to match parseStructuredNotes logic
          category: destinationCategory === 'Uncategorized' ? undefined : destinationCategory,
          order: destination.index
        });
      }
    }

    // Update organization on server
    if (itemsToUpdate.length > 0) {
      try {
        await fetch(`/api/products/user/${user?.id}/wishlist`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: itemsToUpdate })
        });

        await fetchWishlist();
      } catch (error) {
        console.error('Error organizing wishlist:', error);
      }
    }
  };

  // Move to tracking (convert wishlist item to tracked product)
  const handleMoveToTracking = async (item: WishlistItem) => {
    if (!user?.id) return;

    try {
      // First add to tracking with different reason
      const response = await fetch(`/api/products/user/${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: item.productId._id,
          trackingReason: 'purchase_intent',
          userNotes: item.userNotes,
          personalRating: item.personalRating,
          alertSettings: {
            priceDecrease: true,
            priceIncrease: false,
            backInStock: true,
            frequency: 'immediate'
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to add to tracking');
      }

      // Remove from wishlist
      await handleRemoveItems([item._id]);
      
      alert('Produsul a fost adăugat la urmărire cu alerte activate!');
    } catch (error) {
      console.error('Error moving to tracking:', error);
      alert('Eroare la mutarea în urmărire. Te rog încearcă din nou.');
    }
  };

  // Get available categories
  const categories = useMemo(() => {
    if (!wishlistData) return [];
    return ['all', ...Object.keys(wishlistData.itemsByCategory)];
  }, [wishlistData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400">Se încarcă wishlist-ul...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 dark:text-red-400 mb-4">
          <p className="text-lg font-semibold">Eroare la încărcarea wishlist-ului</p>
          <p className="text-sm">{error}</p>
        </div>
        <button
          onClick={() => fetchWishlist()}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          Încearcă din nou
        </button>
      </div>
    );
  }

  if (!wishlistData || wishlistData.items.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 dark:text-gray-400 mb-4">
          <h3 className="text-lg font-semibold mb-2">Wishlist-ul tău este gol</h3>
          <p>Adaugă produse în wishlist pentru a le urmări și organiza mai târziu.</p>
        </div>
        <Link
          href="/produse"
          className="inline-block px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          Explorează produse
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Actions Panel */}
      {!compact && (
        <QuickActionsPanel
          selectedProducts={selectedItems}
          onBulkAction={handleBulkAction}
          onFilterChange={handleFilterChange}
          onRefresh={fetchWishlist}
          activeTab="wishlist"
          filters={combinedFilters}
        />
      )}

      {/* Header and Controls */}
      {!compact && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {wishlistData.summary.totalItems}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Produse în wishlist
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {wishlistData.summary.categories}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Categorii
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <div className={`text-2xl font-bold ${
                wishlistData.summary.averagePriceChange > 0 
                  ? 'text-red-600' 
                  : wishlistData.summary.averagePriceChange < 0 
                    ? 'text-green-600' 
                    : 'text-gray-900 dark:text-white'
              }`}>
                {wishlistData.summary.averagePriceChange > 0 ? '+' : ''}{wishlistData.summary.averagePriceChange.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Schimbare medie preț
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              {/* Search */}
              <div className="flex-1 max-w-md">
                <input
                  type="text"
                  placeholder="Caută în wishlist..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Filters and Actions */}
              <div className="flex gap-2 flex-wrap">
                {/* Category Filter */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {category === 'all' ? 'Toate categoriile' : category}
                    </option>
                  ))}
                </select>

                {/* Sort */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="addedAt">Data adăugării</option>
                  <option value="price">Preț</option>
                  <option value="title">Numele produsului</option>
                  <option value="rating">Rating personal</option>
                </select>

                {/* View Mode */}
                <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                  {['grid', 'list', 'category'].map(mode => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode as any)}
                      className={`px-3 py-1 text-sm rounded transition-colors ${
                        viewMode === mode
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {mode === 'grid' ? '⊞' : mode === 'list' ? '☰' : '📁'}
                    </button>
                  ))}
                </div>

                {/* Bulk Actions */}
                {selectedItems.size > 0 && (
                  <button
                    onClick={() => handleRemoveItems(Array.from(selectedItems))}
                    className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                  >
                    Elimină ({selectedItems.size})
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

            {/* Wishlist Content */}
      {/* TODO: Re-enable drag and drop functionality after fixing react-beautiful-dnd */}
      {viewMode === 'category' ? (
        // Category-based view (drag and drop temporarily disabled)
        <div className="space-y-6">
          {Object.entries(wishlistData.itemsByCategory)
            .filter(([categoryName]) => selectedCategory === 'all' || selectedCategory === categoryName)
            .map(([categoryName, categoryItems]) => (
              <div key={categoryName} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {categoryName} ({categoryItems.length})
                  </h3>
                </div>
                
                <div className={`grid gap-4 p-4 ${
                  compact ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                }`}>
                  {categoryItems
                    .filter(item => !searchTerm || 
                      item.productId.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      item.productId.brand.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map((item) => (
                      <WishlistItemCard
                        key={item._id}
                        item={item}
                        compact={compact}
                        selected={selectedItems.has(item._id)}
                        onSelect={(selected) => {
                          const newSelected = new Set(selectedItems);
                          if (selected) {
                            newSelected.add(item._id);
                          } else {
                            newSelected.delete(item._id);
                          }
                          setSelectedItems(newSelected);
                        }}
                        onEdit={() => setEditingItem(item)}
                        onRemove={() => handleRemoveItems([item._id])}
                        onMoveToTracking={() => handleMoveToTracking(item)}
                      />
                    ))}
                </div>
              </div>
            ))}
        </div>
      ) : (
        // Grid or List view
        <div className={`grid gap-4 ${
          viewMode === 'grid' 
            ? (compact ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4')
            : 'grid-cols-1'
        }`}>
          {filteredItems.map((item) => (
            <WishlistItemCard
              key={item._id}
              item={item}
              compact={compact}
              listView={viewMode === 'list'}
              selected={selectedItems.has(item._id)}
              onSelect={(selected) => {
                const newSelected = new Set(selectedItems);
                if (selected) {
                  newSelected.add(item._id);
                } else {
                  newSelected.delete(item._id);
                }
                setSelectedItems(newSelected);
              }}
              onEdit={() => setEditingItem(item)}
              onRemove={() => handleRemoveItems([item._id])}
              onMoveToTracking={() => handleMoveToTracking(item)}
            />
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingItem && (
        <EditItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={(updates) => handleUpdateItem(editingItem._id, updates)}
        />
      )}
    </div>
  );
}

// Individual wishlist item card component
interface WishlistItemCardProps {
  item: WishlistItem;
  compact?: boolean;
  listView?: boolean;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
  onEdit?: () => void;
  onRemove?: () => void;
  onMoveToTracking?: () => void;
}

function WishlistItemCard({ 
  item, 
  compact = false, 
  listView = false, 
  selected = false,
  onSelect,
  onEdit, 
  onRemove, 
  onMoveToTracking 
}: WishlistItemCardProps) {
  // Extract category and priority from userNotes
  const { category, priority } = parseStructuredNotes(item.userNotes);
  
  // Calculate accurate price change percentage
  const priceChangePercentage = calculatePriceChangePercentage(
    item.productId.currentPrice, 
    item.productId.originalPrice
  );
  
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100 dark:bg-red-900/20';
      case 'medium': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
      case 'low': return 'text-green-600 bg-green-100 dark:bg-green-900/20';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700';
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden ${
      listView ? 'flex' : ''
    }`}>
      {/* Checkbox for selection */}
      {onSelect && (
        <div className="absolute top-2 left-2 z-10">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(e.target.checked)}
            className="w-4 h-4 text-primary bg-white border-gray-300 rounded focus:ring-primary focus:ring-2"
          />
        </div>
      )}

      {/* Product Image */}
      <div className={`${listView ? 'w-48 flex-shrink-0' : 'aspect-square'} relative`}>
        <Image
          src={item.productId.image}
          alt={item.productId.title}
          fill
          className="object-cover"
          sizes={listView ? '192px' : compact ? '(max-width: 768px) 100vw, 50vw' : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw'}
        />
        {item.productId.isOutOfStock && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <span className="text-white font-semibold text-sm">Stoc epuizat</span>
          </div>
        )}
        
        {/* Priority indicator */}
        <div className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-semibold ${getPriorityColor(priority)}`}>
          {priority === 'high' ? 'Urgent' : priority === 'medium' ? 'Normal' : 'Mai târziu'}
        </div>
      </div>

      {/* Product Details */}
      <div className={`p-4 ${listView ? 'flex-1' : ''}`}>
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2 text-sm">
            {item.productId.title}
          </h3>
          <div className="flex space-x-1 ml-2">
            {onEdit && (
              <button
                onClick={onEdit}
                className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                title="Editează"
              >
                ✏️
              </button>
            )}
            {onMoveToTracking && (
              <button
                onClick={onMoveToTracking}
                className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                title="Adaugă la urmărire"
              >
                👁️
              </button>
            )}
            {onRemove && (
              <button
                onClick={onRemove}
                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                title="Elimină din wishlist"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          {item.productId.brand} • {category || 'Uncategorized'}
        </div>

        {/* Rating */}
        {item.personalRating && (
          <div className="flex items-center mb-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                className={`text-sm ${
                  star <= item.personalRating! ? 'text-yellow-500' : 'text-gray-300'
                }`}
              >
                ★
              </span>
            ))}
          </div>
        )}

        {/* Price Information */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              <FormatPrices num={item.productId.currentPrice} /> {item.productId.currency}
            </div>
            {item.productId.originalPrice > item.productId.currentPrice && (
              <div className="text-sm text-gray-500 line-through">
                <FormatPrices num={item.productId.originalPrice} /> {item.productId.currency}
              </div>
            )}
          </div>
          <div className={`text-sm font-semibold ${
            priceChangePercentage > 0 
              ? 'text-red-600' 
              : priceChangePercentage < 0 
                ? 'text-green-600' 
                : 'text-gray-500'
          }`}>
            {priceChangePercentage > 0 ? '+' : ''}{priceChangePercentage.toFixed(1)}%
          </div>
        </div>

        {/* User Notes */}
        {(() => {
          const { notes } = parseStructuredNotes(item.userNotes);
          return notes && (
            <div className="text-xs text-gray-600 dark:text-gray-400 italic mb-2 line-clamp-2">
              "{notes}"
            </div>
          );
        })()}

        {/* Action Buttons */}
        <div className="flex space-x-2 text-xs">
          <Link
            href={item.productId.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-3 py-1 bg-primary text-white rounded hover:bg-primary/90 transition-colors text-center"
          >
            Vezi produs
          </Link>
          {onMoveToTracking && (
            <button
              onClick={onMoveToTracking}
              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              Urmărește
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Edit item modal component
interface EditItemModalProps {
  item: WishlistItem;
  onClose: () => void;
  onSave: (updates: { category?: string; userNotes?: string; personalRating?: number }) => void;
}

function EditItemModal({ item, onClose, onSave }: EditItemModalProps) {
  const { category: parsedCategory, notes: parsedNotes } = parseStructuredNotes(item.userNotes);
  
  const [category, setCategory] = useState(parsedCategory || '');
  const [notes, setNotes] = useState(parsedNotes || '');
  const [rating, setRating] = useState(item.personalRating || 0);

  const handleSave = () => {
    onSave({
      category: category || undefined,
      userNotes: notes || undefined,
      personalRating: rating || undefined
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Editează produsul din wishlist
        </h2>

        <div className="space-y-4">
          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Categorie
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="ex: Electronice, Cărți, etc."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notițe personale
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adaugă notițe despre acest produs..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              rows={3}
            />
          </div>

          {/* Rating */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Rating personal
            </label>
            <div className="flex space-x-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star === rating ? 0 : star)}
                  className={`text-2xl transition-colors ${
                    star <= rating ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex space-x-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Anulează
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Salvează
          </button>
        </div>
      </div>
    </div>
  );
}