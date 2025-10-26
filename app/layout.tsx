
import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mortgage Ops — Pro Dashboard v2',
  description: 'Mobile-friendly CRM for mortgage pipeline (Residential & Commercial)'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50">{children}</body>
    </html>
  )
}
