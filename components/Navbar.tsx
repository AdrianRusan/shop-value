import Image from "next/image"
import Link from "next/link"
import SearchModal from "./SearchModal";
import dynamic from "next/dynamic";

const ThemeSwitch = dynamic(() => import('./ThemeSwitch'))

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

        <div className="flex gap-5 justify-center max-sm:hidden">
          <ThemeSwitch />
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
