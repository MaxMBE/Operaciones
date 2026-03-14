import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LayoutShell } from "@/components/layout-shell";
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
            <LayoutShell>
              {children}
            </LayoutShell>
          </DataProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
