import ProductCard from "./ProductCard";
import { Product } from "@/types";

const SampleProductsSection = () => {
  // Sample products data for demonstration (not real user data)
  const sampleProducts: Product[] = [
    {
      _id: "sample_1",
      url: "https://www.flip.ro/telefon-samsung-galaxy-s24/p/32454321",
      source: "flip.ro",
      image: "/assets/images/hero-1.svg",
      title: "Samsung Galaxy S24, 256GB, Phantom Black",
      productModel: "Galaxy S24",
      currentPrice: 3899.99,
      originalPrice: 4399.99,
      priceHistory: [
        { price: 4399.99, date: new Date("2024-01-01") },
        { price: 4199.99, date: new Date("2024-01-15") },
        { price: 3899.99, date: new Date() }
      ],
      lowestPrice: 3899.99,
      highestPrice: 4399.99,
      averagePrice: 4099.99,
      discountRate: 11,
      description: "Telefon Samsung Galaxy S24 cu memorie de 256GB",
      category: "Telefoane Mobile",
      brand: "Samsung",
      currency: "RON",
      isOutOfStock: false,
      users: [],
      reviewsCount: 150,
      stars: 4.5
    },
    {
      _id: "sample_2", 
      url: "https://www.flip.ro/laptop-asus-vivobook/p/32454322",
      source: "flip.ro",
      image: "/assets/images/hero-2.svg",
      title: "ASUS VivoBook 15, Intel i5, 8GB RAM, 512GB SSD",
      productModel: "VivoBook 15",
      currentPrice: 2299.99,
      originalPrice: 2699.99,
      priceHistory: [
        { price: 2699.99, date: new Date("2024-01-01") },
        { price: 2499.99, date: new Date("2024-01-10") },
        { price: 2299.99, date: new Date() }
      ],
      lowestPrice: 2299.99,
      highestPrice: 2699.99,
      averagePrice: 2499.99,
      discountRate: 15,
      description: "Laptop ASUS VivoBook 15 cu procesor Intel i5",
      category: "Laptopuri",
      brand: "ASUS", 
      currency: "RON",
      isOutOfStock: false,
      users: [],
      reviewsCount: 89,
      stars: 4.3
    },
    {
      _id: "sample_3",
      url: "https://www.flip.ro/iphone-15-pro/p/32454323", 
      source: "flip.ro",
      image: "/assets/images/hero-3.svg",
      title: "iPhone 15 Pro, 128GB, Natural Titanium",
      productModel: "iPhone 15 Pro",
      currentPrice: 5499.99,
      originalPrice: 5999.99,
      priceHistory: [
        { price: 5999.99, date: new Date("2024-01-01") },
        { price: 5749.99, date: new Date("2024-01-20") },
        { price: 5499.99, date: new Date() }
      ],
      lowestPrice: 5499.99,
      highestPrice: 5999.99,
      averagePrice: 5749.99,
      discountRate: 8,
      description: "iPhone 15 Pro cu memorie de 128GB în culoarea Natural Titanium",
      category: "Telefoane Mobile",
      brand: "Apple",
      currency: "RON", 
      isOutOfStock: false,
      users: [],
      reviewsCount: 234,
      stars: 4.7
    },
    {
      _id: "sample_4",
      url: "https://www.flip.ro/ipad-air/p/32454324",
      source: "flip.ro",
      image: "/assets/images/hero-4.svg", 
      title: "iPad Air 10.9, WiFi, 64GB, Space Gray",
      productModel: "iPad Air",
      currentPrice: 2899.99,
      originalPrice: 3199.99,
      priceHistory: [
        { price: 3199.99, date: new Date("2024-01-01") },
        { price: 3049.99, date: new Date("2024-01-12") },
        { price: 2899.99, date: new Date() }
      ],
      lowestPrice: 2899.99,
      highestPrice: 3199.99,
      averagePrice: 3049.99,
      discountRate: 9,
      description: "iPad Air cu ecran de 10.9 inch și conexiune WiFi",
      category: "Tablete",
      brand: "Apple",
      currency: "RON",
      isOutOfStock: false,
      users: [],
      reviewsCount: 67,
      stars: 4.4
    }
  ];

  const dateOptions: Intl.DateTimeFormatOptions = { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric', 
    hour: 'numeric', 
    minute: 'numeric', 
    timeZone: 'Europe/Bucharest' 
  };

  return (
    <section className="trending-section">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <h2 className="section-text mb-4 sm:mb-0">Produse Populare</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Descoperă cele mai urmărite produse de pe platformă
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {sampleProducts.map((product) => (
          <div key={product._id} className="flex flex-col space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Actualizat: {new Date(product.priceHistory[product.priceHistory.length - 1].date).toLocaleString('ro-RO', dateOptions)}
            </p>
            <ProductCard product={product} />
          </div>
        ))}
      </div>

      {/* Call to Action for Authentication */}
      <div className="mt-12 text-center bg-gradient-to-r from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 rounded-2xl p-8">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Vrei să urmărești prețurile acestor produse?
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-2xl mx-auto">
          Creează un cont gratuit pentru a primi alerte când prețurile scad și pentru a urmări istoricul prețurilor produselor tale preferate.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="/sign-up"
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Înregistrează-te Gratuit
          </a>
          <a
            href="/sign-in"
            className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 dark:border-gray-600 text-base font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013 3v1" />
            </svg>
            Am deja cont
          </a>
        </div>
      </div>
    </section>
  );
};

export default SampleProductsSection; 