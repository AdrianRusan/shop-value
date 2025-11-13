export function ProductCardSkeleton() {
  return (
    <div className="animate-pulse flex flex-col gap-4 min-w-[250px]">
      <div className="w-[250px] h-[250px] bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
      <div className="flex flex-col gap-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mt-2"></div>
      </div>
    </div>
  );
}

export function TrendingSectionSkeleton() {
  return (
    <section className="trending-section">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-6"></div>
      <div className="flex flex-wrap gap-x-8 md:gap-x-24 lg:gap-x-7 xl:gap-x-16 gap-y-16 justify-start">
        {[...Array(12)].map((_, index) => (
          <ProductCardSkeleton key={index} />
        ))}
      </div>
    </section>
  );
}

export function ProductListingSkeleton() {
  return (
    <section className="trending-section">
      <div className="flex flex-wrap gap-x-8 md:gap-x-24 lg:gap-x-7 xl:gap-x-16 gap-y-16 justify-start">
        {[...Array(50)].map((_, index) => (
          <ProductCardSkeleton key={index} />
        ))}
      </div>
    </section>
  );
}
