import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import { ClerkProvider } from '@clerk/nextjs'
import ThemeProvider from './theme-provider';
import Navbar from '@/components/Navbar';
import ErrorBoundary from '@/components/ErrorBoundary';
import AnalyticsProvider from '@/components/providers/AnalyticsProvider';
import MonitoringSetup from '@/components/monitoring/MonitoringSetup';

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://shop-value.vercel.app/'),
  applicationName: "ShopValue",
  title: 'ShopValue - Evidenta Preturilor la Produsele Flip',
  alternates: {
    canonical: 'https://shop-value.vercel.app/',
    languages: {
      "ro-RO": "https://shop-value.vercel.app/",
    },
  },
  description: 'ShopValue - Urmareste evolutia preturilor la produsele Flip si gaseste cele mai bune oferte.',
  openGraph: {
    url: 'https://shop-value.vercel.app/',
    title: 'ShopValue - Evidenta Preturilor la Produsele Flip',
    description: 'ShopValue - Urmărește evoluția prețurilor la produsele Flip și găsește cele mai bune oferte.',
    images: [
      {
        url: 'https://shop-value.vercel.app/assets/images/shopvalue-homepage.jpg',
        width: 1901,
        height: 1051,
        alt: 'ShopValue - Acasă',
      }
    ],
    type: 'website',
    siteName: 'ShopValue',
    locale: 'ro_RO',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {

  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: '#FF6B35',
          colorText: '#1F2937',
          colorBackground: '#FFFFFF',
          colorInputBackground: '#F9FAFB',
          colorInputText: '#1F2937',
          borderRadius: '0.5rem',
        },
        elements: {
          formButtonPrimary: 'bg-primary hover:bg-primary/90 text-white',
          card: 'shadow-lg border border-gray-200',
          headerTitle: 'text-xl font-bold text-gray-900',
          headerSubtitle: 'text-gray-600',
        },
      }}
    >
      <ThemeProvider>
        <html lang="ro">
          <body className={`${inter.className} dark:bg-black`}>
            <ErrorBoundary context="app-layout">
              <AnalyticsProvider>
                <main className='max-w-10xl mx-auto'>
                  <Navbar />
                  {children}
                  <Analytics />
                </main>
                <MonitoringSetup />
              </AnalyticsProvider>
            </ErrorBoundary>
          </body>
        </html>
      </ThemeProvider>
    </ClerkProvider>
  )
}
