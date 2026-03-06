import Image from "next/image";
import { BackendMessage } from "../components/BackendMessage";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 font-sans dark:bg-zinc-950">
      <main className="flex w-full max-w-3xl flex-col gap-10 rounded-2xl bg-white p-10 shadow-xl dark:bg-black">
        <div className="flex items-center gap-3">
          <Image
            className="dark:invert"
            src="/next.svg"
            alt="Next.js logo"
            width={80}
            height={16}
            priority
          />
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            Монорепо affilate
          </span>
        </div>
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Тест интеграции backend ↔ frontend
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            Ниже выводится сообщение, которое приходит из Express-сервера.
            Сейчас запрос идёт на <code className="rounded bg-zinc-100 px-1 text-sm dark:bg-zinc-900">/api/message</code>.
          </p>
        </div>
        <BackendMessage />
      </main>
    </div>
  );
}
