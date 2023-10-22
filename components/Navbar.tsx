import Image from "next/image"
import Link from "next/link"
import SearchModal from "./SearchModal";
import dynamic from "next/dynamic";

const ThemeSwitch = dynamic(() => import('./ThemeSwitch'))

const Navbar = () => {

  return (
    <header className="w-full border-b-2">
      <nav className="nav text-white flex justify-between max-sm:flex-col max-sm:gap-5">
        <Link
          href="/"
          className="flex items-center justify-center gap-1 w-1/6 max-sm:w-full"
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

          <div className="flex justify-end max-sm:justify-start w-1/2">
            <SearchModal />
          </div>

          <div className="flex gap-5 justify-center w-1/6 max-sm:w-1/3 ">
            <ThemeSwitch />
          </div>
      </nav>
    </header>
  );
};

export default Navbar;
