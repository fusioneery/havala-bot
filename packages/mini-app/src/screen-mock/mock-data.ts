import type { TrustedGroup } from '@/hooks/use-trusted-groups';
import type { ContactListItem, MatchResult, MyOfferItem, UserSearchResult } from '@hawala/shared';

// ─── Avatars (deterministic via pravatar.cc) ────────────────────────────────

const avatar = (n: number) => `https://i.pravatar.cc/200?img=${n}`;

// ─── Realistic names ────────────────────────────────────────────────────────

const NAMES = [
  { firstName: 'Andrew [never DM first]',      username: 'andrey_k',        avatar: avatar(11) },
  { firstName: 'Мария',       username: 'mariiiiie21',        avatar: avatar(5) },
  { firstName: 'A R',       username: 'ar1337',   avatar: avatar(12) },
  { firstName: 'lasagnorita fka',        username: 'lasagnorita',    avatar: avatar(9) },
  { firstName: 'T',       username: 'timur_kz',        avatar: avatar(14) },
  { firstName: 'Elena M.',        username: 'elena_medici',              avatar: avatar(25) },
  { firstName: 'Даша Васильева',      username: 'vasilek',      avatar: avatar(33) },
  { firstName: 'Sophie',        username: 'sophieeeeeee',      avatar: avatar(26) },
  { firstName: 'Denis',       username: 'denis_mr_seo',       avatar: avatar(53) },
  { firstName: 'Dmitriy Kozlov',        username: 'mitya_kozloff',        avatar: avatar(44) },
  { firstName: 'Alex',      username: 'alex_simp1e',        avatar: avatar(59) },
  { firstName: 'Olga Kolobova',      username: null,              avatar: avatar(20) },
];

// ─── Groups ─────────────────────────────────────────────────────────────────

export const MOCK_GROUPS: TrustedGroup[] = [
  { name: 'kyrillic',             link: 'https://t.me/+mock1' },
  { name: 'Startup Never Sleeps',        link: 'https://t.me/+mock2' },
  { name: 'Data Brunch',                 link: 'https://t.me/+mock3' },
  { name: 'SmenaStation Станция Смена',              link: 'https://t.me/+mock4' },
  { name: 'Вастрик.Бартер',       link: 'https://t.me/+mock5' },
];

// ─── Offers (user's own active offers with matches) ─────────────────────────

export const MOCK_OFFERS: MyOfferItem[] = [
  {
    id: 'uo:2001',
    fromCurrency: 'USDT',
    toCurrency: 'RUB',
    amount: 3_000,
    status: 'active',
    matchCount: 3,
    createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    paymentMethods: {
      give: [{ currency: 'USDT', methods: ['crypto'] }],
      take: [{ currency: 'RUB', methods: ['russian_banks'] }],
    },
    topMatch: {
      author: { firstName: NAMES[0].firstName, username: NAMES[0].username, avatarUrl: NAMES[0].avatar },
      trustType: 'friend',
      groupName: MOCK_GROUPS[0].name,
      telegramMessageLink: 'https://t.me/c/1234567890/101',
      matchSource: 'group_message',
    },
    allMatches: [
      { author: { firstName: NAMES[0].firstName, username: NAMES[0].username, avatarUrl: NAMES[0].avatar }, trustType: 'friend', groupName: MOCK_GROUPS[0].name, telegramMessageLink: 'https://t.me/c/1234567890/101', matchSource: 'group_message' },
      { author: { firstName: NAMES[1].firstName, username: NAMES[1].username, avatarUrl: NAMES[1].avatar }, trustType: 'acquaintance', groupName: MOCK_GROUPS[1].name, telegramMessageLink: 'https://t.me/c/1234567890/102', matchSource: 'group_message' },
      { author: { firstName: NAMES[5].firstName, username: NAMES[5].username, avatarUrl: NAMES[5].avatar }, trustType: 'acquaintance', groupName: MOCK_GROUPS[2].name, telegramMessageLink: 'https://t.me/c/1234567890/103', matchSource: 'group_message' },
    ],
  },
  {
    id: 'uo:2002',
    fromCurrency: 'EUR',
    toCurrency: 'GEL',
    amount: 1_500,
    status: 'active',
    matchCount: 2,
    createdAt: new Date(Date.now() - 20 * 60_000).toISOString(),
    paymentMethods: {
      give: [{ currency: 'EUR', methods: ['swift'] }],
      take: [],
    },
    topMatch: {
      author: { firstName: NAMES[2].firstName, username: NAMES[2].username, avatarUrl: NAMES[2].avatar },
      trustType: 'friend',
      groupName: MOCK_GROUPS[0].name,
      telegramMessageLink: 'https://t.me/c/2222222222/201',
      matchSource: 'group_message',
    },
    allMatches: [
      { author: { firstName: NAMES[2].firstName, username: NAMES[2].username, avatarUrl: NAMES[2].avatar }, trustType: 'friend', groupName: MOCK_GROUPS[0].name, telegramMessageLink: 'https://t.me/c/2222222222/201', matchSource: 'group_message' },
      { author: { firstName: NAMES[7].firstName, username: NAMES[7].username, avatarUrl: NAMES[7].avatar }, trustType: 'acquaintance', groupName: MOCK_GROUPS[0].name, telegramMessageLink: 'https://t.me/c/2222222222/202', matchSource: 'group_message' },
    ],
  },
  {
    id: 'uo:2003',
    fromCurrency: 'RUB',
    toCurrency: 'AMD',
    amount: 150_000,
    status: 'active',
    matchCount: 1,
    createdAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
    paymentMethods: {
      give: [{ currency: 'RUB', methods: ['russian_banks'] }],
      take: [],
    },
    topMatch: {
      author: { firstName: NAMES[3].firstName, username: NAMES[3].username, avatarUrl: NAMES[3].avatar },
      trustType: 'acquaintance',
      groupName: MOCK_GROUPS[1].name,
      telegramMessageLink: 'https://t.me/c/3333333333/301',
      matchSource: 'group_message',
    },
    allMatches: [
      { author: { firstName: NAMES[3].firstName, username: NAMES[3].username, avatarUrl: NAMES[3].avatar }, trustType: 'acquaintance', groupName: MOCK_GROUPS[1].name, telegramMessageLink: 'https://t.me/c/3333333333/301', matchSource: 'group_message' },
    ],
  },
  {
    id: 'uo:2004',
    fromCurrency: 'USD',
    toCurrency: 'USDT',
    amount: 5_000,
    status: 'active',
    matchCount: 0,
    createdAt: new Date(Date.now() - 45 * 60_000).toISOString(),
    paymentMethods: {
      give: [{ currency: 'USD', methods: ['swift'] }],
      take: [{ currency: 'USDT', methods: ['crypto'] }],
    },
    topMatch: null,
    allMatches: [],
  },
];

// ─── Match results (for /matches/:offerId page) ────────────────────────────

export const MOCK_MATCHES: MatchResult[] = [
  {
    id: 5001,
    offer: {
      id: 6001,
      fromCurrency: 'RUB',
      toCurrency: 'USDT',
      amount: 300_000,
      amountCurrency: 'RUB',
      paymentMethods: ['russian_banks'],
      originalMessageText: '#ищу 300к руб\n#предлагаю USDT trc20.',
      telegramMessageId: 111,
    },
    author: { telegramId: 600001, username: NAMES[0].username, firstName: NAMES[0].firstName, avatarUrl: NAMES[0].avatar },
    reputation: 95,
    trustType: 'friend',
    groupName: MOCK_GROUPS[0].name,
    telegramMessageLink: 'https://t.me/c/1234567890/111',
    matchSource: 'group_message',
  },
  {
    id: 5002,
    offer: {
      id: 6002,
      fromCurrency: 'RUB',
      toCurrency: 'USDT',
      amount: 150_000,
      amountCurrency: 'RUB',
      paymentMethods: ['russian_banks', 'crypto'],
      originalMessageText: null,
      telegramMessageId: 222,
    },
    author: { telegramId: 600002, username: NAMES[1].username, firstName: NAMES[1].firstName, avatarUrl: NAMES[1].avatar },
    reputation: 82,
    trustType: 'acquaintance',
    groupName: MOCK_GROUPS[1].name,
    telegramMessageLink: 'https://t.me/c/2222222222/222',
    matchSource: 'group_message',
  },
  {
    id: 5003,
    offer: {
      id: 6003,
      fromCurrency: 'RUB',
      toCurrency: 'USDT',
      amount: 500_000,
      amountCurrency: 'RUB',
      paymentMethods: ['russian_banks'],
      originalMessageText: 'Нужен USDT, готов перевести рубли через Тинькофф или Сбер. Работаю быстро, есть отзывы.',
      telegramMessageId: 333,
    },
    author: { telegramId: 600005, username: NAMES[5].username, firstName: NAMES[5].firstName, avatarUrl: NAMES[5].avatar },
    reputation: 71,
    trustType: 'acquaintance',
    groupName: MOCK_GROUPS[2].name,
    telegramMessageLink: 'https://t.me/c/3333333333/333',
    matchSource: 'group_message',
  },
];

export const MOCK_OFFER_TEXT =
  'Меняю 3 000 USDT на рубли. Принимаю на СБП / Сбер / Тинькофф.';

// ─── Contacts ───────────────────────────────────────────────────────────────

export const MOCK_CONTACTS: ContactListItem[] = [
  { id: 3001, type: 'friend',       user: { id: 4001, telegramId: 700001, username: NAMES[0].username, firstName: NAMES[0].firstName, avatarUrl: NAMES[0].avatar } },
  { id: 3002, type: 'friend',       user: { id: 4002, telegramId: 700002, username: NAMES[1].username, firstName: NAMES[1].firstName, avatarUrl: NAMES[1].avatar } },
  { id: 3003, type: 'friend',       user: { id: 4003, telegramId: 700003, username: NAMES[2].username, firstName: NAMES[2].firstName, avatarUrl: NAMES[2].avatar } },
  { id: 3004, type: 'acquaintance', user: { id: 4004, telegramId: 700004, username: NAMES[3].username, firstName: NAMES[3].firstName, avatarUrl: NAMES[3].avatar } },
  { id: 3005, type: 'acquaintance', user: { id: 4005, telegramId: 700005, username: NAMES[4].username, firstName: NAMES[4].firstName, avatarUrl: NAMES[4].avatar } },
  { id: 3006, type: 'acquaintance', user: { id: 4006, telegramId: 700006, username: NAMES[5].username, firstName: NAMES[5].firstName, avatarUrl: NAMES[5].avatar } },
  { id: 3007, type: 'friend',       user: { id: 4007, telegramId: 700007, username: NAMES[6].username, firstName: NAMES[6].firstName, avatarUrl: NAMES[6].avatar } },
  { id: 3008, type: 'acquaintance', user: { id: 4008, telegramId: 700008, username: NAMES[7].username, firstName: NAMES[7].firstName, avatarUrl: NAMES[7].avatar } },
  { id: 3009, type: 'friend',       user: { id: 4009, telegramId: 700009, username: NAMES[8].username, firstName: NAMES[8].firstName, avatarUrl: NAMES[8].avatar } },
  { id: 3010, type: 'acquaintance', user: { id: 4010, telegramId: 700010, username: NAMES[9].username, firstName: NAMES[9].firstName, avatarUrl: NAMES[9].avatar } },
];

// ─── Search results ─────────────────────────────────────────────────────────

export const MOCK_SEARCH_RESULTS: UserSearchResult[] = [
  { id: 5001, telegramId: 800001, username: NAMES[10].username, firstName: NAMES[10].firstName, avatarUrl: NAMES[10].avatar },
  { id: 5002, telegramId: 800002, username: NAMES[11].username, firstName: NAMES[11].firstName, avatarUrl: NAMES[11].avatar },
  { id: 5003, telegramId: 800003, username: NAMES[8].username,  firstName: NAMES[8].firstName,  avatarUrl: NAMES[8].avatar },
];
