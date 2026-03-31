import { useState, useEffect } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Wordmark } from "./Wordmark";
import { useAuth } from "@/context/AuthContext";

const navLinks = [
  { to: "/lessons", label: "Lessons" },
  { to: "/workshops", label: "Workshops" },
  { to: "/events", label: "Events" },
  { to: "/pricing", label: "Pricing" },
  { to: "/community", label: "Community" },
  { to: "/contact", label: "Contact" },
];

const heroNavLinks = [
  { to: "/lessons", label: "lessons" },
  { to: "/workshops", label: "workshops" },
  { to: "/events", label: "events" },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showHeroNav, setShowHeroNav] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === "/";
  const { user, isAuthenticated, logout } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Watch for the hero nav sentinel on the home page
  useEffect(() => {
    if (!isHome) {
      setShowHeroNav(false);
      return;
    }

    const check = () => {
      const sentinel = document.getElementById("hero-nav-sentinel");
      if (!sentinel) return;

      const observer = new IntersectionObserver(
        ([entry]) => setShowHeroNav(!entry.isIntersecting),
        { threshold: 0, rootMargin: "-56px 0px 0px 0px" },
      );
      observer.observe(sentinel);
      return observer;
    };

    // Small delay to ensure the DOM is ready
    const timer = setTimeout(() => {
      const observer = check();
      return () => observer?.disconnect();
    }, 50);

    return () => clearTimeout(timer);
  }, [isHome, location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-500 ${
        scrolled || !isHome ? "bg-surface shadow-header" : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-[1200px] px-6 md:px-10 flex items-center justify-between h-14 relative">
        <Link to="/" className="font-display text-lg font-bold tracking-tight text-charcoal">
          <Wordmark />
        </Link>

        {/* Nav links — always visible on non-home pages, fade in on scroll for home */}
        <nav
          className={`hidden lg:flex items-center gap-6 absolute left-1/2 -translate-x-1/2 transition-all duration-300 ${
            !isHome || showHeroNav
              ? "opacity-100 translate-y-0"
              : "opacity-0 -translate-y-1 pointer-events-none"
          }`}
        >
          {heroNavLinks.map((link) => (
            <span key={link.to} className="contents">
              <NavLink
                to={link.to}
                className={({ isActive }) =>
                  `text-[13px] tracking-[0.08em] uppercase transition-colors ${
                    isActive
                      ? "font-semibold text-iris"
                      : "font-medium text-text-secondary hover:text-charcoal"
                  }`
                }
              >
                {link.label}
              </NavLink>
            </span>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-5">
          {isAuthenticated && user ? (
            <>
              {(user.role === "COACH" || user.role === "ADMIN") && (
                <NavLink
                  to="/coach"
                  className={({ isActive }) =>
                    `text-[13px] font-medium tracking-wide transition-colors ${
                      isActive ? "text-iris" : "text-text-secondary hover:text-charcoal"
                    }`
                  }
                >
                  Dashboard
                </NavLink>
              )}
              {user.role === "STUDENT" && (
                <NavLink
                  to="/my-bookings"
                  className={({ isActive }) =>
                    `text-[13px] font-medium tracking-wide transition-colors ${
                      isActive ? "text-iris" : "text-text-secondary hover:text-charcoal"
                    }`
                  }
                >
                  My Bookings
                </NavLink>
              )}
              <span className="text-[13px] font-medium text-text-secondary">
                {user.name}
              </span>
              <button
                onClick={handleLogout}
                className="text-[13px] font-medium text-text-secondary hover:text-charcoal transition-colors tracking-wide"
              >
                Log out
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="text-[13px] font-medium text-text-secondary hover:text-charcoal transition-colors tracking-wide"
            >
              Log in
            </Link>
          )}
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
          {isAuthenticated && user ? (
            <>
              {(user.role === "COACH" || user.role === "ADMIN") && (
                <NavLink
                  to="/coach"
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `block text-[15px] font-display ${isActive ? "text-charcoal" : "text-text-secondary"}`
                  }
                >
                  Dashboard
                </NavLink>
              )}
              {user.role === "STUDENT" && (
                <NavLink
                  to="/my-bookings"
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `block text-[15px] font-display ${isActive ? "text-charcoal" : "text-text-secondary"}`
                  }
                >
                  My Bookings
                </NavLink>
              )}
              <div className="text-[13px] text-text-secondary mb-2">{user.name}</div>
              <button
                onClick={() => { handleLogout(); setMenuOpen(false); }}
                className="block text-[13px] font-medium text-text-secondary hover:text-charcoal transition-colors"
              >
                Log out
              </button>
            </>
          ) : (
            <Link
              to="/login"
              onClick={() => setMenuOpen(false)}
              className="block text-[13px] font-medium text-text-secondary hover:text-charcoal transition-colors"
            >
              Log in
            </Link>
          )}
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
