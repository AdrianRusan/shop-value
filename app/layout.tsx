import './globals.css'
import type { Metadata } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import ThemeProvider from './theme-provider';
import Navbar from '@/components/Navbar';

const inter = Inter({ subsets: ['latin'] })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight:['300', '400', '500', '600', '700'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://shop-value.vercel.app/'),
  colorScheme: 'dark light',
  applicationName: "ShopValue",
  title: 'ShopValue - Evidenta Preturilor la Produsele Flip',
  alternates: {
    canonical: 'https://shop-value.vercel.app/',
    languages:{
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
      <ThemeProvider>
        <html lang="ro">
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
