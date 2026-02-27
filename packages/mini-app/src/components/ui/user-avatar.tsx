import { useState } from 'react';

interface UserAvatarProps {
  telegramId: number;
  firstName: string;
  avatarUrl?: string | null;
  className?: string;
}

export function UserAvatar({ telegramId, firstName, avatarUrl, className = 'w-10 h-10' }: UserAvatarProps) {
  const [failed, setFailed] = useState(false);

  const src = avatarUrl || `/api/avatar/${telegramId}`;

  return (
    <div className={`${className} rounded-full bg-muted flex items-center justify-center text-[15px] font-semibold text-muted-foreground shrink-0 overflow-hidden`}>
      {!failed ? (
        <img
          src={src}
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        firstName.charAt(0).toUpperCase()
      )}
    </div>
  );
}
