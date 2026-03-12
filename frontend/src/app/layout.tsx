import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AppNavbar } from "@/components/AppNavbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MikiLead — CPA сеть для арбитража трафика",
  description:
    "MikiLead — CPA сеть для вебмастеров и арбитражников. Высокие выплаты, проверенные офферы, удобная платформа для заработка на трафике.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <>
            <AppNavbar />
            <Suspense fallback={<AppPageFallback />}>{children}</Suspense>
          </>
        </Providers>
      </body>
    </html>
  );
}

function AppPageFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4 py-10 text-sm text-zinc-500 dark:text-zinc-400">
      Загружаем страницу...
    </div>
  );
}
