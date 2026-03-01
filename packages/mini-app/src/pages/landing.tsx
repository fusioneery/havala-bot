import { ArrowRight, ChevronRight, Github, Globe, MessageCircle, Repeat, Search, Shield, Users } from 'lucide-react';

import createOrderScreenshot from '@/assets/screenshots/create-order-dark.png';
import matchesScreenshot from '@/assets/screenshots/matches-detail-1.png';
import notificationScreenshot from '@/assets/screenshots/notification.png';

const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME || 'halwa_app_bot';

export default function LandingPage() {
  const botUrl = `https://t.me/${BOT_USERNAME.replace('@', '')}`;

  return (
    <div className="h-dvh bg-background text-foreground overflow-y-auto">
      {/* ── Hero ── */}
      <section className="px-6 pt-16 pb-12 max-w-xl mx-auto text-center">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-between mb-8">
          <h1 className="text-[40px] sm:text-[52px] font-extrabold tracking-tight leading-[1.1]">
            Хал<span className="text-accent2">в</span><span>a</span>
          </h1>
          <a
            href={botUrl}
            className="inline-flex items-center gap-2 bg-lime hover:bg-lime-hover text-[#1C1C1E] h-[56px] px-8 rounded-[20px] font-bold text-[17px] active:scale-[0.98] transition-all shadow-[0_8px_24px_rgba(200,241,53,0.4)]"
          >
            Перейти в бота
            <ArrowRight className="w-5 h-5" />
          </a>
        </div>
        <p className="text-[18px] sm:text-[20px] text-muted-foreground leading-relaxed max-w-xl mx-auto">
          Меняй валюту напрямую среди друзей и участников доверенных групп — без посредников и комиссий
        </p>
      </section>

      {/* ── 3-Step Flow ── */}
      <section className="py-12">
        <h2 className="text-[24px] font-bold mb-8 text-center px-6">Три шага к обмену</h2>
        <div
          className="flex gap-2 px-[5vw] overflow-x-auto snap-x snap-mandatory sm:overflow-visible sm:snap-none sm:gap-4 sm:px-6 sm:items-center sm:max-w-5xl sm:mx-auto"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          <FlowStep
            icon={<Search className="w-5 h-5" />}
            title="Создайте заявку"
            description="Укажите какую валюту хотите обменять, на что и в каком объёме."
            screenshot={createOrderScreenshot}
          />
          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 hidden sm:block" />
          <FlowStep
            icon={<Users className="w-5 h-5" />}
            title="Получите мэтч"
            description="Бот найдёт подходящие предложения среди друзей и участников доверенных групп."
            screenshot={matchesScreenshot}
          />
          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 hidden sm:block" />
          <FlowStep
            icon={<MessageCircle className="w-5 h-5" />}
            title="Договоритесь напрямую"
            description="Свяжитесь с автором предложения прямо в Telegram и обменяйтесь."
            screenshot={notificationScreenshot}
          />
        </div>
      </section>


      {/* ── How It Works ── */}
      <section className="px-6 py-12 max-w-xl mx-auto">
        <h2 className="text-[24px] font-bold mb-6 text-center">Принцип работы</h2>
        <div className="bg-card rounded-[20px] p-6 space-y-7">
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

      {/* ── Footer ── */}
      <footer className="bg-foreground text-background mt-12">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-5 max-w-5xl mx-auto text-[13px]">
          <a
            href="https://telegra.ph/Halwa-02-27"
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-60 hover:opacity-100 transition-opacity"
          >
            Подробнее о проекте
          </a>
          <span className="flex items-center gap-1.5 opacity-60">
            made with
            <HeartIcon />
            by{' '}
            <a
              href="https://vladabramov.me"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:opacity-80 transition-opacity"
            >
              Vlad
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}

/* ── Sub-components ── */

function FlowStep({ icon, title, description, screenshot }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  screenshot?: string;
}) {
  return (
    <div className="flex flex-col items-center text-center shrink-0 w-[86vw] snap-center sm:w-auto sm:shrink sm:snap-align-none sm:flex-1">
      {/* Phone-frame screenshot */}
      <div className="w-full sm:max-w-[220px] aspect-[402/874] bg-card rounded-[24px] border-2 border-accent relative overflow-hidden mb-4">
        {/* Notch */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-accent rounded-full z-10" />
        {screenshot ? (
          <img
            src={screenshot}
            alt={title}
            className="w-full h-full object-cover object-top"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center px-4 pt-[50px] pb-4">
            <div className="w-10 h-10 rounded-full bg-accent mb-3" />
            <div className="w-3/4 h-2 bg-accent rounded-full mb-2" />
            <div className="w-1/2 h-2 bg-accent rounded-full mb-4" />
            <div className="w-full space-y-2">
              <div className="w-full h-8 bg-accent rounded-[12px]" />
              <div className="w-full h-8 bg-accent rounded-[12px]" />
              <div className="w-2/3 h-8 bg-accent rounded-[12px]" />
            </div>
          </div>
        )}
      </div>
      {/* Step info */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-[16px] font-semibold">{title}</h3>
      </div>
      <p className="text-[14px] text-muted-foreground leading-relaxed max-w-[280px] md:max-w-none">{description}</p>
    </div>
  );
}

function ExplainerItem({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <span className="flex-shrink-0 mt-[3px] text-accent2">{icon}</span>
      <div>
        <h3 className="text-[15px] font-semibold mb-0.5">{title}</h3>
        <p className="text-[14px] text-muted-foreground leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function HeartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-3.5 h-3.5 text-red-500"
      style={{ animation: 'heartbeat 1.2s ease-in-out infinite' }}
      aria-hidden
    >
      <title>Сделано с любовью</title>
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      <style>{`
        @keyframes heartbeat {
          0%, 100% { transform: scale(1); }
          14% { transform: scale(1.15); }
          28% { transform: scale(1); }
          42% { transform: scale(1.15); }
          70% { transform: scale(1); }
        }
      `}</style>
    </svg>
  );
}
