import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LayoutShell } from "@/components/layout-shell";
import { DataProvider } from "@/lib/data-context";
import { LanguageProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SII Operations",
  description: "Service and project management dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider>
          <LanguageProvider>
            <DataProvider>
              <LayoutShell>
                {children}
              </LayoutShell>
            </DataProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
