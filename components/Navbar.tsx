import Image from "next/image"
import Link from "next/link"
import ThemeSwitch from "./ThemeSwitch"
import SearchModal from "./SearchModal";

const Navbar = () => {

  return (
    <header className="w-full border-b-2">
      <nav className="nav text-white flex justify-between">
        <Link
          href="/"
          className="flex items-center gap-1 w-1/6"
        >
          <Image 
            src="/assets/icons/logo.svg"
            width={27}
            height={27}
            alt="Logo"
          />
          <p className="nav-logo dark:text-white-200">
            Shop
            <span className="text-primary">Value</span>
          </p>
        </Link>

        <div className="flex justify-end w-3/4">
          <SearchModal />
        </div>

        <div className="flex gap-5 w-1/6 justify-end">
          <ThemeSwitch />
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
