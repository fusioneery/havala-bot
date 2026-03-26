import { DEFAULT_APP_LANGUAGE, type AppLanguage, normalizeLanguage, resolveLanguage } from '@hawala/shared';

export function resolveBotLanguage(options?: {
  lang?: string | null | undefined;
  locale?: string | null | undefined;
  locales?: Array<string | null | undefined>;
}): AppLanguage {
  return resolveLanguage(options);
}

export function getStoredLanguage(value: string | null | undefined): AppLanguage {
  return normalizeLanguage(value) ?? DEFAULT_APP_LANGUAGE;
}

export function localeForLanguage(lang: AppLanguage): string {
  return lang === 'ru' ? 'ru-RU' : 'en-US';
}

export function formatNumber(value: number, lang: AppLanguage, options?: Intl.NumberFormatOptions): string {
  return value.toLocaleString(localeForLanguage(lang), options);
}

export function getTrustTypeLabel(type: 'friend' | 'acquaintance', lang: AppLanguage): string {
  return lang === 'ru'
    ? (type === 'friend' ? 'друг' : 'знакомый')
    : (type === 'friend' ? 'friend' : 'acquaintance');
}

export function getBotCopy(lang: AppLanguage) {
  if (lang === 'ru') {
    return {
      matchNotFound: 'Мэтч не найден.',
      dataNotFound: 'Данные не найдены.',
      thanksForFeedback: 'Спасибо за обратную связь! Мы записали информацию об ошибке. Ваша заявка отменена.',
      feedbackSaveError: 'Произошла ошибка при сохранении отзыва.',
      friendAddedNotification: (firstName: string) =>
        `${firstName} добавил вас в друзья в Халве, теперь вы можете видеть заявки на обмен друг друга.`,
      createOffer: 'Создать заявку',
      openApp: 'Открыть Халву',
      toggleFriendNotifyButton: (notifyEnabled: boolean) =>
        notifyEnabled ? '🔕 Не уведомлять о новых друзьях' : '🔔 Уведомлять о новых друзьях',
      welcomeText: (args: { miniAppUrl: string; groupListText: string; referrerFirstName?: string | null }) => [
        '<b>Халва</b> — бот для поиска обменов валюты без посредников и комиссий.',
        '',
        '<b>Как это работает:</b>',
        `1. Создайте заявку на обмен в <a href="${args.miniAppUrl}">мини-приложении</a>.`,
        `2. Бот находит подходящие предложения среди друзей и сообщений в доверенных группах${args.groupListText}.`,
        '3. При совпадении — получите контакт автора предложения чтобы договориться об обмене напрямую.',
        '',
        '🔒 Бот не хранит деньги и не участвует в расчётах — только соединяет людей.',
        '',
        args.referrerFirstName ? `🎉 Вы и ${args.referrerFirstName} теперь друзья в Халве!` : '',
      ].filter(Boolean).join('\n'),
      trustFriend: 'Друг',
      trustAcquaintance: 'Знакомый',
      trustPrompt: 'Добавить этого человека как друга или знакомого?',
      forwardedUserUnknown: 'Не удалось определить пользователя из пересланного сообщения',
      cannotAddSelf: 'Нельзя добавить себя в контакты',
      runStartFirst: 'Сначала запустите бота командой /start',
      addedAs: (label: string) => `Добавлен как ${label}!`,
      addedAsMessage: (label: string, suffix: string) => `✅ Добавлен как ${label}${suffix}`,
      saveError: 'Произошла ошибка при сохранении',
      invalidId: 'Ошибка: неверный ID',
      invalidData: 'Ошибка: неверные данные',
      exchangeSuccessRecorded: 'Отлично! Обмен записан как успешный.',
      exchangeSuccessSuffix: '✅ *Обмен завершён успешно!*',
      genericError: 'Произошла ошибка',
      describeProblem: 'Напишите, что именно пошло не так. Это поможет нам улучшить бот.',
      notRegisteredStart: 'Вы ещё не зарегистрированы. Нажмите /start',
      noFriends: 'У вас пока нет друзей. Перешлите мне сообщение друга или отправьте ему реферальную ссылку.',
      yourFriends: (count: number, lines: string[]) => `Ваши друзья (${count}):\n\n${lines.join('\n')}`,
      deleteForever: 'Да, удалить навсегда',
      cancel: 'Отмена',
      deleteConfirmation:
        '⚠️ Вы уверены?\n\n'
        + 'Эта команда безвозвратно удалит ВСЕ ваши данные:\n'
        + '• Контакты и связи доверия\n'
        + '• Все заявки и мэтчи\n'
        + '• Историю обменов\n'
        + '• Реферальный код\n\n'
        + 'После удаления ваш аккаунт будет заблокирован навсегда. Это действие нельзя отменить.',
      deletingData: 'Удаление данных...',
      accountDeleted: 'Ваш аккаунт удалён и заблокирован навсегда. Прощайте.',
      deleteError: 'Произошла ошибка при удалении. Обратитесь к админу.',
      cancelled: 'Отменено',
      deleteCancelled: 'Удаление отменено.',
      userNotFound: 'Пользователь не найден',
      notificationsEnabled: 'Уведомления включены',
      notificationsDisabled: 'Уведомления выключены',
      matchFoundTitle: '🎉 *Нашлась подходящая заявка на обмен!*',
      originalGroupMessage: 'Оригинальное сообщение в группе',
      afterExchangePrompt: '_После обмена, пожалуйста, нажмите одну из кнопок ниже_',
      dmIntro: (fromCurrency: string, toCurrency: string, groupName: string) =>
        `Привет! Нашёл твою заявку на обмен ${fromCurrency} → ${toCurrency} в «${groupName}»`,
      openDirectMessages: '💬 Перейти в личку',
      exchangedSuccessfully: '✅ Успешно поменялся',
      exchangeFailed: '❌ Неуспех / ошибка',
    };
  }

  return {
    matchNotFound: 'Match not found.',
    dataNotFound: 'Data not found.',
    thanksForFeedback: 'Thanks for the feedback. We saved the error report and cancelled your offer.',
    feedbackSaveError: 'An error occurred while saving your report.',
    friendAddedNotification: (firstName: string) =>
      `${firstName} added you as a friend in Halwa. You can now see each other’s exchange offers.`,
    createOffer: 'Create offer',
    openApp: 'Open Halwa',
    toggleFriendNotifyButton: (notifyEnabled: boolean) =>
      notifyEnabled ? '🔕 Disable new friend alerts' : '🔔 Enable new friend alerts',
    welcomeText: (args: { miniAppUrl: string; groupListText: string; referrerFirstName?: string | null }) => [
      '<b>Halwa</b> is a bot for finding currency exchanges without middlemen or fees.',
      '',
      '<b>How it works:</b>',
      `1. Create an exchange offer in the <a href="${args.miniAppUrl}">mini app</a>.`,
      `2. The bot finds matching offers among your friends and messages in trusted groups${args.groupListText}.`,
      '3. When there is a match, you get the author’s contact so you can arrange the exchange directly.',
      '',
      '🔒 The bot does not hold money and does not participate in transfers. It only connects people.',
      '',
      args.referrerFirstName ? `🎉 You and ${args.referrerFirstName} are now friends in Halwa!` : '',
    ].filter(Boolean).join('\n'),
    trustFriend: 'Friend',
    trustAcquaintance: 'Acquaintance',
    trustPrompt: 'Add this person as a friend or acquaintance?',
    forwardedUserUnknown: 'Could not identify the user from the forwarded message',
    cannotAddSelf: 'You cannot add yourself to contacts',
    runStartFirst: 'Start the bot first with /start',
    addedAs: (label: string) => `Added as ${label}.`,
    addedAsMessage: (label: string, suffix: string) => `✅ Added as ${label}${suffix}`,
    saveError: 'An error occurred while saving',
    invalidId: 'Error: invalid ID',
    invalidData: 'Error: invalid data',
    exchangeSuccessRecorded: 'Great. The exchange was recorded as successful.',
    exchangeSuccessSuffix: '✅ *Exchange completed successfully!*',
    genericError: 'An error occurred',
    describeProblem: 'Please describe what went wrong. This helps us improve the bot.',
    notRegisteredStart: 'You are not registered yet. Press /start',
    noFriends: 'You have no friends yet. Forward a friend’s message to me or send them your referral link.',
    yourFriends: (count: number, lines: string[]) => `Your friends (${count}):\n\n${lines.join('\n')}`,
    deleteForever: 'Yes, delete forever',
    cancel: 'Cancel',
    deleteConfirmation:
      '⚠️ Are you sure?\n\n'
      + 'This command will permanently delete ALL your data:\n'
      + '• Contacts and trust relations\n'
      + '• All offers and matches\n'
      + '• Exchange history\n'
      + '• Referral code\n\n'
      + 'Your account will then be permanently blocked. This action cannot be undone.',
    deletingData: 'Deleting data...',
    accountDeleted: 'Your account was deleted and permanently blocked.',
    deleteError: 'An error occurred while deleting your data. Contact the admin.',
    cancelled: 'Cancelled',
    deleteCancelled: 'Deletion cancelled.',
    userNotFound: 'User not found',
    notificationsEnabled: 'Notifications enabled',
    notificationsDisabled: 'Notifications disabled',
    matchFoundTitle: '🎉 *A matching exchange offer was found!*',
    originalGroupMessage: 'Original group message',
    afterExchangePrompt: '_After the exchange, please tap one of the buttons below_',
    dmIntro: (fromCurrency: string, toCurrency: string, groupName: string) =>
      `Hi! I found your ${fromCurrency} → ${toCurrency} exchange offer in “${groupName}”.`,
    openDirectMessages: '💬 Open chat',
    exchangedSuccessfully: '✅ Exchanged successfully',
    exchangeFailed: '❌ Failed / error',
  };
}
