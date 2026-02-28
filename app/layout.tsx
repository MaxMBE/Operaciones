import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { DataProvider } from "@/lib/data-context";
import { LanguageProvider } from "@/lib/i18n";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SII Operaciones",
  description: "Dashboard de gestión de servicios y proyectos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <LanguageProvider>
          <DataProvider>
            <Sidebar />
            <main className="ml-56 min-h-screen bg-background">
              <div className="p-6 max-w-7xl mx-auto">
                {children}
              </div>
            </main>
          </DataProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
