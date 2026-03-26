import { GroupTooltip } from '@/components/ui/group-tooltip';
import { useBackButton } from '@/hooks/use-back-button';
import { useTrustedGroups } from '@/hooks/use-trusted-groups';
import { useI18n } from '@/lib/i18n';
import { openTelegramLink } from '@/lib/utils';
import { useEffect } from 'react';

const LS_KEY_VISITED_ABOUT = 'visited_about';

export default function AboutPage() {
  const { groups } = useTrustedGroups();
  const { lang } = useI18n();
  useBackButton('/');
  const copy = lang === 'ru'
    ? {
        title: 'О проекте',
        intro: '– это способ обменивать валюту напрямую без посредников и комиссий.',
        introTail: 'но Халва звучит прикольнее',
        howBotWorks: 'Как работает бот',
        step1: 'Вы создаёте заявку на поиск обмена валюты — какую валюту хотите обменять, на что и в каком объёме.',
        step2Start: 'Бот ищет встречные заявки в сообщениях ',
        step2Groups: 'доверенных групп',
        step2End: ' среди ваших друзей и знакомых, а так же внутри доски объявлений самого бота.',
        step3: 'Вам приходит мэтч и вы связываетесь с автором подходящего предложения обмена напрямую в Telegram.',
        saferTitle: 'Почему это безопаснее, чем обычно',
        safer1: 'В обмене участвуют только аккаунты из ',
        safer2: 'Вы сами выбираете круг поиска: только друзья, которых вы лично добавили в список друзей или все люди из ',
        safer2End: '.',
        safer3: 'Бот не хранит деньги и не участвует в переводах — только соединяет людей.',
        sourceCode: 'Исходный код',
        sourceCodeEnd: ' проекта открыт для просмотра и использования.',
        riskyTitle: 'Почему это всё ещё небезопасно',
        risky1Start: 'Халва никак не модерирует состав ',
        risky1End: ' и не проверяет их участников на честность.',
        risky2: 'Развернуть свою версию бота и добавить в неё любые группы как доверенные может кто угодно. Проверяйте username бота, прежде чем обмениваться.',
        risky3: 'Связавшись с автором заявки, вы сами оцениваете риски и решаете, стоит ли обмениваться.',
        risky4: 'Проект не предоставляет услуг гаранта и страховки от потерь. Бот только соединяет телеграм-аккаунты.',
        contacts: 'Контакты',
        contactText: 'Вопросы, идеи, баги — ',
      }
    : {
        title: 'About the project',
        intro: 'is a way to exchange currency directly without middlemen or fees,',
        introTail: 'but Halwa sounds better',
        howBotWorks: 'How the bot works',
        step1: 'You create an exchange search offer: what currency you want to exchange, what you want in return, and the amount.',
        step2Start: 'The bot looks for matching offers in messages from ',
        step2Groups: 'trusted groups',
        step2End: ', among your friends and acquaintances, as well as inside the bot’s own board.',
        step3: 'You receive a match and contact the author of the matching offer directly in Telegram.',
        saferTitle: 'Why this is safer than usual',
        safer1: 'Only accounts from ',
        safer2: 'You choose the search radius yourself: only friends you added personally, or everyone from ',
        safer2End: '.',
        safer3: 'The bot does not hold money and does not participate in transfers. It only connects people.',
        sourceCode: 'Source code',
        sourceCodeEnd: ' is open for review and use.',
        riskyTitle: 'Why this is still unsafe',
        risky1Start: 'Halwa does not moderate the membership of ',
        risky1End: ' or verify that participants are honest.',
        risky2: 'Anyone can deploy their own version of the bot and add any groups as trusted. Check the bot username before exchanging.',
        risky3: 'When you contact the offer author, you evaluate the risks yourself and decide whether to proceed.',
        risky4: 'The project does not provide escrow or insurance against losses. The bot only connects Telegram accounts.',
        contacts: 'Contacts',
        contactText: 'Questions, ideas, bugs: ',
      };

  useEffect(() => {
    localStorage.setItem(LS_KEY_VISITED_ABOUT, '1');
  }, []);

  return (
    <div className="w-full h-dvh flex flex-col bg-background text-foreground">
      <header className="px-5 pt-2.5 pb-4">
        <h1 className="text-[17px] font-semibold tracking-tight">{copy.title}</h1>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar px-4 pb-8">
        <div className="sticky top-0 h-6 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none" />
        {/* Mission */}
          <p className="text-muted-foreground text-[14px] leading-relaxed mb-4">
            <span className="text-foreground"><b>Hawala</b> {copy.intro}</span> {copy.introTail}
          </p>

        {/* How it works */}
        <div className="bg-card rounded-[20px] border border-border p-5 mb-3">
          <h2 className="text-[17px] font-semibold mb-2">{copy.howBotWorks}</h2>
          <div className="space-y-3">
            <Step n={1} text={copy.step1} />
            <Step
              n={2}
              text={
                <>
                  {copy.step2Start}
                  <GroupTooltip groups={groups}>{copy.step2Groups}</GroupTooltip>
                  {copy.step2End}
                </>
              }
            />
            <Step n={3} text={copy.step3} />
          </div>
        </div>

        {/* Safety */}
        <div className="bg-card rounded-[20px] border border-border p-5 mb-3">
          <h2 className="text-[17px] font-semibold mb-2">{copy.saferTitle}</h2>
          <ul className="space-y-2 text-muted-foreground text-[14px] leading-relaxed">
            <li>
              <span className="text-foreground mr-1.5">&#x2022;</span>
              {copy.safer1}
              <GroupTooltip groups={groups}>{copy.step2Groups}</GroupTooltip>.
            </li>
            <li>
              <span className="text-foreground mr-1.5">&#x2022;</span>
              {copy.safer2}
              <GroupTooltip groups={groups}>{copy.step2Groups}</GroupTooltip>
              {copy.safer2End}
            </li>
            <li>
              <span className="text-foreground mr-1.5">&#x2022;</span>
              {copy.safer3}
            </li>
            <li>
              <span className="text-foreground mr-1.5">&#x2022;</span>
              <a
                href="https://github.com/fusioneery/havala-bot"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline decoration-dotted underline-offset-[3px] decoration-foreground/50"
              >
                {copy.sourceCode}
              </a>
              {copy.sourceCodeEnd}
            </li>
          </ul>
        </div>

        <div className="bg-card rounded-[20px] border border-border p-5 mb-3">
          <h2 className="text-[17px] font-semibold mb-2">{copy.riskyTitle}</h2>
          <ul className="space-y-2 text-muted-foreground text-[14px] leading-relaxed">
            <li>
              <span className="text-foreground mr-1.5">&#x2022;</span>
              {copy.risky1Start}
              <GroupTooltip groups={groups}>{copy.step2Groups}</GroupTooltip>
              {copy.risky1End}
            </li>
            <li>
              <span className="text-foreground mr-1.5">&#x2022;</span>
              {copy.risky2}
            </li>
            <li>
              <span className="text-foreground mr-1.5">&#x2022;</span>
              {copy.risky3}
            </li>
            <li>
              <span className="text-foreground mr-1.5">&#x2022;</span>
              {copy.risky4}
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
          <h2 className="text-[17px] font-semibold mb-2">{copy.contacts}</h2>
          <p className="text-muted-foreground text-[14px] leading-relaxed">
            {copy.contactText}
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
