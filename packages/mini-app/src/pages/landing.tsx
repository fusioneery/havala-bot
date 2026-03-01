import { ArrowRight, Search, Users, MessageCircle, Shield, Github, Globe, Repeat } from 'lucide-react';

const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME || 'halwa_app_bot';

export default function LandingPage() {
  const botUrl = `https://t.me/${BOT_USERNAME.replace('@', '')}`;

  return (
    <div className="min-h-dvh bg-background text-foreground overflow-y-auto">
      {/* ── Hero ── */}
      <section className="px-6 pt-16 pb-12 max-w-xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-card rounded-full px-4 py-2 mb-6">
          <span className="text-[13px] font-medium text-muted-foreground">Telegram Mini App</span>
        </div>
        <h1 className="text-[40px] sm:text-[52px] font-extrabold tracking-tight leading-[1.1] mb-4">
          Хал<span className="text-lime">в</span>а
        </h1>
        <p className="text-[18px] sm:text-[20px] text-muted-foreground leading-relaxed mb-8 max-w-md mx-auto">
          Обменивайте валюту напрямую среди друзей и участников доверенных групп — без посредников и комиссий
        </p>
        <a
          href={botUrl}
          className="inline-flex items-center justify-center gap-2 bg-lime hover:bg-lime-hover text-[#1C1C1E] h-[56px] px-8 rounded-[20px] font-bold text-[17px] active:scale-[0.98] transition-all shadow-[0_8px_24px_rgba(200,241,53,0.4)]"
        >
          Перейти в бота
          <ArrowRight className="w-5 h-5" />
        </a>
      </section>

      {/* ── 3-Step Flow ── */}
      <section className="px-6 py-12 max-w-3xl mx-auto">
        <h2 className="text-[24px] font-bold mb-8 text-center">Три шага к обмену</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <FlowStep
            n={1}
            icon={<Search className="w-5 h-5" />}
            title="Создайте заявку"
            description="Укажите какую валюту хотите обменять, на что и в каком объёме."
            screenshotAlt="Экран создания заявки"
          />
          <FlowStep
            n={2}
            icon={<Users className="w-5 h-5" />}
            title="Получите мэтч"
            description="Бот найдёт подходящие предложения среди друзей и участников доверенных групп."
            screenshotAlt="Экран мэтчей"
          />
          <FlowStep
            n={3}
            icon={<MessageCircle className="w-5 h-5" />}
            title="Договоритесь напрямую"
            description="Свяжитесь с автором предложения прямо в Telegram и обменяйтесь."
            screenshotAlt="Экран ленты предложений"
          />
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="px-6 py-12 max-w-xl mx-auto">
        <h2 className="text-[24px] font-bold mb-6 text-center">Принцип работы</h2>
        <div className="bg-card rounded-[20px] p-6 space-y-5">
          <ExplainerItem
            icon={<Repeat className="w-4 h-4" />}
            title="P2P-обмен"
            text="Халва работает по принципу хавалы — прямого обмена между людьми. Никаких посредников, курс определяете вы сами."
          />
          <ExplainerItem
            icon={<Shield className="w-4 h-4" />}
            title="Доверие через связи"
            text="Вы обмениваетесь только с друзьями или участниками проверенных Telegram-групп. Круг поиска задаёте сами."
          />
          <ExplainerItem
            icon={<Globe className="w-4 h-4" />}
            title="Бот — только посредник"
            text="Халва не хранит деньги и не участвует в переводах. Бот только находит подходящие пары и соединяет людей."
          />
          <ExplainerItem
            icon={<Github className="w-4 h-4" />}
            title="Открытый код"
            text="Исходный код проекта полностью открыт. Вы можете развернуть свою версию бота для своего сообщества."
          />
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <section className="px-6 pt-8 pb-16 max-w-xl mx-auto text-center">
        <p className="text-muted-foreground text-[15px] mb-4">Готовы попробовать?</p>
        <a
          href={botUrl}
          className="inline-flex items-center justify-center gap-2 bg-lime hover:bg-lime-hover text-[#1C1C1E] h-[56px] px-8 rounded-[20px] font-bold text-[17px] active:scale-[0.98] transition-all shadow-[0_8px_24px_rgba(200,241,53,0.4)]"
        >
          Открыть Халву в Telegram
          <ArrowRight className="w-5 h-5" />
        </a>
      </section>
    </div>
  );
}

/* ── Sub-components ── */

function FlowStep({ n, icon, title, description, screenshotAlt }: {
  n: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  screenshotAlt: string;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      {/* Phone-frame screenshot placeholder */}
      <div className="w-full max-w-[220px] aspect-[9/16] bg-card rounded-[24px] border-2 border-accent flex flex-col items-center justify-center p-4 relative overflow-hidden mb-4">
        {/* Notch */}
        <div className="absolute top-3 w-16 h-1.5 bg-accent rounded-full" />
        {/* Placeholder skeleton */}
        <div className="w-10 h-10 rounded-full bg-accent mb-3" />
        <div className="w-3/4 h-2 bg-accent rounded-full mb-2" />
        <div className="w-1/2 h-2 bg-accent rounded-full mb-4" />
        <div className="w-full space-y-2">
          <div className="w-full h-8 bg-accent rounded-[12px]" />
          <div className="w-full h-8 bg-accent rounded-[12px]" />
          <div className="w-2/3 h-8 bg-accent rounded-[12px]" />
        </div>
        {/* When screenshot is ready, replace placeholder with:
            <img src="/screenshots/step-{n}.png" alt={screenshotAlt} className="w-full h-full object-cover" />
        */}
      </div>
      {/* Step info */}
      <div className="flex items-center gap-2 mb-2">
        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-lime text-[#1C1C1E] text-[13px] font-bold flex items-center justify-center">
          {n}
        </span>
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-[16px] font-semibold">{title}</h3>
      </div>
      <p className="text-[14px] text-muted-foreground leading-relaxed max-w-[240px]">{description}</p>
    </div>
  );
}

function ExplainerItem({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <span className="flex-shrink-0 mt-0.5 text-lime">{icon}</span>
      <div>
        <h3 className="text-[15px] font-semibold mb-0.5">{title}</h3>
        <p className="text-[14px] text-muted-foreground leading-relaxed">{text}</p>
      </div>
    </div>
  );
}
