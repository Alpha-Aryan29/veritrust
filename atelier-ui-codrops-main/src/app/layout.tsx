import type { Metadata } from 'next'
import { Instrument_Sans } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/components/AuthModal'
import Preloader from '@/components/Preloader'
import { TransitionPage } from '@/components/page-transition/page-transition'
import { PixelTransition } from '@/components/pixel-transition/pixel-transition'
import { SmoothScroll } from '@/components/smooth-scroll/smooth-scroll'
import { WebglProvider } from '@/components/webgl-provider/webgl-provider'

const instrumentSans = Instrument_Sans({
  weight: ['400', '600', '700'],
  subsets: ['latin'],
  variable: '--font-instrument-sans',
})

export const metadata: Metadata = {
  title: 'VeriTrust — Decentralized Institutional Trust Registry',
  description: 'Decentralized institutional data & trust infrastructure: issue, verify, tamper-detect, and revoke signed academic and government credentials across organizational boundaries without a central authority.',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en' className={`${instrumentSans.variable} antialiased dark scroll-smooth`}>
      <body className='font-sans text-gray-100 bg-[#090b10] min-h-screen selection:bg-emerald-500/30 selection:text-white'>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
