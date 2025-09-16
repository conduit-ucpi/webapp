import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/router';

interface NavigationContextType {
  history: string[];
  canGoBack: boolean;
  goBack: () => void;
  currentPath: string;
}

const NavigationContext = createContext<NavigationContextType>({
  history: [],
  canGoBack: false,
  goBack: () => {},
  currentPath: '/',
});

export const useNavigation = () => useContext(NavigationContext);

interface NavigationProviderProps {
  children: ReactNode;
}

export function NavigationProvider({ children }: NavigationProviderProps) {
  const router = useRouter();
  const [history, setHistory] = useState<string[]>(['/']);
  const [currentPath, setCurrentPath] = useState('/');

  useEffect(() => {
    const handleRouteChange = (url: string) => {
      setHistory(prev => {
        // Don't add duplicate consecutive entries
        if (prev[prev.length - 1] === url) {
          return prev;
        }
        // Limit history to last 10 pages to prevent memory issues
        const newHistory = [...prev, url];
        if (newHistory.length > 10) {
          newHistory.shift();
        }
        return newHistory;
      });
      setCurrentPath(url);
    };

    // Set initial path
    handleRouteChange(router.pathname);

    router.events.on('routeChangeComplete', handleRouteChange);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router]);

  const canGoBack = history.length > 1 && currentPath !== '/';

  const goBack = () => {
    if (canGoBack) {
      // Remove current page from history
      const newHistory = [...history];
      newHistory.pop();
      
      if (newHistory.length > 0) {
        const previousPath = newHistory[newHistory.length - 1];
        setHistory(newHistory);
        router.push(previousPath);
      } else {
        router.push('/');
      }
    }
  };

  return (
    <NavigationContext.Provider value={{ history, canGoBack, goBack, currentPath }}>
      {children}
    </NavigationContext.Provider>
  );
}