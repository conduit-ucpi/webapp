import { useRouter } from 'next/router';
import { useAuth } from '@/components/auth';
import CreateContractWizard from '@/components/contracts/CreateContractWizard';
import WalletChoiceCards from '@/components/auth/WalletChoiceCards';
import Skeleton from '@/components/ui/Skeleton';
import { getSiteNameFromDomain } from '@/utils/siteName';
import CreateProgressSteps from '@/components/contracts/CreateProgressSteps';
import { useT } from '../i18n';
import { useOptionalBrand, useBrandSource } from '../theme/BrandProvider';

// Keys rather than sentences: the catalogue owns the wording.
const HOW_IT_WORKS = [
  'create.step.amount',
  'create.step.escrow',
  'create.step.release',
] as const;

export default function CreatePage() {
  const { isLoading, isConnected, address } = useAuth();
  const router = useRouter();
  const autoConnect = router.query.autoConnect === 'true';
  const t = useT();

  // A selected partner names itself; otherwise the hostname decides, so
  // instantescrow.nz and usdcbay.com keep their own names.
  const brand = useOptionalBrand();
  const brandSource = useBrandSource();

  if (isLoading) {
    return (
      <div className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <Skeleton className="h-8 w-80 mx-auto mb-2" />
            <Skeleton className="h-4 w-96 mx-auto" />
          </div>
          <div className="flex justify-center">
            <div className="bg-white rounded-lg border border-secondary-200 p-8 w-full max-w-2xl">
              <div className="space-y-6">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-12 w-32" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check for wallet connection instead of backend user
  // Backend auth (SIWE) is not required - lazy auth will trigger on first API call
  if (!isConnected || !address) {
    const siteName = getSiteNameFromDomain();
    const displayName =
      brand && brandSource && brandSource !== 'default' ? brand.name : siteName;

    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {/* Step 1 of the create-request journey. Steps 2 and 3 are the wizard
            stages the user reaches once connected - same component, so the
            circles stay consistent across both screens. */}
        <CreateProgressSteps current={0} />

        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-secondary-900 dark:text-white tracking-tight">
            {t('create.getStarted', { brand: displayName })}
          </h1>
          <p className="mt-3 text-secondary-500 dark:text-secondary-400">
            {t('create.walletBlurb')}
          </p>
        </div>

        <WalletChoiceCards autoConnect={autoConnect} />

        <div className="mt-6 rounded-2xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 p-6 sm:p-7">
          <h2 className="text-lg font-semibold text-secondary-900 dark:text-white">
            {t('create.howThisWorks')}
          </h2>
          <ol className="mt-5 space-y-4">
            {HOW_IT_WORKS.map((key, i) => (
              <li key={key} className="flex gap-4">
                <span className="shrink-0 w-7 h-7 rounded-full bg-secondary-200 dark:bg-secondary-700 text-secondary-600 dark:text-secondary-300 grid place-items-center text-xs font-semibold">
                  {i + 1}
                </span>
                <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed pt-1">
                  {t(key)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-secondary-900">{t('create.title')}</h1>
          <p className="mt-2 text-secondary-600">
            {t('create.subtitle')}
          </p>
        </div>

        <div className="flex justify-center">
          <CreateContractWizard />
        </div>
      </div>
    </div>
  );
}