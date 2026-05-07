import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { LogoutButton } from '@/features/auth/components/LogoutButton';
import { useAuth } from '@/features/auth/Auth';
import { HomeLayout } from '@/features/layouts/HomeLayout';

export default function IndexPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  useEffect(() => {
    if (user === null) {
      window.location.replace('/home');
    }
  }, [user]);

  if (!user) {
    return null;
  }

  return (
    <HomeLayout>
      <h1>{t('Welcome to the Hub')}</h1>
      <div>
        <LogoutButton />
      </div>
    </HomeLayout>
  );
}
