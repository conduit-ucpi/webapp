import { useState, useEffect, useCallback, Fragment } from 'react';
import { Combobox, Transition } from '@headlessui/react';
import { MagnifyingGlassIcon, UserIcon, EnvelopeIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useDebounce } from '@/hooks/useDebounce';

interface FarcasterUser {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  followerCount: number;
  verified: boolean;
}

interface BuyerInputProps {
  value: string;
  onChange: (value: string, type: 'email' | 'farcaster') => void;
  error?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  helpText?: string;
}

export default function BuyerInput({
  value,
  onChange,
  error,
  label = "Buyer",
  placeholder = "Search Farcaster user or enter email",
  required = false,
  helpText
}: BuyerInputProps) {
  const { config } = useConfig();
  const [inputValue, setInputValue] = useState(value);
  const [buyerType, setBuyerType] = useState<'email' | 'farcaster' | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<FarcasterUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<FarcasterUser | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const debouncedSearch = useDebounce(inputValue, 300);
  const hasNeynarKey = !!config?.neynarApiKey;

  // Determine if input is an email
  const isEmail = useCallback((text: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(text);
  }, []);

  // Determine if input looks like a Farcaster search
  const isFarcasterSearch = useCallback((text: string) => {
    // If it's an email, it's not a Farcaster search
    if (isEmail(text)) return false;
    // If it has @ but not an email, likely a Farcaster handle
    if (text.includes('@')) return true;
    // If it's alphanumeric without spaces, could be a username search
    if (/^[a-zA-Z0-9_-]+$/.test(text)) return true;
    return false;
  }, [isEmail]);

  // Search for Farcaster users
  const searchUsers = useCallback(async (query: string) => {
    if (!hasNeynarKey || !query || query.length < 1) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.users || []);
        setShowDropdown(true);
      } else {
        console.error('Failed to search users');
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [hasNeynarKey]);

  // Handle search based on input
  useEffect(() => {
    if (!debouncedSearch) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    if (isEmail(debouncedSearch)) {
      // It's an email, no need to search
      setBuyerType('email');
      setSearchResults([]);
      setShowDropdown(false);
      setSelectedUser(null);
    } else if (isFarcasterSearch(debouncedSearch) && hasNeynarKey) {
      // Search for Farcaster users
      setBuyerType('farcaster');
      searchUsers(debouncedSearch);
    } else {
      // Clear search if input doesn't match any pattern
      setSearchResults([]);
      setShowDropdown(false);
    }
  }, [debouncedSearch, isEmail, isFarcasterSearch, searchUsers, hasNeynarKey]);

  // Handle input change
  const handleInputChange = (newValue: string) => {
    setInputValue(newValue);
    
    // Clear selected user if typing
    if (selectedUser) {
      setSelectedUser(null);
    }

    // Determine type and notify parent
    if (isEmail(newValue)) {
      onChange(newValue, 'email');
    } else if (newValue === '') {
      onChange('', 'email');
    }
  };

  // Handle user selection
  const handleUserSelect = (user: FarcasterUser) => {
    const farcasterHandle = `@${user.username}`;
    setInputValue(farcasterHandle);
    setSelectedUser(user);
    setBuyerType('farcaster');
    setShowDropdown(false);
    onChange(farcasterHandle, 'farcaster');
  };

  // Get display helper text
  const getHelperText = () => {
    if (helpText) return helpText;
    
    if (!hasNeynarKey) {
      return "Enter the buyer's email address";
    }
    
    if (selectedUser) {
      return `Selected: ${selectedUser.displayName} (@${selectedUser.username})`;
    }
    
    if (buyerType === 'email') {
      return "Using email address for buyer";
    }
    
    if (buyerType === 'farcaster' && inputValue && !isSearching) {
      return searchResults.length > 0 
        ? "Select a user from the list" 
        : "No Farcaster users found";
    }
    
    return "Type to search Farcaster users or enter an email address";
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        <Combobox value={selectedUser} onChange={handleUserSelect}>
          <div className="relative">
            <div className="relative">
              <Combobox.Input
                className={`w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  error ? 'border-red-300' : 'border-gray-300'
                }`}
                displayValue={(user: FarcasterUser | null) => 
                  user ? `@${user.username}` : inputValue
                }
                onChange={(event) => handleInputChange(event.target.value)}
                placeholder={placeholder}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                {isSearching ? (
                  <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-blue-500 rounded-full" />
                ) : buyerType === 'email' ? (
                  <EnvelopeIcon className="h-5 w-5 text-gray-400" />
                ) : buyerType === 'farcaster' && selectedUser ? (
                  <CheckIcon className="h-5 w-5 text-green-500" />
                ) : (
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                )}
              </div>
            </div>

            <Transition
              as={Fragment}
              show={showDropdown && searchResults.length > 0}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Combobox.Options className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none">
                {searchResults.map((user) => (
                  <Combobox.Option
                    key={user.fid}
                    value={user}
                    className={({ active }) =>
                      `relative cursor-pointer select-none py-2 px-4 ${
                        active ? 'bg-blue-50 text-blue-900' : 'text-gray-900'
                      }`
                    }
                  >
                    <div className="flex items-center space-x-3">
                      {user.pfpUrl ? (
                        <img
                          src={user.pfpUrl}
                          alt={user.displayName}
                          className="h-8 w-8 rounded-full"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                          <UserIcon className="h-5 w-5 text-gray-500" />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center">
                          <span className="font-medium">{user.displayName}</span>
                          {user.verified && (
                            <svg className="ml-1 h-4 w-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          @{user.username} · {user.followerCount.toLocaleString()} followers
                        </div>
                      </div>
                    </div>
                  </Combobox.Option>
                ))}
              </Combobox.Options>
            </Transition>
          </div>
        </Combobox>

        {/* Selected user display */}
        {selectedUser && (
          <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center space-x-2">
              {selectedUser.pfpUrl ? (
                <img
                  src={selectedUser.pfpUrl}
                  alt={selectedUser.displayName}
                  className="h-6 w-6 rounded-full"
                />
              ) : (
                <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center">
                  <UserIcon className="h-4 w-4 text-gray-500" />
                </div>
              )}
              <span className="text-sm text-blue-900">
                {selectedUser.displayName} (@{selectedUser.username})
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Helper text */}
      <p className={`mt-1 text-sm ${error ? 'text-red-600' : 'text-gray-500'}`}>
        {error || getHelperText()}
      </p>
    </div>
  );
}