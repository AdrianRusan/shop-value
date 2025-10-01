import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import { ClerkProvider } from '@clerk/nextjs'
import ThemeProvider from './theme-provider';
import Navbar from '@/components/Navbar';

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://stockwatch.vercel.app/'),
  applicationName: "StockWatch",
  title: 'StockWatch - Retail Arbitrage Price Tracking',
  alternates: {
    canonical: 'https://stockwatch.vercel.app/',
    languages: {
      "en-US": "https://stockwatch.vercel.app/",
    },
  },
  description: 'StockWatch - Track retail prices for Amazon FBA arbitrage opportunities.',
  openGraph: {
    url: 'https://stockwatch.vercel.app/',
    title: 'StockWatch - Retail Arbitrage Price Tracking',
    description: 'StockWatch - Track retail prices for Amazon FBA arbitrage opportunities.',
    images: [
      {
        url: 'https://stockwatch.vercel.app/assets/images/stockwatch-homepage.jpg',
        width: 1901,
        height: 1051,
        alt: 'StockWatch - Home',
      }
    ],
    type: 'website',
    siteName: 'StockWatch',
    locale: 'en_US',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {

  return (
    <ClerkProvider>
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
    </ClerkProvider>
  )
}
