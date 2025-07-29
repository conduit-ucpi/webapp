import { useState } from 'react';

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

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={toggleExpanded}
        className="font-mono text-left hover:text-primary-600 transition-colors cursor-pointer"
        title={isExpanded ? "Click to collapse" : "Click to expand full address"}
      >
        {formatHash(hash, isExpanded)}
      </button>
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