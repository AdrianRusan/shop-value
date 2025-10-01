import Link from "next/link";

export default function PricingPage() {
  return (
    <div className="container mx-auto px-6 py-20">
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 dark:text-white-200">
          Simple, Transparent Pricing
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300">
          Start free. Upgrade when you're ready.
        </p>
      </div>
      
      <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
        {/* Free Tier */}
        <div className="border-2 border-gray-200 dark:border-gray-700 rounded-xl p-8 bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow">
          <div className="mb-6">
            <h3 className="text-2xl font-bold mb-2 dark:text-white-200">Free</h3>
            <div className="flex items-baseline mb-6">
              <span className="text-5xl font-bold dark:text-white-200">$0</span>
              <span className="text-xl text-gray-500 dark:text-gray-400 ml-2">/month</span>
            </div>
          </div>
          
          <ul className="space-y-4 mb-8">
            <li className="flex items-start">
              <span className="text-green-500 mr-3 text-xl">✅</span>
              <span className="text-gray-700 dark:text-gray-300">Track <strong>5 products</strong></span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-3 text-xl">✅</span>
              <span className="text-gray-700 dark:text-gray-300">Email alerts</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-3 text-xl">✅</span>
              <span className="text-gray-700 dark:text-gray-300">Check prices every 6 hours</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-3 text-xl">✅</span>
              <span className="text-gray-700 dark:text-gray-300">Community support</span>
            </li>
          </ul>
          
          <Link 
            href="/sign-up" 
            className="block w-full text-center py-3 px-6 border-2 border-primary text-primary font-semibold rounded-lg hover:bg-primary hover:text-white transition-colors"
          >
            Start Free
          </Link>
        </div>
        
        {/* Pro Tier */}
        <div className="border-2 border-primary rounded-xl p-8 bg-white dark:bg-gray-800 relative hover:shadow-xl transition-shadow">
          <div className="absolute -top-4 right-8 bg-primary text-white px-4 py-1 rounded-full text-sm font-semibold">
            POPULAR
          </div>
          
          <div className="mb-6">
            <h3 className="text-2xl font-bold mb-2 dark:text-white-200">Pro</h3>
            <div className="flex items-baseline mb-6">
              <span className="text-5xl font-bold dark:text-white-200">$49</span>
              <span className="text-xl text-gray-500 dark:text-gray-400 ml-2">/month</span>
            </div>
          </div>
          
          <ul className="space-y-4 mb-8">
            <li className="flex items-start">
              <span className="text-green-500 mr-3 text-xl">✅</span>
              <span className="text-gray-700 dark:text-gray-300">Track <strong>50 products</strong></span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-3 text-xl">✅</span>
              <span className="text-gray-700 dark:text-gray-300">Email alerts</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-3 text-xl">✅</span>
              <span className="text-gray-700 dark:text-gray-300">Check prices every 6 hours</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-3 text-xl">✅</span>
              <span className="text-gray-700 dark:text-gray-300">Priority support</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-3 text-xl">✅</span>
              <span className="text-gray-700 dark:text-gray-300">Early access to new features</span>
            </li>
          </ul>
          
          <Link 
            href="/sign-up" 
            className="block w-full text-center py-3 px-6 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-colors shadow-md hover:shadow-lg"
          >
            Start 14-Day Trial
          </Link>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="mt-20 max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-10 dark:text-white-200">
          Frequently Asked Questions
        </h2>
        
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
            <h3 className="font-semibold text-lg mb-2 dark:text-white-200">
              Can I upgrade or downgrade anytime?
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Yes! You can upgrade to Pro at any time or downgrade back to Free. Changes take effect immediately.
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
            <h3 className="font-semibold text-lg mb-2 dark:text-white-200">
              What retailers do you track?
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Currently we track Amazon, Walmart, and Target. More retailers coming soon!
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
            <h3 className="font-semibold text-lg mb-2 dark:text-white-200">
              How often are prices updated?
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Prices are checked every 6 hours for all plans. You'll get email alerts when profitable opportunities appear.
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
            <h3 className="font-semibold text-lg mb-2 dark:text-white-200">
              Is there a free trial for Pro?
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Yes! Pro comes with a 14-day free trial. No credit card required to start the Free plan.
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="mt-20 text-center bg-gradient-to-r from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 rounded-2xl p-12">
        <h2 className="text-3xl font-bold mb-4 dark:text-white-200">
          Ready to Start Finding Deals?
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
          Join thousands of sellers already finding profitable arbitrage opportunities with StockWatch.
        </p>
        <Link 
          href="/sign-up" 
          className="inline-block bg-primary text-white px-8 py-4 text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl hover:bg-primary/90 transition-all"
        >
          Get Started Free
        </Link>
      </div>
    </div>
  );
}
