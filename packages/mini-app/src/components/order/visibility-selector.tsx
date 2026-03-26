import { BottomSheet } from '@/components/ui/bottom-sheet';
import { GroupTooltip } from '@/components/ui/group-tooltip';
import { useTrustedGroups } from '@/hooks/use-trusted-groups';
import { apiFetch } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { cn, openTelegramLink } from '@/lib/utils';
import type { ContactListItem, Visibility } from '@hawala/shared';
import { ChevronRight, CircleHelp, Users } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function useInviteFriend(shareText: string) {
  const [inviting, setInviting] = useState(false);

  const handleInviteFriend = useCallback(async () => {
    if (inviting) return;
    setInviting(true);
    try {
      const res = await apiFetch('/api/contacts/invite-link');
      if (!res.ok) throw new Error('Failed to get invite link');
      const { link } = await res.json();

      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`;
      openTelegramLink(shareUrl);
    } catch (err) {
      console.error('Failed to get invite link:', err);
    } finally {
      setInviting(false);
    }
  }, [inviting, shareText]);

  return { handleInviteFriend, inviting };
}

interface VisibilitySelectorProps {
  value: Visibility;
  onChange: (value: Visibility) => void;
}

export function VisibilitySelector({ value, onChange }: VisibilitySelectorProps) {
  const navigate = useNavigate();
  const { groups } = useTrustedGroups();
  const { lang } = useI18n();
  const copy = lang === 'ru'
    ? {
        shareText: 'Добавь меня в Халве! Это бот для быстрого обмена деньгами среди тех, кому ты доверяешь.',
        friendsAndAcquaintances: 'Друзья и знакомые',
        friendsOnly: 'Только друзья',
        faq: 'В чём разница?',
        faqText1: 'При выборе "Друзья и знакомые" поиск будет осуществляться среди всех сообщений в ',
        trustedGroup: 'доверенной группе',
        faqText1Tail: ', где состоит бот.',
        faqText2: 'При выборе "Только друзья" ищем подходящие заявки только среди тех пользователей, которых вы добавили в список друзей самостоятельно.',
        howToAddFriends: 'Как добавлять друзей',
        sendInvite: 'Отправьте приглашение в Халву',
        guideText1: 'Когда он перейдёт по пригласительной ссылке, вы автоматически появитесь в списках друзей друг у друга.',
        guideText2: 'Ещё можно переслать любое сообщение друга прямо в личку боту — этого достаточно, чтобы он появился в списке друзей.',
        noFriendsTitle: 'Вы не добавили друзей',
        noFriendsText: 'При поиске только среди друзей вы никого не найдёте. Сначала добавьте друзей или выберите опцию "Друзья и знакомые", чтобы искать среди сообщений знакомых в доверенной группе.',
        searchAcquaintances: 'Искать среди знакомых тоже',
        addFriends: 'Добавить друзей',
      }
    : {
        shareText: 'Add me on Halwa. It is a bot for quick money exchange among people you trust.',
        friendsAndAcquaintances: 'Friends and acquaintances',
        friendsOnly: 'Only friends',
        faq: 'What is the difference?',
        faqText1: 'With "Friends and acquaintances", the search runs across all messages in the ',
        trustedGroup: 'trusted group',
        faqText1Tail: ' where the bot is present.',
        faqText2: 'With "Only friends", matching only looks through users you added to your friends list yourself.',
        howToAddFriends: 'How to add friends',
        sendInvite: 'Send a Halwa invite',
        guideText1: 'When they follow the invitation link, you will automatically appear in each other’s friends lists.',
        guideText2: 'You can also forward any message from a friend directly to the bot in a private chat. That is enough to add them to your friends list.',
        noFriendsTitle: 'You have not added friends',
        noFriendsText: 'If you search only among friends, you will not find anyone. Add friends first or choose "Friends and acquaintances" to search among acquaintance messages in a trusted group.',
        searchAcquaintances: 'Search among acquaintances too',
        addFriends: 'Add friends',
      };
  const { handleInviteFriend, inviting } = useInviteFriend(copy.shareText);
  const options: Array<{ value: Visibility; label: string }> = [
    { value: 'friends_and_acquaintances', label: copy.friendsAndAcquaintances },
    { value: 'friends_only', label: copy.friendsOnly },
  ];
  const [faqOpen, setFaqOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const faqContentRef = useRef<HTMLDivElement>(null);
  const [noFriendsWarningOpen, setNoFriendsWarningOpen] = useState(false);
  const [friendsCount, setFriendsCount] = useState<number | null>(null);

  useEffect(() => {
    apiFetch('/api/contacts')
      .then((res) => res.json())
      .then((contacts: ContactListItem[]) => {
        const friends = contacts.filter((c) => c.type === 'friend');
        setFriendsCount(friends.length);
      })
      .catch(() => {});
  }, []);

  const handleOptionSelect = useCallback((optionValue: Visibility) => {
    if (optionValue === 'friends_only' && friendsCount === 0) {
      setNoFriendsWarningOpen(true);
      return;
    }
    onChange(optionValue);
  }, [friendsCount, onChange]);

  const handleGoToFriends = useCallback(() => {
    setNoFriendsWarningOpen(false);
    navigate('/friends');
  }, [navigate]);

  const handleSelectFriendsAndAcquaintances = useCallback(() => {
    setNoFriendsWarningOpen(false);
    onChange('friends_and_acquaintances');
  }, [onChange]);

  useEffect(() => {
    if (faqOpen && faqContentRef.current) {
      setTimeout(() => {
        faqContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 50);
    }
  }, [faqOpen]);

  return (
    <div className="px-1">
      <div className="flex flex-col gap-3">
        {options.map((option) => {
          const isSelected = value === option.value;

          return (
            <label key={option.value} className="relative block cursor-pointer group">
              <input
                type="radio"
                name="visibility"
                checked={isSelected}
                onChange={() => handleOptionSelect(option.value)}
                className="peer hidden"
              />
              <div
                className={cn(
                  'flex items-center justify-between bg-card p-4 rounded-[20px] border transition overflow-hidden',
                  isSelected
                    ? 'border-foreground/20'
                    : 'border-transparent hover:border-border',
                )}
              >
                <div className="flex items-center gap-3 z-10">
                  {/* Radio circle */}
                  <div
                    className={cn(
                      'w-6 h-6 rounded-full border-[2px] relative z-10 box-border transition-all duration-300 shrink-0',
                      isSelected
                        ? 'border-foreground bg-foreground'
                        : 'border-muted-foreground',
                    )}
                  >
                    {isSelected && (
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-background rounded-full" />
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-[16px] font-medium text-foreground',
                    )}
                  >
                    {option.label}
                  </span>
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {/* FAQ Accordion */}
      <div className="mt-6 ml-1">
        <button
          onClick={() => setFaqOpen((v) => !v)}
          className="group flex items-center gap-2.5 text-muted-foreground font-medium hover:text-foreground transition outline-none"
        >
          <ChevronRight
            className={cn(
              'w-4 h-4 transition-transform duration-300',
              faqOpen && 'rotate-90',
            )}
          />
          <span>{copy.faq}</span>
        </button>
        <div
          ref={faqContentRef}
          className={cn(
            'transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
            faqOpen ? 'max-h-70 opacity-100' : 'max-h-0 opacity-0 overflow-hidden',
          )}
        >
          <div className="pt-3 pb-1 pl-6 pr-2 flex flex-col gap-2">
            <p className="text-muted-foreground text-[14px] leading-relaxed">
              {copy.faqText1}
              <GroupTooltip groups={groups} className="decoration-muted-foreground/50">
                {copy.trustedGroup}
              </GroupTooltip>
              {copy.faqText1Tail}
            </p>
            <p className="text-muted-foreground text-[14px] leading-relaxed">
            {copy.faqText2} <span
              onClick={() => setGuideOpen(true)}
              className="inline-flex items-center gap-1 text-muted-foreground text-[14px] leading-relaxed hover:text-foreground transition underline"
            >
              <CircleHelp className="w-3.5 h-3.5 shrink-0" />
              {copy.howToAddFriends}
              
            </span>
            </p>

          </div>
        </div>
      </div>

      <BottomSheet open={guideOpen} onClose={() => setGuideOpen(false)}>
        <h3 className="text-[17px] font-semibold text-foreground mb-3">
          {copy.howToAddFriends}
        </h3>
        <div className="flex flex-col gap-2.5">
          <p>
            <button
              onClick={handleInviteFriend}
              disabled={inviting}
              className="underline decoration-lime text-foreground font-medium underline-offset-2 hover:opacity-70 transition-opacity disabled:opacity-50"
            >
              {copy.sendInvite}
            </button>
          </p>
          <p className="text-muted-foreground text-[14px] leading-relaxed">
            {copy.guideText1}
          </p>
          <p className="text-muted-foreground text-[14px] leading-relaxed">
            {copy.guideText2}
          </p>
        </div>
      </BottomSheet>

      <BottomSheet open={noFriendsWarningOpen} onClose={() => setNoFriendsWarningOpen(false)}>
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <Users className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="text-[18px] font-bold text-foreground mb-2">
            {copy.noFriendsTitle}
          </h3>
          <p className="text-[15px] text-muted-foreground mb-6 leading-relaxed">
            {copy.noFriendsText}
          </p>
        </div>
        <div className="flex flex-col gap-3">
        <button
            onClick={handleSelectFriendsAndAcquaintances}
            className="w-full h-[52px] rounded-[20px] bg-lime text-[#1C1C1E] font-bold text-[16px] active:scale-[0.98] transition-all"
          >
            {copy.searchAcquaintances}
          </button>
          <button
            onClick={handleGoToFriends}
            className="w-full h-[52px] rounded-[20px] bg-accent text-foreground font-semibold text-[16px] active:scale-[0.98] transition-all"
            
          >
            {copy.addFriends}
          </button>

        </div>
      </BottomSheet>
    </div>
  );
}
