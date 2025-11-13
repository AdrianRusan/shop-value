import ProductCard from '@/components/ProductCard';
import { Product } from '@/types';
import { Suspense } from 'react';
import { ProductListingSkeleton } from './LoadingSkeleton';

type ProductListingProps = {
  products: Product[];
  emptyMessage?: string;
};

export function ProductListing({ products, emptyMessage = 'Nu s-au găsit produse' }: ProductListingProps) {
  if (!products || products.length === 0) {
    return (
      <section className="trending-section">
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-lg text-gray-600 dark:text-gray-400">{emptyMessage}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="trending-section">
      <div className="flex flex-wrap gap-x-8 md:gap-x-24 lg:gap-x-7 xl:gap-x-16 gap-y-16 justify-start">
        {products.map((product: Product) => (
          <ProductCard key={product._id} product={product} />
        ))}
      </div>
    </section>
  );
}
