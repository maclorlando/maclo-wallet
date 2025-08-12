import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/lib/walletContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Crypto Wallet dApp",
  description: "A basic cryptocurrency wallet built with Next.js and TypeScript",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <WalletProvider>
          <div className="min-h-screen bg-gray-50">
            {children}
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}
