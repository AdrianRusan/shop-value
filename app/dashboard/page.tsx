import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { connectToDB } from '@/lib/mongoose';
import Product from '@/lib/models/product.model';
import User from '@/lib/models/user.model';
import { AddProductButton } from '@/components/dashboard/AddProductButton';
import { ProductTable } from '@/components/dashboard/ProductTable';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  await connectToDB();

  // Fetch user data
  const user = await User.findOne({ clerkId: userId }).lean();
  
  // Fetch products sorted by ROI descending
  const products = await Product.find({ userId })
    .sort({ roiPercentage: -1 })
    .lean();

  // Convert MongoDB documents to plain objects
  const plainProducts = products.map(p => ({
    ...p,
    _id: p._id.toString(),
    createdAt: p.createdAt?.toISOString(),
    lastScrapedAt: p.lastScrapedAt?.toISOString(),
    lastAlertSentAt: p.lastAlertSentAt?.toISOString(),
    prices: {
      amazon: p.prices?.amazon ? {
        price: p.prices.amazon.price,
        url: p.prices.amazon.url,
        lastChecked: p.prices.amazon.lastChecked?.toISOString()
      } : undefined,
      walmart: p.prices?.walmart ? {
        price: p.prices.walmart.price,
        url: p.prices.walmart.url,
        lastChecked: p.prices.walmart.lastChecked?.toISOString()
      } : undefined,
      target: p.prices?.target ? {
        price: p.prices.target.price,
        url: p.prices.target.url,
        lastChecked: p.prices.target.lastChecked?.toISOString()
      } : undefined,
    }
  }));

  // Calculate usage stats
  const productsTracked = products.length;
  const maxProducts = user?.usage?.maxProducts || 5;
  const planName = user?.subscription?.plan || 'free';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Your Tracked Products
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Monitor prices across Amazon, Walmart, and Target
              </p>
            </div>
            <AddProductButton />
          </div>

          {/* Stats Bar */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Products Tracked</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {productsTracked} / {maxProducts === -1 ? '∞' : maxProducts}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Current Plan</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white capitalize">
                  {planName}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Best ROI Today</div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {products.length > 0 && products[0].roiPercentage 
                    ? `${products[0].roiPercentage.toFixed(1)}%`
                    : '0.0%'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Products Table */}
        <ProductTable products={plainProducts as any} />

        {/* Upgrade CTA (for free users near limit) */}
        {planName === 'free' && productsTracked >= maxProducts * 0.8 && (
          <div className="mt-8 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-blue-600 dark:text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-1">
                  Running out of product slots?
                </h3>
                <p className="text-blue-800 dark:text-blue-200 mb-3">
                  Upgrade to Pro and track up to 50 products with priority support.
                </p>
                <a
                  href="/pricing"
                  className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
                >
                  View Plans
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
