import Link from "next/link";
import FeatureCard from "@/components/FeatureCard";

const Home = async () => {
  return (
    <>
      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 min-h-[calc(100vh-167.5px)] md:min-h-[calc(100vh-72px)] flex items-center justify-center">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 dark:text-white-200 leading-tight">
            Find Profitable Arbitrage Deals Before Your Competitors Do
          </h1>
          
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
            StockWatch monitors Amazon, Walmart, and Target 24/7. Get instant alerts 
            when price gaps appear with 20%+ ROI potential. Stop manually checking 50 sites daily.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link 
              href="/sign-up" 
              className="btn-primary px-8 py-4 text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all"
            >
              Start Free Trial - Track 5 Products Free
            </Link>
          </div>
          
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">No credit card required</p>
        </div>
      </section>
      
      {/* Features Section */}
      <section className="bg-gray-50 dark:bg-gray-900 py-20">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 dark:text-white-200">
            Everything You Need to Find Profitable Deals
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <FeatureCard 
              icon="⚡"
              title="Real-Time Alerts"
              description="Get notified within hours when profitable deals appear. Set your minimum ROI threshold (15%, 20%, 30%+). Email alerts sent straight to your inbox."
            />
            
            <FeatureCard 
              icon="🎯"
              title="Multi-Retailer Tracking"
              description="Track prices across Amazon, Walmart, and Target. See all prices in one dashboard. Identify the best buy-low-sell-high opportunities."
            />
            
            <FeatureCard 
              icon="📊"
              title="ROI Calculator Built-In"
              description="Automatic profit margin calculations. See exact ROI % for every opportunity. Sort by highest profit potential."
            />
          </div>
        </div>
      </section>
      
      {/* Social Proof */}
      <section className="py-20">
        <div className="container mx-auto px-6 text-center">
          <p className="text-2xl md:text-3xl font-semibold mb-8 dark:text-white-200">
            Join 2,000+ arbitrage sellers finding $10K+ in deals monthly
          </p>
          
          <div className="bg-gray-100 dark:bg-gray-800 p-8 rounded-lg max-w-2xl mx-auto shadow-md">
            <p className="text-lg md:text-xl italic mb-4 text-gray-700 dark:text-gray-300 leading-relaxed">
              "I closed 3 deals in my first week because I got alerts before competitors. 
              StockWatch paid for itself 10x over."
            </p>
            <p className="font-semibold text-gray-900 dark:text-white-200">- Mike T., Tampa</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary py-16">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Find Your First Deal?
          </h2>
          <p className="text-lg text-white/90 mb-8 max-w-2xl mx-auto">
            Start tracking products for free today. No credit card required.
          </p>
          <Link 
            href="/sign-up" 
            className="inline-block bg-white text-primary px-8 py-4 text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl hover:bg-gray-50 transition-all"
          >
            Get Started Free
          </Link>
        </div>
      </section>
    </>
  );
};

export default Home;
