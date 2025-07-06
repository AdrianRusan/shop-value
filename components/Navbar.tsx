import Image from "next/image"
import Link from "next/link"
import { SignedIn, SignedOut, UserButton, SignInButton } from '@clerk/nextjs'
import SearchModal from "./SearchModal";
import ThemeSwitch from "./ThemeSwitch";

const Navbar = () => {

  return (
    <header className="w-full border-b-2">
      <nav className="nav text-white flex justify-between max-sm:flex-col max-sm:gap-5">
        <div className="flex items-center justify-between max-sm:w-full">
          <Link
            href="/"
            className="flex items-center justify-center gap-1"
          >
            <Image
              src="/assets/icons/logo.svg"
              width={27}
              height={27}
              alt="Logo"
              priority
            />
            <p className="nav-logo dark:text-white-200">
              Shop
              <span className="text-primary">Value</span>
            </p>
          </Link>

          <div className="flex gap-5 justify-center md:hidden">
            <ThemeSwitch />
          </div>
        </div>

        <div className="flex justify-end max-sm:justify-start w-full md:w-1/2">
          <SearchModal />
        </div>

        <div className="flex items-center gap-4">
          <Link
            href={'/produse'}
            className="text-base text-black dark:text-white-200 hover:scale-110 font-bold"
          >
            Produse
          </Link>

          {/* Authentication Section */}
          <SignedOut>
            <SignInButton mode="modal">
              <button className="text-base text-black dark:text-white-200 hover:scale-110 font-bold px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors">
                Conectare
              </button>
            </SignInButton>
          </SignedOut>

          <SignedIn>
            <Link
              href="/dashboard"
              className="text-base text-black dark:text-white-200 hover:scale-110 font-bold"
            >
              Dashboard
            </Link>
            <UserButton 
              appearance={{
                elements: {
                  avatarBox: "w-8 h-8",
                  userButtonPopoverCard: "shadow-lg border border-gray-200",
                  userButtonPopoverActions: "text-gray-700",
                }
              }}
              afterSignOutUrl="/"
            />
          </SignedIn>
        </div>

        <div className="flex gap-5 justify-center max-sm:hidden">
          <ThemeSwitch />
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
