export interface ProductData {
  asin?: string;
  title: string;
  price: number;
  available: boolean;
  imageUrl: string;
  url: string;
}

export interface MultiRetailerPrices {
  product: ProductData;
  prices: {
    amazon: number | null;
    walmart: number | null;
    target: number | null;
  };
  urls: {
    amazon: string;
    walmart: string | null;
    target: string | null;
  };
}

export interface ScraperConfig {
  timeout: number;
  retries: number;
  useProxy: boolean;
}
