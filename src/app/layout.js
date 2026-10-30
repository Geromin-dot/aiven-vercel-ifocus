import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

import BackgroundBlobs from "@/components/BackgroundBlobs";
import Sidebar from "@/components/Sidebar";
import { Providers } from "@/components/Providers";
import GlobalTimer from "@/components/GlobalTimer";
import PwaRegistrar from "@/components/PwaRegistrar";
import ConcurrentSessionGuard from "@/components/ConcurrentSessionGuard";

export const metadata = {
  title: "iFocus | Smart Flash Cards",
  description: "iFocus AI Auto-Deck Generator - paste notes or upload PDFs to generate custom flashcard decks.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "iFocus",
  },
  icons: {
    icon: [
      { url: "/applogo.png", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport = {
  themeColor: "#5f8f5e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable}`}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="iFocus" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/png" href="/applogo.png" />
      </head>
      <body className={inter.className}>
        <BackgroundBlobs />
        <Providers>
          <div className="app-container">
            <Sidebar />
            <main>
              {children}
            </main>
          </div>
          <GlobalTimer />
          <ConcurrentSessionGuard />
          <PwaRegistrar />
        </Providers>
      </body>
    </html>
  );
}
