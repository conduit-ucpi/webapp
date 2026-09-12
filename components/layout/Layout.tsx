import { useRouter } from 'next/router';
import Header from './Header';
import Footer from './Footer';
import EmailPromptManager from '@/components/auth/EmailPromptManager';
import { WHITE_LABEL_ROUTES } from '@/utils/brand';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const router = useRouter();
  
  // Shopify embedded app - no layout at all
  if (router.pathname === '/shopify/embedded') {
    return <>{children}</>;
  }

  // White-labelled routes carry a partner's branding, so none of ours can
  // appear alongside it — no header, no footer. The page supplies its own.
  if (WHITE_LABEL_ROUTES.has(router.pathname)) {
    return (
      <div className="min-h-screen">
        <EmailPromptManager children={children} />
      </div>
    );
  }

  // Don't use main layout for plugin pages
  if (router.pathname === '/contract-create') {
    return (
      <div className="min-h-screen bg-gray-50">
        <EmailPromptManager children={children} />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-secondary-900 transition-colors">
      <Header />
      <main className="flex-grow pb-20">
        <EmailPromptManager children={children} />
      </main>
      <Footer />
    </div>
  );
}