import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./theme-tokens.css";
import "./analytics-design-system.css";
import "./v6-8-ui.css";
import "./theme-light-surfaces.css";
import "./admin-chrome.css";
import "./admin-page-mockups.css";
import { LanguageProvider } from "@/components/language-provider";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WINIQ · Futbol Tahminleri",
  description: "WINIQ profesyonel futbol verileri, fikstür ve tahmin merkezi",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className={`${geistSans.className} min-h-full flex flex-col`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k='bet-project-theme';var t=localStorage.getItem(k);if(t!=='dark'&&t!=='light'){var m=document.cookie.match(/(?:^|; )bet-project-theme=([^;]*)/);t=m?decodeURIComponent(m[1]):'light';}if(t!=='dark')t='light';document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;}catch(e){document.documentElement.dataset.theme='light';}})();`,
          }}
        />
        <ThemeProvider>
          <LanguageProvider>{children}</LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
