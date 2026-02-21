import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useBackButton(to: string = '/') {
  const navigate = useNavigate();

  useEffect(() => {
    const backButton = window.Telegram?.WebApp?.BackButton;
    if (!backButton) return;

    const handleBack = () => {
      navigate(to);
    };

    backButton.onClick(handleBack);
    backButton.show();

    return () => {
      backButton.offClick(handleBack);
      backButton.hide();
    };
  }, [navigate, to]);
}
