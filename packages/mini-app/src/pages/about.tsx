import { GroupTooltip } from '@/components/ui/group-tooltip';
import { useBackButton } from '@/hooks/use-back-button';
import { useTrustedGroups } from '@/hooks/use-trusted-groups';
import { openTelegramLink } from '@/lib/utils';
import { useEffect } from 'react';

const LS_KEY_VISITED_ABOUT = 'visited_about';

export default function AboutPage() {
  const { groups } = useTrustedGroups();
  useBackButton('/');

  useEffect(() => {
    localStorage.setItem(LS_KEY_VISITED_ABOUT, '1');
  }, []);

  return (
    <div className="w-full h-dvh flex flex-col bg-background text-foreground">
      <header className="px-5 pt-2.5 pb-4">
        <h1 className="text-[17px] font-semibold tracking-tight">О проекте</h1>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar px-4 pb-8">
        <div className="sticky top-0 h-6 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none" />
        {/* Mission */}
          <p className="text-muted-foreground text-[14px] leading-relaxed mb-4">
            <span className="text-foreground"><b>Хавала</b> – это способ обменивать валюту напрямую без посредников и комиссий.</span> но <span className="text-accent2">Халва</span> звучит прикольнее
          </p>

        {/* How it works */}
        <div className="bg-card rounded-[20px] border border-border p-5 mb-3">
          <h2 className="text-[17px] font-semibold mb-2">Как работает бот</h2>
          <div className="space-y-3">
            <Step n={1} text="Вы создаёте заявку на поиск обмена валюты — какую валюту хотите обменять, на что и в каком объёме." />
            <Step
              n={2}
              text={
                <>
                  Бот ищет встречные заявки в сообщениях{' '}
                  <GroupTooltip groups={groups}>доверенных групп</GroupTooltip>{' '}
                  среди ваших друзей и знакомых, а так же внутри доски объявлений самого бота.
                </>
              }
            />
            <Step n={3} text="Вам приходит мэтч и вы связываетесь с автором подходящего предложения обмена напрямую в Telegram." />
          </div>
        </div>

        {/* Safety */}
        <div className="bg-card rounded-[20px] border border-border p-5 mb-3">
          <h2 className="text-[17px] font-semibold mb-2">Почему это безопаснее, чем обычно</h2>
          <ul className="space-y-2 text-muted-foreground text-[14px] leading-relaxed">
            <li>
              <span className="text-foreground mr-1.5">&#x2022;</span>
              В обмене участвуют только аккаунты из{' '}
              <GroupTooltip groups={groups}>доверенных групп</GroupTooltip>.
            </li>
            <li>
              <span className="text-foreground mr-1.5">&#x2022;</span>
              Вы сами выбираете круг поиска: только друзья, которых вы лично добавили в список друзей или все люди из{' '}
              <GroupTooltip groups={groups}>доверенных групп</GroupTooltip>.
            </li>
            <li>
              <span className="text-foreground mr-1.5">&#x2022;</span>
              Бот не хранит деньги и не участвует в переводах — только соединяет людей.
            </li>
            <li>
              <span className="text-foreground mr-1.5">&#x2022;</span>
              <a
                href="https://github.com/fusioneery/havala-bot"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline decoration-dotted underline-offset-[3px] decoration-foreground/50"
              >
                Исходный код
              </a>
              {' '}проекта открыт для просмотра и использования.
            </li>
          </ul>
        </div>

        <div className="bg-card rounded-[20px] border border-border p-5 mb-3">
          <h2 className="text-[17px] font-semibold mb-2">Почему это всё ещё небезопасно</h2>
          <ul className="space-y-2 text-muted-foreground text-[14px] leading-relaxed">
            <li>
              <span className="text-foreground mr-1.5">&#x2022;</span>
              Халва никак не модерирует состав{' '}
              <GroupTooltip groups={groups}>доверенных групп</GroupTooltip>{' '}
              и не проверяет их участников на честность.
            </li>
            <li>
              <span className="text-foreground mr-1.5">&#x2022;</span>
              Развернуть свою версию бота и добавить в неё любые группы как доверенные может кто угодно. Проверяйте username бота, прежде чем обмениваться.
            </li>
            <li>
              <span className="text-foreground mr-1.5">&#x2022;</span>
              Связавшись с автором заявки, вы сами оцениваете риски и решаете, стоит ли обмениваться.
            </li>
            <li>
              <span className="text-foreground mr-1.5">&#x2022;</span>
              Проект не предоставляет услуг гаранта и страховки от потерь. Бот только соединяет телеграм-аккаунты.
            </li>
          </ul>
        </div>

        {/* Learn more */}
        {/* <div className="bg-card rounded-[20px] border border-border p-5 mb-3">
          <p className="text-muted-foreground text-[14px] leading-relaxed">
            Прочитайте{' '}
            <a
              href="https://vas3k.blog/hawala/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline decoration-dotted underline-offset-[3px] decoration-foreground/50"
            >
              статью об идее и авторе проекта
            </a>
            .
          </p>
        </div> */}

        {/* Contacts */}
        <div className="bg-card rounded-[20px] border border-border p-5">
          <h2 className="text-[17px] font-semibold mb-2">Контакты</h2>
          <p className="text-muted-foreground text-[14px] leading-relaxed">
            Вопросы, идеи, баги —{' '}
            <button
              onClick={() => openTelegramLink('https://t.me/fusion1337')}
              className="text-foreground underline decoration-dotted underline-offset-[3px] decoration-foreground/50"
            >
              @fusion1337
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}

function Step({ n, text }: { n: number; text: React.ReactNode }) {
  return (
    <p className="text-muted-foreground text-[14px] leading-relaxed">
      <span className="inline-flex w-6 h-6 rounded-full bg-lime text-[#1C1C1E] text-[13px] font-bold items-center justify-center align-middle mr-3 shrink-0">
        {n}
      </span>
      {text}
    </p>
  );
}
