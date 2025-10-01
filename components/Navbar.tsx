import Image from "next/image"
import Link from "next/link"
import ThemeSwitch from "./ThemeSwitch";
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';

const Navbar = () => {

  return (
    <header className="w-full border-b-2">
      <nav className="nav text-white flex justify-between items-center max-sm:flex-col max-sm:gap-5">
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
              Stock
              <span className="text-primary">Watch</span>
            </p>
          </Link>

          <div className="flex gap-5 justify-center md:hidden">
            <ThemeSwitch />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <Link
            href='/pricing'
            className="text-base text-black dark:text-white-200 hover:text-primary transition-colors font-semibold"
          >
            Pricing
          </Link>

          <SignedOut>
            <Link
              href='/sign-in'
              className="text-base text-black dark:text-white-200 hover:text-primary transition-colors font-semibold"
            >
              Sign In
            </Link>
            <Link
              href='/sign-up'
              className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors font-semibold"
            >
              Get Started
            </Link>
          </SignedOut>
          
          <SignedIn>
            <Link
              href='/dashboard'
              className="text-base text-black dark:text-white-200 hover:text-primary transition-colors font-semibold"
            >
              Dashboard
            </Link>
            <UserButton afterSignOutUrl="/" />
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
