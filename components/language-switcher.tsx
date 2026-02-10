'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const switchLanguage = (locale: 'en' | 'fr') => {
    startTransition(() => {
      // Set cookie for locale
      document.cookie = `locale=${locale}; path=/; max-age=31536000`;
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-muted-foreground" />
      <Button
        variant="ghost"
        size="sm"
        onClick={() => switchLanguage('en')}
        disabled={isPending}
      >
        EN
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => switchLanguage('fr')}
        disabled={isPending}
      >
        FR
      </Button>
    </div>
  );
}
