'use client'

import React, { useState, useEffect } from 'react';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import FilterPanel, { FilterState } from '@/components/FilterPanel';
import ProductCard from '@/components/ProductCard';
import RecentlyViewed from '@/components/RecentlyViewed';
import { FunnelIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

// Mock product data for demonstration
const mockProducts = [
  {
    _id: '1',
    url: 'https://flip.ro/telefoane/samsung-galaxy-s23',
    title: 'Samsung Galaxy S23 128GB',
    currentPrice: 2999,
    originalPrice: 3499,
    priceHistory: [
      { price: 3499, date: new Date('2024-01-01') },
      { price: 3299, date: new Date('2024-02-01') },
      { price: 2999, date: new Date('2024-03-01') }
    ],
    brand: 'Samsung',
    category: 'Telefoane',
    image: '/assets/images/samsung-s23.jpg',
    currency: 'RON',
    description: 'Latest Samsung flagship with amazing camera',
    isOutOfStock: false,
    users: ['user1']
  },
  {
    _id: '2',
    url: 'https://flip.ro/telefoane/iphone-15-pro',
    title: 'iPhone 15 Pro 256GB',
    currentPrice: 5499,
    originalPrice: 5999,
    priceHistory: [
      { price: 5999, date: new Date('2024-01-01') },
      { price: 5799, date: new Date('2024-02-15') },
      { price: 5499, date: new Date('2024-03-10') }
    ],
    brand: 'Apple',
    category: 'Telefoane',
    image: '/assets/images/iphone-15-pro.jpg',
    currency: 'RON',
    description: 'Premium iPhone with titanium design',
    isOutOfStock: false,
    users: ['user2']
  },
  {
    _id: '3',
    url: 'https://flip.ro/laptopuri/macbook-air-m3',
    title: 'MacBook Air M3 13" 256GB',
    currentPrice: 7299,
    originalPrice: 7999,
    priceHistory: [
      { price: 7999, date: new Date('2024-01-15') },
      { price: 7599, date: new Date('2024-02-20') },
      { price: 7299, date: new Date('2024-03-05') }
    ],
    brand: 'Apple',
    category: 'Laptopuri',
    image: '/assets/images/macbook-air-m3.jpg',
    currency: 'RON',
    description: 'Powerful and efficient laptop with M3 chip',
    isOutOfStock: false,
    users: ['user1', 'user3']
  },
  {
    _id: '4',
    url: 'https://flip.ro/telefoane/xiaomi-14',
    title: 'Xiaomi 14 256GB',
    currentPrice: 2799,
    originalPrice: 3199,
    priceHistory: [
      { price: 3199, date: new Date('2024-01-10') },
      { price: 2999, date: new Date('2024-02-10') },
      { price: 2799, date: new Date('2024-03-01') }
    ],
    brand: 'Xiaomi',
    category: 'Telefoane',
    image: '/assets/images/xiaomi-14.jpg',
    currency: 'RON',
    description: 'Flagship Xiaomi with Leica cameras',
    isOutOfStock: true,
    users: []
  },
  {
    _id: '5',
    url: 'https://flip.ro/accesorii/airpods-pro-2',
    title: 'AirPods Pro 2nd Generation',
    currentPrice: 1299,
    originalPrice: 1499,
    priceHistory: [
      { price: 1499, date: new Date('2024-01-05') },
      { price: 1399, date: new Date('2024-02-05') },
      { price: 1299, date: new Date('2024-02-25') }
    ],
    brand: 'Apple',
    category: 'Accesorii',
    image: '/assets/images/airpods-pro-2.jpg',
    currency: 'RON',
    description: 'Premium wireless earbuds with noise cancellation',
    isOutOfStock: false,
    users: ['user1', 'user2', 'user4']
  }
];

const SearchResultsPageContent = () => {
  const searchParams = useSearchParams();
  const query = searchParams?.get('q') || '';

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(query);
  const [filteredProducts, setFilteredProducts] = useState(mockProducts);
  const [filters, setFilters] = useState<FilterState>({
    priceRange: [0, 10000],
    brands: [],
    categories: [],
    availability: [],
    discount: [0, 100],
    dateRange: { start: '', end: '' },
    sortBy: 'relevance'
  });

  useEffect(() => {
    setSearchTerm(query);
  }, [query]);

  useEffect(() => {
    applyFilters();
  }, [filters, searchTerm]);

  const applyFilters = () => {
    let products = [...mockProducts];

    // Apply search term filter
    if (searchTerm) {
      products = products.filter(product =>
        product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply price range filter
    products = products.filter(product =>
      product.currentPrice >= filters.priceRange[0] &&
      product.currentPrice <= filters.priceRange[1]
    );

    // Apply brand filter
    if (filters.brands.length > 0) {
      products = products.filter(product =>
        filters.brands.includes(product.brand)
      );
    }

    // Apply category filter
    if (filters.categories.length > 0) {
      products = products.filter(product =>
        filters.categories.includes(product.category)
      );
    }

    // Apply availability filter
    if (filters.availability.length > 0) {
      products = products.filter(product => {
        if (filters.availability.includes('În stoc') && !product.isOutOfStock) return true;
        if (filters.availability.includes('Indisponibil') && product.isOutOfStock) return true;
        return false;
      });
    }

    // Apply discount filter
    products = products.filter(product => {
      const discount = ((product.originalPrice - product.currentPrice) / product.originalPrice) * 100;
      return discount >= filters.discount[0] && discount <= filters.discount[1];
    });

    // Apply date range filter
    if (filters.dateRange.start || filters.dateRange.end) {
      products = products.filter(product => {
        // Use the most recent date from priceHistory as the product's date
        const mostRecentDate = product.priceHistory.reduce((latest, entry) => 
          new Date(entry.date) > new Date(latest.date) ? entry : latest
        ).date;
        
        const productDate = new Date(mostRecentDate);
        const startDate = filters.dateRange.start ? new Date(filters.dateRange.start) : null;
        const endDate = filters.dateRange.end ? new Date(filters.dateRange.end) : null;
        
        if (startDate && productDate < startDate) return false;
        if (endDate && productDate > endDate) return false;
        
        return true;
      });
    }

    // Apply sorting
    switch (filters.sortBy) {
      case 'price_asc':
        products.sort((a, b) => a.currentPrice - b.currentPrice);
        break;
      case 'price_desc':
        products.sort((a, b) => b.currentPrice - a.currentPrice);
        break;
      case 'discount':
        products.sort((a, b) => {
          const discountA = ((a.originalPrice - a.currentPrice) / a.originalPrice) * 100;
          const discountB = ((b.originalPrice - b.currentPrice) / b.originalPrice) * 100;
          return discountB - discountA;
        });
        break;
      case 'popularity':
        products.sort((a, b) => b.users.length - a.users.length);
        break;
      case 'newest':
        // Sort by newest using the most recent date from priceHistory
        products.sort((a, b) => {
          const mostRecentDateA = a.priceHistory.reduce((latest, entry) => 
            new Date(entry.date) > new Date(latest.date) ? entry : latest
          ).date;
          const mostRecentDateB = b.priceHistory.reduce((latest, entry) => 
            new Date(entry.date) > new Date(latest.date) ? entry : latest
          ).date;
          
          return new Date(mostRecentDateB).getTime() - new Date(mostRecentDateA).getTime();
        });
        break;
      default:
        // relevance - keep original order for demo
        break;
    }

    setFilteredProducts(products);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const url = new URL(window.location.href);
    url.searchParams.set('q', searchTerm);
    window.history.pushState({}, '', url.toString());
    applyFilters();
  };

  const getDiscountPercentage = (original: number, current: number) => {
    return Math.round(((original - current) / original) * 100);
  };

  const hasActiveFilters = () => {
    return (
      filters.brands.length > 0 ||
      filters.categories.length > 0 ||
      filters.availability.length > 0 ||
      filters.priceRange[0] > 0 ||
      filters.priceRange[1] < 10000 ||
      filters.discount[0] > 0 ||
      filters.discount[1] < 100 ||
      filters.dateRange.start ||
      filters.dateRange.end ||
      filters.sortBy !== 'relevance'
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Rezultate căutare
          </h1>
          
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="mb-4">
            <div className="relative max-w-2xl">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Caută produse..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </form>

          {/* Results Summary */}
          <div className="flex items-center justify-between">
            <p className="text-gray-600 dark:text-gray-400">
              {filteredProducts.length} rezultate
              {searchTerm && ` pentru "${searchTerm}"`}
            </p>
            
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="md:hidden flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <FunnelIcon className="w-4 h-4" />
              Filtrează
              {hasActiveFilters() && (
                <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                  !
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex gap-8">
          {/* Filter Sidebar - Desktop */}
          <div className="hidden md:block w-80 flex-shrink-0">
            <div className="sticky top-8">
              <FilterPanel
                filters={filters}
                onFiltersChange={setFilters}
                isOpen={true}
                onToggle={() => {}}
                className="!relative !transform-none !w-full !h-auto !shadow-lg !rounded-lg border border-gray-200 dark:border-gray-700"
              />
            </div>
          </div>

          {/* Products Grid */}
          <div className="flex-1">
            {/* Recently Viewed Section */}
            <RecentlyViewed 
              className="mb-8" 
              maxItems={8}
              itemWidth="w-44"
            />

            {filteredProducts.length === 0 ? (
              <div className="text-center py-12">
                <MagnifyingGlassIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Nu am găsit rezultate
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Încearcă să modifici filtrele sau termenii de căutare.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map((product) => (
                  <div key={product._id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow">
                    <div className="p-4">
                      <div className="aspect-w-16 aspect-h-9 mb-4">
                        <div className="w-full h-48 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                          <span className="text-gray-500 dark:text-gray-400 text-sm">
                            {product.brand} Logo
                          </span>
                        </div>
                      </div>
                      
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
                        {product.title}
                      </h3>
                      
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {product.description}
                      </p>
                      
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <span className="text-lg font-bold text-gray-900 dark:text-white">
                            {product.currentPrice} {product.currency}
                          </span>
                          {product.originalPrice > product.currentPrice && (
                            <>
                              <span className="text-sm text-gray-500 dark:text-gray-400 line-through ml-2">
                                {product.originalPrice} {product.currency}
                              </span>
                              <span className="text-sm text-green-600 dark:text-green-400 ml-2">
                                -{getDiscountPercentage(product.originalPrice, product.currentPrice)}%
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          product.isOutOfStock
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        }`}>
                          {product.isOutOfStock ? 'Indisponibil' : 'În stoc'}
                        </span>
                        
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {product.users.length} urmăritori
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Filter Panel */}
      <FilterPanel
        filters={filters}
        onFiltersChange={setFilters}
        isOpen={isFilterOpen}
        onToggle={() => setIsFilterOpen(!isFilterOpen)}
        className="md:hidden"
      />
    </div>
  );
};

const SearchResultsPage = () => {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Se încarcă rezultatele...</p>
        </div>
      </div>
    }>
      <SearchResultsPageContent />
    </Suspense>
  );
};

export default SearchResultsPage;