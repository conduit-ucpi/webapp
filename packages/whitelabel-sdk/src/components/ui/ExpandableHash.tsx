import { useState } from 'react';
import { useConfig } from '@/components/auth/ConfigProvider';

interface ExpandableHashProps {
  hash: string;
  className?: string;
  showCopyButton?: boolean;
}

export default function ExpandableHash({ 
  hash, 
  className = '', 
  showCopyButton = true 
}: ExpandableHashProps) {
  const { config } = useConfig();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const formatHash = (address: string, expanded: boolean): string => {
    if (!address) return '';
    if (expanded) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(hash);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const toggleExpanded = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleHashClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (config?.explorerBaseUrl) {
      window.open(`${config.explorerBaseUrl}/address/${hash}`, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <div className="inline-flex items-center">
        <a
          href={config?.explorerBaseUrl ? `${config.explorerBaseUrl}/address/${hash}` : '#'}
          onClick={handleHashClick}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-left hover:text-primary-600 transition-colors cursor-pointer underline decoration-transparent hover:decoration-current"
          title={`View on Explorer: ${hash}`}
        >
          {formatHash(hash, isExpanded)}
        </a>
        <button
          type="button"
          onClick={toggleExpanded}
          className="ml-1 p-0.5 hover:bg-gray-100 rounded transition-colors"
          title={isExpanded ? "Click to collapse" : "Click to expand full address"}
        >
          <svg className="h-3 w-3 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isExpanded ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
          </svg>
        </button>
      </div>
      {showCopyButton && (
        <button
          type="button"
          onClick={handleCopy}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="Copy to clipboard"
        >
          {isCopied ? (
            <svg className="h-3 w-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-3 w-3 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}