import { useRouter } from 'next/router';
import Header from './Header';
import Footer from './Footer';
import EmailPromptManager from '../auth/EmailPromptManager';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const router = useRouter();
  
  // Don't use main layout for plugin pages
  if (router.pathname === '/contract-create') {
    return (
      <div className="min-h-screen bg-gray-50">
        <EmailPromptManager>
          {children}
        </EmailPromptManager>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-secondary-900 transition-colors">
      <Header />
      <main className="flex-grow pb-20">
        <EmailPromptManager>
          {children}
        </EmailPromptManager>
      </main>
      <Footer />
    </div>
  );
}