import Link from "next/link";

const roles = [
  {
    title: "Партнёры",
    description:
      "Выбирайте офферы, создавайте трекинговые ссылки и отслеживайте результаты трафика.",
    href: "/docs/guides/quick-start-partner",
  },
  {
    title: "Рекламодатели",
    description:
      "Управляйте офферами, передавайте конверсии и контролируйте расходы на привлечение клиентов.",
    href: "/docs/guides/quick-start-advertiser",
  },
  {
    title: "Команда сети",
    description:
      "Настраивайте доступы, работайте с партнёрами и рекламодателями, следите за результатами сети.",
    href: "/docs/guides/quick-start-admin",
  },
];

const workflow = [
  { title: "Офферы", description: "Условия, цели и ставки" },
  { title: "Трафик", description: "Ссылки и учёт кликов" },
  { title: "Результаты", description: "Конверсии и статистика" },
];

const primaryLink =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white";
const secondaryLink =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900";

export default function Home() {
  return (
    <main className="bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto max-w-6xl space-y-12 px-4 py-10 sm:space-y-16 sm:px-6 sm:py-16 lg:px-8">
        <section className="grid items-center gap-8 lg:grid-cols-[1.35fr_1fr] lg:gap-12">
          <div className="space-y-6">
            <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
              MikiLead · CPA-платформа
            </p>
            <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Партнёрский маркетинг в одной системе
            </h1>
            <p className="max-w-xl text-base leading-7 text-zinc-600 sm:text-lg dark:text-zinc-400">
              Платформа для партнёрского маркетинга с оплатой за целевые
              действия. Объединяет партнёров, рекламодателей и команду сети.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/auth/register" className={primaryLink}>
                Создать аккаунт
              </Link>
              <Link href="/auth/login" className={secondaryLink}>
                Войти в кабинет
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold">Весь путь трафика</h2>
            <ol className="mt-6 space-y-5">
              {workflow.map((step, index) => (
                <li key={step.title} className="flex items-start gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-sm font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium">{step.title}</p>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="roles-title">
          <h2 id="roles-title" className="text-2xl font-semibold tracking-tight">
            Свой кабинет для каждой роли
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {roles.map((role) => (
              <article
                key={role.title}
                className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <h3 className="text-lg font-semibold">{role.title}</h3>
                <p className="mb-5 mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {role.description}
                </p>
                <Link
                  href={role.href}
                  className="mt-auto inline-flex items-center gap-2 self-start py-1 text-sm font-semibold underline-offset-4 hover:underline"
                >
                  Как начать <span aria-hidden="true">→</span>
                  <span className="sr-only">: {role.title}</span>
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-6 rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8 md:flex-row md:items-center md:justify-between dark:border-zinc-800 dark:bg-zinc-900">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Начните работу в MikiLead
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Создайте аккаунт партнёра или рекламодателя.
            </p>
          </div>
          <Link href="/auth/register" className={`${primaryLink} shrink-0`}>
            Создать аккаунт
          </Link>
        </section>
      </div>
    </main>
  );
}
