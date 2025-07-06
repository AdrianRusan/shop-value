import Image from "next/image"
import Link from "next/link"
import { SignedIn, SignedOut, UserButton, SignInButton } from '@clerk/nextjs'
import SearchModal from "./SearchModal";
import ThemeSwitch from "./ThemeSwitch";

const Navbar = () => {

  return (
    <header className="w-full border-b-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900">
      <nav className="nav text-white flex justify-between items-center max-sm:flex-col max-sm:gap-4 max-sm:py-4">
        <div className="flex items-center justify-between w-full sm:w-auto">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 touch-manipulation hover:opacity-80 transition-opacity"
          >
            <Image
              src="/assets/icons/logo.svg"
              width={24}
              height={24}
              className="sm:w-7 sm:h-7"
              alt="Logo"
              priority
            />
            <p className="nav-logo dark:text-white-200">
              Shop
              <span className="text-primary">Value</span>
            </p>
          </Link>

          {/* Mobile theme switch */}
          <div className="flex gap-3 sm:hidden">
            <ThemeSwitch />
          </div>
        </div>

        {/* Search section - full width on mobile */}
        <div className="flex justify-center w-full sm:w-1/2 max-sm:order-3">
          <SearchModal />
        </div>

        {/* Navigation and auth section */}
        <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-center sm:justify-end max-sm:order-2">
          <Link
            href={'/produse'}
            className="px-3 py-2 text-sm sm:text-base text-black dark:text-white-200 hover:bg-gray-100 dark:hover:bg-gray-700 font-semibold rounded-lg transition-colors touch-manipulation"
          >
            Produse
          </Link>

          {/* Authentication Section */}
          <SignedOut>
            <SignInButton mode="modal">
              <button className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg transition-colors touch-manipulation focus:ring-2 focus:ring-primary focus:ring-offset-2">
                Conectare
              </button>
            </SignInButton>
          </SignedOut>

          <SignedIn>
            <Link
              href="/dashboard"
              className="px-3 py-2 text-sm sm:text-base text-black dark:text-white-200 hover:bg-gray-100 dark:hover:bg-gray-700 font-semibold rounded-lg transition-colors touch-manipulation"
            >
              Dashboard
            </Link>
            <div className="flex items-center">
              <UserButton 
                appearance={{
                  elements: {
                    avatarBox: "w-8 h-8 sm:w-9 sm:h-9",
                    userButtonPopoverCard: "shadow-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-slate-800",
                    userButtonPopoverActions: "text-gray-700 dark:text-gray-300",
                    userButtonPopoverActionButton: "hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors",
                  }
                }}
                afterSignOutUrl="/"
              />
            </div>
          </SignedIn>
        </div>

        {/* Desktop theme switch */}
        <div className="hidden sm:flex gap-4 justify-center">
          <ThemeSwitch />
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
