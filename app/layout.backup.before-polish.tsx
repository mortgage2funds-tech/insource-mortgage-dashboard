import './globals.css';

export const metadata = {
  title: 'Insource Mortgage Dashboard',
  description: 'Mobile-friendly CRM for mortgage pipeline (Residential & Commercial)',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50">{children}</body>
    </html>
  );
}
