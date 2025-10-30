import ActionsFab from '@/components/ActionsFab';

import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Insource Mortgage Dashboard',
  description: 'Mobile-friendly CRM for mortgage pipeline (Residential & Commercial)'
}

export default function RootLayout(<ActionsFab />{ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50">{children}</body>
    </html>
  )
}
