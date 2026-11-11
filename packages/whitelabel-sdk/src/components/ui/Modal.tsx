import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'small' | 'medium' | 'large' | 'xl';
  /**
   * Follow the page's light or dark theme, for content written with `dark:` classes (anything
   * that also appears on a page, such as the payment address panel).
   *
   * ⚠️ OFF BY DEFAULT, AND THE TWO DO NOT MIX. The panel is otherwise white in dark mode too, and
   *    most modals are written for that, in fixed greys. Content with `dark:` classes put in a
   *    white panel turns light-on-white in dark mode: pale text, pale borders, dark blocks.
   */
  themed?: boolean;
}

export default function Modal({ isOpen, onClose, title, children, size = 'medium', themed = false }: ModalProps) {
  const sizeClasses = {
    small: 'max-w-md',
    medium: 'max-w-lg', 
    large: 'max-w-4xl',
    xl: 'max-w-6xl'
  };
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className={`fixed inset-0 bg-black ${themed ? 'bg-opacity-25 dark:bg-opacity-60' : 'bg-opacity-25'}`} />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              {/* The panel is white in dark mode too, and html.dark's color-scheme turns the browser's
                  default text white, so it sets its own text colour for whatever inherits it. */}
              <Dialog.Panel
                data-themed={themed || undefined}
                className={`w-full ${sizeClasses[size]} transform overflow-hidden rounded-2xl p-6 text-left align-middle shadow-xl transition-all ${
                  themed
                    ? 'bg-white text-secondary-900 dark:bg-secondary-900 dark:text-white dark:border dark:border-secondary-700'
                    : 'bg-white text-gray-900'
                }`}
              >
                <Dialog.Title
                  as="h3"
                  className={`text-lg font-medium leading-6 ${themed ? 'text-secondary-900 dark:text-white' : 'text-gray-900'}`}
                >
                  {title}
                </Dialog.Title>
                <div className="mt-4">
                  {children}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}