import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-gray-600">
          <p>&copy; 2024 Conduit UCPI. Secure escrow contracts on Avalanche.</p>
          <div className="mt-4 space-x-6">
            <Link href="/terms-of-service" className="text-gray-500 hover:text-gray-700 underline">
              Terms of Service
            </Link>
            <Link href="/privacy-policy" className="text-gray-500 hover:text-gray-700 underline">
              Privacy Policy
            </Link>
            <a href="mailto:info@conduit-ucpi.com" className="text-gray-500 hover:text-gray-700 underline">
              Contact Us
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}