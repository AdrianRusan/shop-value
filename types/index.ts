export type PriceHistoryItem = {
  price: number;
  date: Date;
};

export type User = {
  email: string;
};

export type Product = {
  _id?: string;
  brand: string;
  productModel: string;
  url: string;
  source: string;
  currency: string;
  image: string;
  title: string;
  currentPrice: number;
  originalPrice: number;
  priceHistory: PriceHistoryItem[] | [];
  highestPrice: number;
  lowestPrice: number;
  averagePrice: number;
  discountRate: number;
  description?: string;
  category: string;
  reviewsCount: number;
  stars: number;
  isOutOfStock: Boolean;
  users?: User[];
  urlHash?: string;
  availability?: 'in_stock' | 'out_of_stock' | 'limited' | 'discontinued';
  tenantId?: string;
  isActive?: boolean;
  trackingStatus?: 'active' | 'paused' | 'failed' | 'archived';
  lastScrapedAt?: Date;
  nextScrapeAt?: Date;
  scraperVersion?: string;
  slug?: string;
  keywords?: string[];
  deletedAt?: Date;
};

export type NotificationType =
  | 'WELCOME'
  | 'CHANGE_OF_STOCK'
  | 'LOWEST_PRICE'
  | 'THRESHOLD_MET';

export type EmailContent = {
  subject: string;
  body: string;
};

export type EmailProductInfo = {
  title: string;
  url: string;
  image?: string;
  source?: string;
};
