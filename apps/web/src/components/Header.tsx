import { useState, useEffect } from "react";
import { Link, NavLink } from "react-router-dom";

const navLinks = [
  { to: "/lessons", label: "Lessons" },
  { to: "/workshops", label: "Workshops" },
  { to: "/events", label: "Events" },
  { to: "/pricing", label: "Pricing" },
  { to: "/community", label: "Community" },
  { to: "/contact", label: "Contact" },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-500 ${
        scrolled ? "bg-cream/95 backdrop-blur-sm shadow-header" : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-[1200px] px-6 md:px-10 flex items-center justify-between h-14">
        <Link to="/" className="font-display text-lg font-bold tracking-tight text-charcoal">
          Ellisa Sun
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-7">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `text-[13px] font-medium tracking-[0.08em] uppercase transition-colors ${
                  isActive
                    ? "text-charcoal"
                    : "text-text-secondary hover:text-charcoal"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-5">
          <Link
            to="/login"
            className="text-[13px] font-medium text-text-secondary hover:text-charcoal transition-colors tracking-wide"
          >
            Log in
          </Link>
          <Link
            to="/book"
            className="text-[13px] font-medium text-charcoal border border-charcoal px-5 py-1.5 hover:bg-charcoal hover:text-cream transition-all duration-300 tracking-wide"
          >
            Book a lesson
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="lg:hidden p-2 -mr-2"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
        >
          <div className="w-5 flex flex-col gap-[5px]">
            <span
              className={`block h-[1.5px] bg-charcoal transition-all duration-300 ${
                menuOpen ? "rotate-45 translate-y-[6.5px]" : ""
              }`}
            />
            <span
              className={`block h-[1.5px] bg-charcoal transition-all duration-300 ${
                menuOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`block h-[1.5px] bg-charcoal transition-all duration-300 ${
                menuOpen ? "-rotate-45 -translate-y-[6.5px]" : ""
              }`}
            />
          </div>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <nav className="lg:hidden bg-cream border-t border-charcoal/10 px-6 py-6 space-y-4">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `block text-[15px] font-display ${
                  isActive ? "text-charcoal" : "text-text-secondary"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
          <hr className="editorial-rule !my-4" />
          <Link
            to="/book"
            onClick={() => setMenuOpen(false)}
            className="block text-[13px] font-medium text-charcoal border border-charcoal px-5 py-2 text-center hover:bg-charcoal hover:text-cream transition-all duration-300 tracking-wide"
          >
            Book a lesson
          </Link>
        </nav>
      )}
    </header>
  );
}
