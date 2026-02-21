import type { ContactListItem, MatchResult, MyOfferItem, UserSearchResult } from '@hawala/shared';
import type { TrustedGroup } from '@/hooks/use-trusted-groups';

// ─── Worst-case names ────────────────────────────────────────────────────────

const LONG_NAMES = [
  'Александр Владиславович Черноморский-Задунайский',
  'Maria Konstantina Aleksandropoulou-Papadimitriou',
  'Владислав Константинович Богоявленский-Черниговский',
  'Mukhammad-Ali Abdurakhmonov-Toshmatov',
  'Христина Феодосиевна Величко-Остапенко',
  'Jean-Baptiste François de la Croix-Vaubois',
  'Абдурахман Мухаммадали Ибрагимов-Юсупов',
  'Елизавета Александровна Скоропадская-Данилевич',
  'Константин Михайлович Великопольский',
  'Thanawat Phonsombatphibun Kaewkongkaew',
  'Нурсултан Абдыкалыкович Жакыпбеков',
  'Frederica Wilhelmina von Brandenburg-Schwedt',
  'Иван Степанович Крутихин-Задонский',
  'Мухаммад-Юсуф Абдуллаевич Назаров',
  'Валентина Феодоровна Черненко-Литвиненко',
  'Сергей Александрович Цветаев-Волконский',
  'Anastasia Prokopenko-Shevchenko',
  'Мирзохид Абдурахимович Умаров',
  'Gottfried Wilhelm von Leibniz-Hannover',
  'Данияр Болатович Сейткали',
];

const LONG_USERNAMES = [
  'alexander_vladislavovich_chernomorsky',
  'maria_konstantina_papadimitriou_2024',
  'vladislav_bogoyavlensky_chernigovsky',
  'mukhammad_ali_abdurakhmonov',
  'khrystyna_velychko_ostapenko',
  'jean_baptiste_de_la_croix_vaubois',
  'abdurakhman_ibragimov_yusupov',
  'elizaveta_skoropadska_danilievich',
  'konstantin_velikopolsky_official',
  'thanawat_phonsombatphibun',
  'nursultan_zhakypbekov_kz',
  'frederica_von_brandenburg',
  'ivan_krutihin_zadonsky_ru',
  'mukhammad_yusuf_nazarov',
  'valentyna_chernenko_litvinenko',
  'sergey_tsvetaev_volkonsky',
  'anastasia_prokopenko_shevchenko',
  'mirzohid_umarov_uz',
  'gottfried_von_leibniz',
  'daniyar_seytkali_kz',
];

// ─── Worst-case group names ──────────────────────────────────────────────────

export const STRESS_GROUPS: TrustedGroup[] = [
  { name: '🇩🇪 Русскоязычные экспаты в Берлине и Бранденбурге — обмен и помощь', link: 'https://t.me/+stress1' },
  { name: '💰 Международный клуб инвесторов и трейдеров — валюта, акции, крипта', link: 'https://t.me/+stress2' },
  { name: '🇦🇪 Русские в Дубае | Бизнес, релокация, финансы и обмен валют', link: 'https://t.me/+stress3' },
  { name: '🌍 Цифровые кочевники — Юго-Восточная Азия, Грузия, Армения, Сербия', link: 'https://t.me/+stress4' },
  { name: '🇹🇷 Переехавшие в Турцию | Анталья, Стамбул, Анкара — вся страна', link: 'https://t.me/+stress5' },
  { name: '🇬🇧 Русскоговорящие в Великобритании — Лондон и другие города', link: 'https://t.me/+stress6' },
  { name: '🏔 Тбилиси Нетворкинг | Эмигранты, фрилансеры, стартаперы', link: 'https://t.me/+stress7' },
  { name: '🇦🇲 Ереван — русскоязычное сообщество | Обмен, аренда, советы', link: 'https://t.me/+stress8' },
  { name: '🇷🇸 Белград и Сербия — релоканты, жизнь, финансы, обмен валют', link: 'https://t.me/+stress9' },
  { name: '🇹🇭 Бангкок | Русские в Таиланде — жильё, работа, обмен', link: 'https://t.me/+stress10' },
  { name: '🇺🇸 Русскоязычные в США — Нью-Йорк, Лос-Анджелес, Сан-Франциско', link: 'https://t.me/+stress11' },
  { name: '🇮🇱 Олим-хадашим | Новые репатрианты Израиля — финансы и обмен', link: 'https://t.me/+stress12' },
  { name: '🇧🇦 Сараево и Босния — переехавшие из России и Украины', link: 'https://t.me/+stress13' },
  { name: '🌐 Крипто-комьюнити | P2P обмен без посредников — весь мир', link: 'https://t.me/+stress14' },
  { name: '🇵🇹 Португалия — русскоязычная диаспора | Лиссабон, Порту, Алгарве', link: 'https://t.me/+stress15' },
];

// ─── Worst-case amounts ──────────────────────────────────────────────────────
// Large integer, large with 6 fractional digits, moderate big

const makeLongGroupName = () => STRESS_GROUPS[0].name;

// ─── MyOfferItem mocks ───────────────────────────────────────────────────────

export const STRESS_OFFERS: MyOfferItem[] = [
  {
    id: 1001,
    fromCurrency: 'RUB',
    toCurrency: 'USDT',
    amount: 999_999_999,
    status: 'active',
    matchCount: 42,
    createdAt: new Date(Date.now() - 2 * 60_000).toISOString(),
    paymentMethods: { give: [], take: [] },
    topMatch: {
      author: { firstName: LONG_NAMES[0], username: LONG_USERNAMES[0], avatarUrl: null },
      trustType: 'acquaintance',
      groupName: makeLongGroupName(),
      telegramMessageLink: 'https://t.me/c/1234567890/99',
    },
    allMatches: [
      { author: { firstName: LONG_NAMES[0], username: LONG_USERNAMES[0], avatarUrl: null }, trustType: 'acquaintance', groupName: makeLongGroupName(), telegramMessageLink: 'https://t.me/c/1234567890/99' },
      { author: { firstName: LONG_NAMES[5], username: LONG_USERNAMES[5], avatarUrl: null }, trustType: 'friend', groupName: STRESS_GROUPS[5].name, telegramMessageLink: 'https://t.me/c/1234567890/100' },
      { author: { firstName: LONG_NAMES[6], username: null, avatarUrl: null }, trustType: null, groupName: STRESS_GROUPS[6].name, telegramMessageLink: 'https://t.me/c/1234567890/101' },
      { author: { firstName: LONG_NAMES[7], username: LONG_USERNAMES[7], avatarUrl: null }, trustType: 'acquaintance', groupName: STRESS_GROUPS[7].name, telegramMessageLink: 'https://t.me/c/1234567890/102' },
    ],
  },
  {
    id: 1002,
    fromCurrency: 'USDT',
    toCurrency: 'RUB',
    amount: 1_234_567.890123,
    status: 'active',
    matchCount: 7,
    createdAt: new Date(Date.now() - 35 * 60_000).toISOString(),
    paymentMethods: {
      give: [{ currency: 'USDT', methods: ['crypto'] }],
      take: [],
    },
    topMatch: {
      author: { firstName: LONG_NAMES[1], username: LONG_USERNAMES[1], avatarUrl: null },
      trustType: 'friend',
      groupName: STRESS_GROUPS[1].name,
      telegramMessageLink: 'https://t.me/c/9876543210/42',
    },
    allMatches: [
      { author: { firstName: LONG_NAMES[1], username: LONG_USERNAMES[1], avatarUrl: null }, trustType: 'friend', groupName: STRESS_GROUPS[1].name, telegramMessageLink: 'https://t.me/c/9876543210/42' },
      { author: { firstName: LONG_NAMES[8], username: LONG_USERNAMES[8], avatarUrl: null }, trustType: 'friend', groupName: STRESS_GROUPS[8].name, telegramMessageLink: 'https://t.me/c/9876543210/43' },
      { author: { firstName: LONG_NAMES[9], username: null, avatarUrl: null }, trustType: 'acquaintance', groupName: STRESS_GROUPS[9].name, telegramMessageLink: 'https://t.me/c/9876543210/44' },
    ],
  },
  {
    id: 1003,
    fromCurrency: 'EUR',
    toCurrency: 'GEL',
    amount: 88_888_888.88,
    status: 'active',
    matchCount: 0,
    createdAt: new Date(Date.now() - 3 * 60 * 60_000).toISOString(),
    paymentMethods: {
      give: [{ currency: 'EUR', methods: ['swift'] }],
      take: [],
    },
    topMatch: null,
    allMatches: [],
  },
  {
    id: 1004,
    fromCurrency: 'USD',
    toCurrency: 'RUB',
    amount: 10_000_000,
    status: 'active',
    matchCount: 19,
    createdAt: new Date(Date.now() - 7 * 60_000).toISOString(),
    paymentMethods: { give: [], take: [] },
    topMatch: {
      author: { firstName: LONG_NAMES[2], username: null, avatarUrl: null },
      trustType: 'acquaintance',
      groupName: STRESS_GROUPS[2].name,
      telegramMessageLink: 'https://t.me/c/1111111111/7',
    },
    allMatches: [
      { author: { firstName: LONG_NAMES[2], username: null, avatarUrl: null }, trustType: 'acquaintance', groupName: STRESS_GROUPS[2].name, telegramMessageLink: 'https://t.me/c/1111111111/7' },
      { author: { firstName: LONG_NAMES[10], username: LONG_USERNAMES[10], avatarUrl: null }, trustType: 'acquaintance', groupName: STRESS_GROUPS[10].name, telegramMessageLink: 'https://t.me/c/1111111111/8' },
      { author: { firstName: LONG_NAMES[11], username: LONG_USERNAMES[11], avatarUrl: null }, trustType: null, groupName: STRESS_GROUPS[11].name, telegramMessageLink: 'https://t.me/c/1111111111/9' },
    ],
  },
  {
    id: 1005,
    fromCurrency: 'GBP',
    toCurrency: 'USDT',
    amount: 555_555.123456,
    status: 'active',
    matchCount: 3,
    createdAt: new Date(Date.now() - 25 * 60_000).toISOString(),
    paymentMethods: {
      give: [{ currency: 'GBP', methods: ['swift'] }],
      take: [{ currency: 'USDT', methods: ['crypto'] }],
    },
    topMatch: {
      author: { firstName: LONG_NAMES[3], username: LONG_USERNAMES[3], avatarUrl: null },
      trustType: null,
      groupName: STRESS_GROUPS[3].name,
      telegramMessageLink: 'https://t.me/c/2222222222/55',
    },
    allMatches: [
      { author: { firstName: LONG_NAMES[3], username: LONG_USERNAMES[3], avatarUrl: null }, trustType: null, groupName: STRESS_GROUPS[3].name, telegramMessageLink: 'https://t.me/c/2222222222/55' },
      { author: { firstName: LONG_NAMES[12], username: LONG_USERNAMES[12], avatarUrl: null }, trustType: 'acquaintance', groupName: STRESS_GROUPS[12].name, telegramMessageLink: 'https://t.me/c/2222222222/56' },
    ],
  },
  {
    id: 1006,
    fromCurrency: 'RUB',
    toCurrency: 'AED',
    amount: 777_777_777,
    status: 'active',
    matchCount: 1,
    createdAt: new Date(Date.now() - 50 * 60_000).toISOString(),
    paymentMethods: { give: [], take: [] },
    topMatch: {
      author: { firstName: LONG_NAMES[4], username: LONG_USERNAMES[4], avatarUrl: null },
      trustType: 'friend',
      groupName: STRESS_GROUPS[4].name,
      telegramMessageLink: 'https://t.me/c/3333333333/11',
    },
    allMatches: [
      { author: { firstName: LONG_NAMES[4], username: LONG_USERNAMES[4], avatarUrl: null }, trustType: 'friend', groupName: STRESS_GROUPS[4].name, telegramMessageLink: 'https://t.me/c/3333333333/11' },
    ],
  },
];

// ─── MatchResult mocks ──────────────────────────────────────────────────────

const LONG_MSG = `Продаю USDT по курсу ЦБ+1%. Работаю только через СБП Сбер/Тинькофф.
Минимальная сумма 50 000 руб. Перевод в течение 15 минут после подтверждения.
Есть отзывы, работаю давно, всё официально. Пишите в личку — отвечаю быстро.
#usdt #рубли #обмен #p2p #москва #безнала`;

export const STRESS_MATCHES: MatchResult[] = [
  {
    id: 9001,
    offer: {
      id: 8001,
      fromCurrency: 'USDT',
      toCurrency: 'RUB',
      amount: 1_234_567.890123,
      amountCurrency: 'USDT',
      paymentMethods: ['russian_banks'],
      originalMessageText: LONG_MSG,
      telegramMessageId: 111,
    },
    author: { telegramId: 500001, username: LONG_USERNAMES[0], firstName: LONG_NAMES[0], avatarUrl: null },
    reputation: 98,
    trustType: 'friend',
    groupName: STRESS_GROUPS[0].name,
    telegramMessageLink: 'https://t.me/c/1234567890/111',
  },
  {
    id: 9002,
    offer: {
      id: 8002,
      fromCurrency: 'RUB',
      toCurrency: 'USDT',
      amount: 999_999_999,
      amountCurrency: 'RUB',
      paymentMethods: ['russian_banks', 'crypto'],
      originalMessageText: null,
      telegramMessageId: 222,
    },
    author: { telegramId: 500002, username: null, firstName: LONG_NAMES[1], avatarUrl: null },
    reputation: 75,
    trustType: 'acquaintance',
    groupName: STRESS_GROUPS[1].name,
    telegramMessageLink: 'https://t.me/c/9876543210/222',
  },
  {
    id: 9003,
    offer: {
      id: 8003,
      fromCurrency: 'EUR',
      toCurrency: 'RUB',
      amount: 88_888.888888,
      amountCurrency: 'EUR',
      paymentMethods: ['swift'],
      originalMessageText: 'Меняю евро на рубли. Только SWIFT. Сумма от 10k EUR. Много раз уже делал подобные сделки в этой группе — все довольны.',
      telegramMessageId: 333,
    },
    author: { telegramId: 500003, username: LONG_USERNAMES[2], firstName: LONG_NAMES[2], avatarUrl: null },
    reputation: 61,
    trustType: null,
    groupName: STRESS_GROUPS[2].name,
    telegramMessageLink: 'https://t.me/c/1111111111/333',
  },
  {
    id: 9004,
    offer: {
      id: 8004,
      fromCurrency: 'USD',
      toCurrency: 'GEL',
      amount: 500_000,
      amountCurrency: 'USD',
      paymentMethods: ['local_banks'],
      originalMessageText: null,
      telegramMessageId: 444,
    },
    author: { telegramId: 500004, username: LONG_USERNAMES[3], firstName: LONG_NAMES[3], avatarUrl: null },
    reputation: 88,
    trustType: 'friend',
    groupName: STRESS_GROUPS[3].name,
    telegramMessageLink: 'https://t.me/c/2222222222/444',
  },
  {
    id: 9005,
    offer: {
      id: 8005,
      fromCurrency: 'GBP',
      toCurrency: 'USDT',
      amount: 777_777.123456,
      amountCurrency: 'GBP',
      paymentMethods: ['swift', 'crypto'],
      originalMessageText: 'GBP → USDT. Работаю через SWIFT из Лондона. Перевод TRC-20/ERC-20 на выбор. Верифицированный аккаунт Binance P2P с 500+ сделок.',
      telegramMessageId: 555,
    },
    author: { telegramId: 500005, username: null, firstName: LONG_NAMES[4], avatarUrl: null },
    reputation: 92,
    trustType: 'acquaintance',
    groupName: STRESS_GROUPS[4].name,
    telegramMessageLink: 'https://t.me/c/3333333333/555',
  },
  {
    id: 9006,
    offer: {
      id: 8006,
      fromCurrency: 'AED',
      toCurrency: 'RUB',
      amount: 10_000_000,
      amountCurrency: 'AED',
      paymentMethods: ['local_banks'],
      originalMessageText: null,
      telegramMessageId: 666,
    },
    author: { telegramId: 500006, username: LONG_USERNAMES[5], firstName: LONG_NAMES[5], avatarUrl: null },
    reputation: 55,
    trustType: null,
    groupName: STRESS_GROUPS[5].name,
    telegramMessageLink: 'https://t.me/c/4444444444/666',
  },
  {
    id: 9007,
    offer: {
      id: 8007,
      fromCurrency: 'USDT',
      toCurrency: 'EUR',
      amount: 333_333.333333,
      amountCurrency: 'USDT',
      paymentMethods: ['crypto', 'swift'],
      originalMessageText: 'USDT→EUR. Только TRC20. Получение на счёт EU-банка (Revolut, Wise, Monzo — без разницы). Работаю быстро, есть рекомендации от участников нескольких групп.',
      telegramMessageId: 777,
    },
    author: { telegramId: 500007, username: LONG_USERNAMES[6], firstName: LONG_NAMES[6], avatarUrl: null },
    reputation: 79,
    trustType: 'friend',
    groupName: STRESS_GROUPS[6].name,
    telegramMessageLink: 'https://t.me/c/5555555555/777',
  },
  {
    id: 9008,
    offer: {
      id: 8008,
      fromCurrency: 'RUB',
      toCurrency: 'AMD',
      amount: 55_555_555,
      amountCurrency: 'RUB',
      paymentMethods: ['russian_banks'],
      originalMessageText: null,
      telegramMessageId: 888,
    },
    author: { telegramId: 500008, username: null, firstName: LONG_NAMES[7], avatarUrl: null },
    reputation: 43,
    trustType: 'acquaintance',
    groupName: STRESS_GROUPS[7].name,
    telegramMessageLink: 'https://t.me/c/6666666666/888',
  },
];

export const STRESS_OFFER_TEXT =
  'Меняю 1 234 567.89 USDT на RUB. Принимаю СБП / Сбер / Тинькофф. Минималка 50 000 ₽. Пишите в личку — отвечаю быстро. #usdt #обмен #p2p';

// ─── ContactListItem mocks ───────────────────────────────────────────────────

export const STRESS_CONTACTS: ContactListItem[] = LONG_NAMES.map((firstName, i) => ({
  id: 2000 + i,
  type: i % 3 === 0 ? 'friend' : 'acquaintance',
  user: {
    id: 3000 + i,
    telegramId: 100_000_000 + i,
    username: i % 4 === 0 ? null : LONG_USERNAMES[i % LONG_USERNAMES.length],
    firstName,
    avatarUrl: null,
  },
}));

// ─── UserSearchResult mocks ──────────────────────────────────────────────────

export const STRESS_SEARCH_RESULTS: UserSearchResult[] = LONG_NAMES.map((firstName, i) => ({
  id: 4000 + i,
  telegramId: 200_000_000 + i,
  username: i % 3 === 0 ? null : LONG_USERNAMES[i % LONG_USERNAMES.length],
  firstName,
  avatarUrl: null,
}));
