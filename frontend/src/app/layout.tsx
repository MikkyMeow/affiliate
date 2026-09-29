import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/AppShell";
import { AppNavbar } from "@/components/AppNavbar";

export const metadata: Metadata = {
  title: "MikiLead — CPA-платформа",
  description:
    "CPA-платформа для партнёров, рекламодателей и команды сети. Офферы, учёт кликов и конверсий, статистика в одном кабинете.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>
          <div className="min-h-screen bg-white dark:bg-black">
            <AppNavbar />
            <AppShell>
              <Suspense fallback={<AppPageFallback />}>{children}</Suspense>
            </AppShell>
          </div>
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
