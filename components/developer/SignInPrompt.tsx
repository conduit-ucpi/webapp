import { useRouter } from 'next/router';
import WalletChoiceCards from '@/components/auth/WalletChoiceCards';

/**
 * What a signed-out visitor sees on a page that needs them signed in: a short reason and the same
 * wallet gate as /dashboard, so signing in looks the same wherever it is asked. `?autoConnect=true`
 * opens the sign-in straight away, as it does on /dashboard.
 */
export default function SignInPrompt({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  const router = useRouter();
  const autoConnect = router.query.autoConnect === 'true';

  return (
    <div className="bg-white dark:bg-secondary-900 transition-colors min-h-[80vh] flex items-center">
      <div className="max-w-3xl mx-auto px-6 sm:px-8 w-full text-center">
        <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-6">{eyebrow}</p>
        <h1 className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug mb-4">{title}</h1>
        <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-10 max-w-md mx-auto">{body}</p>
        <WalletChoiceCards autoConnect={autoConnect} className="mx-auto w-full max-w-md text-left" />
      </div>
    </div>
  );
}
