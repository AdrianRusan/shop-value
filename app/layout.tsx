import './globals.css'
import type { Metadata } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import ThemeProvider from './theme-provider';
import Navbar from '@/components/Navbar';

const inter = Inter({ subsets: ['latin'] })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight:['300', '400', '500', '600', '700'] })

export const metadata: Metadata = {
  applicationName: "ShopValue",
  title: 'ShopValue: Your Product Data Scraper and Price Tracker',
  description: 'ShopValue: Your product data scraper and price tracker. Compare prices, analyze reviews, and track price history.',
  openGraph: {
    url: 'https://shop-value.vercel.app/',
    title: 'ShopValue: Your Product Data Scraper and Price Tracker',
    description: 'ShopValue: Your product data scraper and price tracker. Compare prices, analyze reviews, and track price history.',
    type: 'website',
    siteName: 'ShopValue',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {


  return (
      <ThemeProvider>
        <html lang="en">
          <body className={`${inter.className} dark:bg-black`}>
            <main className='max-w-10xl mx-auto'>
              <Navbar />
              {children}
              <Analytics />
            </main>
          </body>
        </html>
      </ThemeProvider>
  )
}
