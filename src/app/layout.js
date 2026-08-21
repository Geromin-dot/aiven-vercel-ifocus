import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

import BackgroundBlobs from "@/components/BackgroundBlobs";
import Sidebar from "@/components/Sidebar";
import { Providers } from "@/components/Providers";

export const metadata = {
  title: "iFocus | Smart Flash Cards",
  description: "iFocus AI Auto-Deck Generator — paste notes or upload PDFs to generate custom flashcard decks.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable}`}>
      <body className={inter.className}>
        <BackgroundBlobs />
        <Providers>
          <div className="app-container">
            <Sidebar />
            <main>
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
