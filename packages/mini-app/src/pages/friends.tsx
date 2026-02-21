import type { ContactListItem, TrustType, UserSearchResult } from '@hawala/shared';
import { Search, UserPlus, Users, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BottomSheet } from '@/components/ui/bottom-sheet';

export default function FriendsPage() {
  const [contacts, setContacts] = useState<ContactListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Search state
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Invite link state
  const [inviting, setInviting] = useState(false);

  // Remove confirmation state
  const [contactToRemove, setContactToRemove] = useState<ContactListItem | null>(null);
  const [removing, setRemoving] = useState(false);

  const handleInviteFriend = useCallback(async () => {
    if (inviting) return;
    setInviting(true);
    try {
      const res = await fetch('/api/contacts/invite-link');
      if (!res.ok) throw new Error('Failed to get invite link');
      const { link } = await res.json();

      // Try Telegram WebApp share first
      const tg = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } } }).Telegram?.WebApp;
      const shareText = 'Добавь меня в Халве! Это бот для быстрого обмена деньгами среди тех, кому ты доверяешь.';
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`;

      if (tg?.openTelegramLink) {
        tg.openTelegramLink(shareUrl);
      } else {
        window.open(shareUrl, '_blank');
      }
    } catch (err) {
      console.error('Failed to get invite link:', err);
    } finally {
      setInviting(false);
    }
  }, [inviting]);

  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetch('/api/contacts');
      if (res.ok) setContacts(await res.json());
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/contacts/search?q=${encodeURIComponent(query)}`);
        if (res.ok) setSearchResults(await res.json());
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(searchTimeout.current);
  }, [query]);

  const addContact = useCallback(async (targetUserId: number, type: TrustType) => {
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, type }),
      });
      if (res.ok) {
        setQuery('');
        setSearchResults([]);
        fetchContacts();
      }
    } catch (err) {
      console.error('Failed to add contact:', err);
    }
  }, [fetchContacts]);

  const removeContact = useCallback(async () => {
    if (!contactToRemove) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/contacts/${contactToRemove.id}`, { method: 'DELETE' });
      if (res.ok) {
        setContacts((prev) => prev.filter((c) => c.id !== contactToRemove.id));
        setContactToRemove(null);
      }
    } catch (err) {
      console.error('Failed to remove contact:', err);
    } finally {
      setRemoving(false);
    }
  }, [contactToRemove]);

  const trustLabel = (type: TrustType) => (type === 'friend' ? 'Друг' : 'Знакомый');

  return (
    <div className="w-full h-dvh flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-5 pb-4">
        <h1 className="text-[20px] font-bold tracking-tight">Друзья</h1>
        <button
          onClick={handleInviteFriend}
          disabled={inviting}
          className="h-10 px-4 bg-lime text-[#1C1C1E] rounded-full text-[14px] font-semibold flex items-center gap-2 active:scale-95 transition disabled:opacity-50"
        >
          <UserPlus className="w-4 h-4" strokeWidth={2.5} />
          <span>Пригласить</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar px-4 pb-40">
        <div className="sticky top-0 h-6 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none" />
        {/* Search input */}
        <div className="relative mb-4 mt-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти пользователя..."
            className="w-full h-[48px] bg-card border border-border rounded-[16px] pl-11 pr-4 text-[15px] text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setSearchResults([]); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search results dropdown */}
        {query.trim() && (
          <div className="mb-6">
            {searching ? (
              <p className="text-muted-foreground text-[14px] px-2">Поиск...</p>
            ) : searchResults.length === 0 ? (
              <p className="text-muted-foreground text-[14px] px-2">Никого не найдено</p>
            ) : (
              <div className="bg-card rounded-[20px] border border-border overflow-hidden">
                {searchResults.map((user, i) => (
                  <div
                    key={user.id}
                    className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-[15px] font-semibold text-muted-foreground shrink-0 overflow-hidden">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} className="w-full h-full object-cover" />
                      ) : (
                        user.firstName[0]
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-medium truncate">{user.firstName}</p>
                      {user.username && (
                        <p className="text-[13px] text-muted-foreground truncate">@{user.username}</p>
                      )}
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => addContact(user.id, 'friend')}
                        className="h-[32px] px-3 bg-lime text-[#1C1C1E] rounded-[12px] text-[13px] font-semibold active:scale-95 transition"
                      >
                        Друг
                      </button>
                      <button
                        onClick={() => addContact(user.id, 'acquaintance')}
                        className="h-[32px] px-3 bg-card border border-border text-foreground rounded-[12px] text-[13px] font-semibold active:scale-95 transition"
                      >
                        Знакомый
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Contacts list */}
        {loading ? (
          <p className="text-muted-foreground text-[14px] text-center mt-8">Загрузка...</p>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-16 gap-3">
            <Users className="w-12 h-12 text-muted-foreground/40" />
            <p className="text-muted-foreground text-[15px] text-center">
              У вас пока нет контактов.
              <br />
              Найдите друзей через поиск выше.
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-[20px] border border-border overflow-hidden">
            {contacts.map((contact, i) => (
              <div
                key={contact.id}
                className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}
              >
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-[15px] font-semibold text-muted-foreground shrink-0 overflow-hidden">
                  {contact.user.avatarUrl ? (
                    <img src={contact.user.avatarUrl} className="w-full h-full object-cover" />
                  ) : (
                    contact.user.firstName[0]
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium truncate">{contact.user.firstName}</p>
                  {contact.user.username && (
                    <p className="text-[13px] text-muted-foreground truncate">@{contact.user.username}</p>
                  )}
                </div>
                <span className={`text-[12px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                  contact.type === 'friend'
                    ? 'bg-lime/20 text-lime'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {trustLabel(contact.type)}
                </span>
                <button
                  onClick={() => setContactToRemove(contact)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
      {/* Remove contact confirmation */}
      <BottomSheet open={!!contactToRemove} onClose={() => !removing && setContactToRemove(null)}>
        <div className="flex flex-col items-center text-center gap-1 mb-5">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-[22px] font-semibold text-muted-foreground overflow-hidden mb-2">
            {contactToRemove?.user.avatarUrl ? (
              <img src={contactToRemove.user.avatarUrl} className="w-full h-full object-cover" />
            ) : (
              contactToRemove?.user.firstName[0]
            )}
          </div>
          <h2 className="text-[17px] font-semibold">Удалить из контактов?</h2>
          <p className="text-muted-foreground text-[14px]">
            {contactToRemove?.user.firstName}
            {contactToRemove?.user.username && (
              <span> · @{contactToRemove.user.username}</span>
            )}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={removeContact}
            disabled={removing}
            className="w-full h-[50px] rounded-[16px] bg-destructive text-white text-[15px] font-semibold active:scale-[0.98] transition disabled:opacity-50"
          >
            {removing ? 'Удаление...' : 'Удалить'}
          </button>
          <button
            onClick={() => setContactToRemove(null)}
            disabled={removing}
            className="w-full h-[50px] rounded-[16px] bg-muted text-foreground text-[15px] font-semibold active:scale-[0.98] transition disabled:opacity-50"
          >
            Отмена
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
