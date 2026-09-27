import { useRouter } from 'next/router';
import SiteNav from './SiteNav';

export default function Header() {
  const router = useRouter();

  // Don't show header on plugin pages
  if (router.pathname === '/contract-create') {
    return null;
  }

  return <SiteNav className="sticky top-0 z-40" />;
}
