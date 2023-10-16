import Image from "next/image"
import Link from "next/link"
import ThemeSwitch from "./ThemeSwitch"
import ThemedIcon from "./ThemedIcon";

const navIcons = [
  {
    alt: 'search',
  },
  {
    alt: 'heart',
  },
  {
    alt: 'user',
  }
];

const Navbar = () => {

  return (
    <header className="w-full border-b-2">
      <nav className="nav text-white"> {/* Apply a text color class to the parent container */}
        <Link
          href="/"
          className="flex items-center gap-1"
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

        <div className="flex items-center gap-5">
          {/* {navIcons.map((icon) => (
            <div>
              <ThemedIcon key={icon.alt} alt={icon.alt} />
            </div>
          ))} */}
          <ThemeSwitch />
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
