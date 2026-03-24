import Link from "next/link";

const roleCards = [
  {
    title: "Для affiliate",
    badge: "Партнёры",
    description:
      "Быстро находят офферы, прогревают трафик и получают выплаты без боли.",
    points: [
      "каталог и условия офферов",
      "генерация tracking ссылок",
      "статистика по кликам и конверсиям",
      "прозрачные выплаты",
    ],
  },
  {
    title: "Для advertiser",
    badge: "Рекламодатели",
    description:
      "Запускают кампании, контролируют качество и видят реальный ROI.",
    points: [
      "настройка и запуск офферов",
      "контроль источников трафика",
      "оперативные отчёты по конверсиям",
      "бюджеты и лимиты",
    ],
  },
  {
    title: "Для networks / owners",
    badge: "Владельцы сети",
    description:
      "Управляют всей платформой, ролями и антифродом с одного экрана.",
    points: [
      "кабинеты и права доступа",
      "модерация партнёров и рекламодателей",
      "антифрод и контроль выплат",
      "аналитика и биллинг",
    ],
  },
];

const featureList = [
  {
    title: "Click tracking",
    description: "Моментальная фиксация переходов со всех источников.",
  },
  {
    title: "Conversion tracking",
    description: "S2S и пиксели, которые не теряют события.",
  },
  {
    title: "Postback интеграции",
    description: "Принимаем и отправляем постбеки без костылей.",
  },
  {
    title: "Smartlinks",
    description: "Автоматическое распределение трафика по правилам.",
  },
  {
    title: "Anti-fraud",
    description: "Дубли, боты и подозрительные IP ловятся сразу.",
  },
  {
    title: "Детальные отчёты",
    description: "Срезы по офферам, гео, устройствам и менеджерам.",
  },
  {
    title: "Payout management",
    description: "Планы выплат, статусы и экспорты для бухгалтерии.",
  },
  {
    title: "Role-based access",
    description: "Гибко ограничиваем, кто что видит и редактирует.",
  },
];

const advertiserFlow = [
  "Создаёте оффер с KPI, payout и ограничениями по трафику.",
  "Открываете доступ проверенным партнёрам и задаёте лимиты.",
  "Следите за кликами и конверсиями, отсекаете мусорный трафик.",
  "Подтверждаете лиды, запускаете постбеки и управляете выплатами.",
  "Анализируете отчёты, регулируете ставки и расширяете каналы.",
];

const partnerFlow = [
  "Получаете приглашение в кабинет и видите доступные офферы.",
  "Генерируете tracking ссылку или smartlink под каждый источник.",
  "Гоните трафик и в реальном времени видите клики, лиды, approve.",
  "Принимаете постбеки, оптимизируете связки и исключаете слив.",
  "Запрашиваете выплаты и фиксируете историю взаимодействия.",
];

const screenCards = [
  {
    title: "Dashboard",
    description: "Пульс сети: клики, лиды, конверсии, динамика выплат.",
    tag: "Мониторинг",
  },
  {
    title: "Offers",
    description: "Условия, таргетинги, статусы и лимиты по каждому офферу.",
    tag: "Каталог",
  },
  {
    title: "Reports",
    description: "Глубокие срезы по источникам, гео, девайсам и менеджерам.",
    tag: "Аналитика",
  },
];

const advantagePoints = [
  {
    title: "Быстрый трекинг",
    description:
      "События обрабатываются на своих серверах без сторонних очередей.",
  },
  {
    title: "Детальная аналитика",
    description: "Готовые отчёты и конструктор для нестандартных вопросов.",
  },
  {
    title: "Гибкие права доступа",
    description: "Ограничивайте офферы и выплаты по ролям и менеджерам.",
  },
  {
    title: "Масштабируемая архитектура",
    description: "Горизонтально масштабируемая схема — выдержит рост сети.",
  },
  {
    title: "Прозрачные выплаты",
    description: "История статусов, подтверждения и экспорты в бухгалтерию.",
  },
  {
    title: "Self-hosted / private",
    description:
      "Запуск в своём периметре без зависимости от внешних платформ.",
  },
];

const integrations = [
  "Postback / S2S",
  "Webhooks",
  "API",
  "CSV export",
  "Telegram / Email уведомления",
];

const securityPoints = [
  "Role-based permissions",
  "Audit logs и отслеживание действий",
  "Fraud monitoring и антибот",
  "IP / UA / duplicate detection",
  "Безопасный API доступ по ключам",
];

export default function Home() {
  return (
    <div className="bg-slate-950 text-slate-100">
      <div className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#1e3a8a33,transparent_45%),radial-gradient(circle_at_bottom,#0ea5e933,transparent_40%)]" />
        <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-900">
              AT
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
                Affiliate tech
              </p>
              <p className="text-base font-semibold text-white">
                Performance Platform
              </p>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-slate-200 md:flex">
            <Link href="#features" className="transition hover:text-white">
              Возможности
            </Link>
            <Link href="#roles" className="transition hover:text-white">
              Для кого
            </Link>
            <Link href="#screens" className="transition hover:text-white">
              Интерфейс
            </Link>
            <Link href="/auth/login" className="transition hover:text-white">
              Войти
            </Link>
            <Link
              href="/auth/register"
              className="rounded-full border border-white/30 px-4 py-2 font-medium text-white transition hover:border-white"
            >
              Запросить демо
            </Link>
          </nav>
        </header>
        <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 pb-24 pt-10">
          <section className="flex flex-col gap-12 rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur xl:flex-row xl:items-center">
            <div className="flex-1 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-1 text-sm text-slate-200">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Платформа трекинга для сетей, рекламодателей и партнёров
              </div>
              <div className="space-y-4">
                <h1 className="text-4xl font-semibold leading-tight text-white md:text-5xl">
                  Платформа affiliate-трекинга
                </h1>
                <p className="text-lg text-slate-200">
                  От клика до выплаты в одном месте: трекинг переходов и
                  конверсий, постбеки, умные ссылки, антифрод, аналитика и
                  контроль выплат. Без маркетинговой пены — только функции,
                  которые нужны B2B.
                </p>
              </div>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <Link
                  href="/auth/login"
                  className="flex-1 rounded-full bg-white px-6 py-3 text-center text-base font-semibold text-slate-900 transition hover:bg-zinc-100"
                >
                  Войти
                </Link>
                <Link
                  href="/auth/register"
                  className="flex-1 rounded-full border border-white/30 px-6 py-3 text-center text-base font-semibold text-white transition hover:border-white"
                >
                  Запросить демо
                </Link>
              </div>
              <div>
                <Link
                  href="#features"
                  className="text-sm font-medium text-cyan-300 hover:text-cyan-200"
                >
                  Посмотреть возможности →
                </Link>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-4 rounded-2xl bg-slate-900/60 p-6 shadow-[0_30px_100px_-60px_rgba(14,165,233,0.8)]">
              <div className="flex items-center justify-between">
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
                  Flow
                </p>
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                  click → track → conversion → report
                </span>
              </div>
              <div className="space-y-4 text-sm text-slate-200">
                {[
                  "1. Click — партнёр отправляет трафик",
                  "2. Track — система фиксирует параметры",
                  "3. Conversion — постбек подтверждает лид",
                  "4. Report — аналитика показывает результат",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/5 p-3"
                  >
                    <span className="mt-1 h-2 w-2 rounded-full bg-cyan-300" />
                    <p>{item}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-white/10 bg-gradient-to-tr from-cyan-500/10 to-emerald-500/10 p-4 text-sm text-slate-100">
                <p className="font-semibold text-white">Дашборд в цифрах</p>
                <p className="text-slate-300">
                  Клики, лиды, approve rate и выплаты обновляются в реальном
                  времени.
                </p>
              </div>
            </div>
          </section>

          <section id="roles" className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
                  Для кого
                </p>
                <h2 className="text-3xl font-semibold text-white">
                  Каждому кабинету — свои сценарии
                </h2>
              </div>
              <p className="text-sm text-slate-300 md:max-w-sm">
                Три роли покрывают всю сеть: партнёры получают доступ к офферам,
                рекламодатели контролируют трафик, а владельцы платформы
                управляют доступами и антифродом.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {roleCards.map((card) => (
                <div
                  key={card.title}
                  className="flex flex-col rounded-2xl border border-white/10 bg-slate-900/40 p-6"
                >
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                    {card.badge}
                  </span>
                  <h3 className="mt-3 text-2xl font-semibold text-white">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-300">
                    {card.description}
                  </p>
                  <ul className="mt-4 space-y-2 text-sm text-slate-200">
                    {card.points.map((point) => (
                      <li key={point} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-300" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section id="features" className="space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
                  Ключевые возможности
                </p>
                <h2 className="text-3xl font-semibold text-white">
                  Только то, что реально используют
                </h2>
              </div>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {featureList.map((feature) => (
                <div
                  key={feature.title}
                  className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/50 p-5"
                >
                  <h3 className="text-2xl font-semibold text-white">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-slate-300">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
                  Как это работает
                </p>
                <h2 className="text-3xl font-semibold text-white">
                  Разные роли — разные сценарии
                </h2>
              </div>
              <p className="text-sm text-slate-300 md:max-w-md">
                Рекламодатели запускают офферы и держат контроль над качеством,
                партнёры точно понимают, что сделать, чтобы привести лид и
                получить выплату.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">
                    Flow рекламодателя
                  </p>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
                    Управление офферами
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {advertiserFlow.map((step, index) => (
                    <div
                      key={step}
                      className="flex items-start gap-4 rounded-2xl border border-white/5 bg-white/5 p-4"
                    >
                      <span className="text-2xl font-semibold text-cyan-200">
                        {index + 1}
                      </span>
                      <p className="text-sm text-slate-100">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">
                    Flow партнёра
                  </p>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
                    Привод и выплаты
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {partnerFlow.map((step, index) => (
                    <div
                      key={step}
                      className="flex items-start gap-4 rounded-2xl border border-white/5 bg-white/5 p-4"
                    >
                      <span className="text-2xl font-semibold text-emerald-200">
                        {index + 1}
                      </span>
                      <p className="text-sm text-slate-100">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section id="screens" className="space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
                  Интерфейс
                </p>
                <h2 className="text-3xl font-semibold text-white">
                  Показываем живые экраны
                </h2>
              </div>
              <p className="text-sm text-slate-300 md:max-w-sm">
                Без космических мокапов — реальные вкладки, которые видят
                пользователи: дашборд, офферы и отчёты.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {screenCards.map((screen) => (
                <div
                  key={screen.title}
                  className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-6"
                >
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                    {screen.tag}
                  </span>
                  <h3 className="text-2xl font-semibold text-white">
                    {screen.title}
                  </h3>
                  <p className="text-sm text-slate-200">{screen.description}</p>
                  <div className="mt-2 h-40 rounded-xl border border-dashed border-white/20 bg-slate-950/60 text-center text-xs uppercase tracking-[0.3em] text-slate-500">
                    <div className="flex h-full items-center justify-center">
                      скриншот
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-5 rounded-3xl border border-white/10 bg-slate-900/40 p-6">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
                Преимущества
              </p>
              <h2 className="text-3xl font-semibold text-white">
                Конкретика без воды
              </h2>
              <div className="space-y-4">
                {advantagePoints.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-white/5 bg-white/5 p-4"
                  >
                    <p className="text-lg font-semibold text-white">
                      {item.title}
                    </p>
                    <p className="text-sm text-slate-300">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-6 rounded-3xl border border-white/10 bg-slate-900/40 p-6">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
                  Интеграции
                </p>
                <h3 className="text-2xl font-semibold text-white">
                  Подключаем то, чем пользуются
                </h3>
                <ul className="mt-4 space-y-2 text-sm text-slate-200">
                  {integrations.map((integration) => (
                    <li key={integration} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-cyan-300" />
                      {integration}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
                  Безопасность и контроль
                </p>
                <ul className="mt-4 space-y-2 text-sm text-slate-200">
                  {securityPoints.map((point) => (
                    <li key={point} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-300" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section
            id="contact"
            className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/20 via-slate-900 to-emerald-500/20 p-8 text-center"
          >
            <p className="text-sm uppercase tracking-[0.4em] text-white/70">
              Настало время попробовать
            </p>
            <h2 className="mt-4 text-4xl font-semibold text-white">
              Запустите свой affiliate-трекинг без лишних слов
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-base text-white/80">
              Покажем готовые кабинеты, поможем мигрировать текущие данные и
              настроим инфраструктуру под ваши правила. Если нужно self-hosted —
              развернём в вашем периметре с полным контролем.
            </p>
            <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/auth/login"
                className="w-full rounded-full bg-white px-8 py-3 text-center text-base font-semibold text-slate-900 transition hover:bg-zinc-100 sm:w-auto"
              >
                Войти
              </Link>
              <Link
                href="/auth/register"
                className="w-full rounded-full border border-white/50 px-8 py-3 text-center text-base font-semibold text-white transition hover:border-white sm:w-auto"
              >
                Создать аккаунт
              </Link>
              <a
                href="mailto:support@affiliate.local"
                className="w-full rounded-full border border-transparent px-8 py-3 text-center text-base font-semibold text-white/80 underline-offset-4 hover:text-white sm:w-auto"
              >
                Связаться
              </a>
            </div>
          </section>
        </main>
        <footer className="border-t border-white/10 bg-slate-950/80">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-lg font-semibold text-white">
                Affiliate Platform
              </p>
              <p className="text-sm text-slate-400">
                Трекинг кликов и конверсий, управление офферами, аналитика и
                выплаты в одной системе.
              </p>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-slate-300">
              <Link href="/auth/login" className="transition hover:text-white">
                Login
              </Link>
              <Link
                href="/auth/register"
                className="transition hover:text-white"
              >
                Register
              </Link>
              <Link href="/docs" className="transition hover:text-white">
                Documentation
              </Link>
              <Link href="/privacy" className="transition hover:text-white">
                Privacy
              </Link>
              <Link href="/terms" className="transition hover:text-white">
                Terms
              </Link>
              <a
                href="mailto:support@affiliate.local"
                className="transition hover:text-white"
              >
                support@affiliate.local
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
