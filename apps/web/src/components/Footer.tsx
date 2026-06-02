import { Link } from "react-router-dom";
import { Wordmark } from "./Wordmark";

export function Footer() {
  return (
    <footer className="border-t border-charcoal/10">
      <div className="mx-auto max-w-[1200px] px-6 md:px-10 py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          {/* Brand */}
          <div className="md:col-span-5">
            <p className="font-display text-xl font-bold mb-3"><Wordmark /></p>
            <p className="text-sm text-text-secondary leading-relaxed max-w-xs">
              Singer-songwriter, music teacher, and firm believer
              that everyone has a song worth hearing.
            </p>
          </div>

          {/* Nav */}
          <div className="md:col-span-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-secondary mb-4">
              Navigate
            </p>
            <ul className="space-y-2">
              {["Lessons", "Workshops", "Events", "Pricing", "Contact"].map(
                (label) => (
                  <li key={label}>
                    <Link
                      to={`/${label.toLowerCase()}`}
                      className="text-sm text-charcoal hover:text-gold transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </div>

          {/* Lessons */}
          <div className="md:col-span-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-secondary mb-4">
              Study
            </p>
            <ul className="space-y-2">
              {[
                ["Voice", "voice"],
                ["Songwriting", "songwriting"],
                ["Theory", "theory"],
                ["Performance", "performance"],
                ["Poetry in Song", "poetry-in-song"],
              ].map(([label, slug]) => (
                <li key={slug}>
                  <Link
                    to={`/lessons/${slug}`}
                    className="text-sm text-charcoal hover:text-gold transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Connect */}
          <div className="md:col-span-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-secondary mb-4">
              Elsewhere
            </p>
            <ul className="space-y-2">
              {[
                // TODO: replace "#" with real URLs (content pass). Podcast URL
                // pending — see project_podcast_link memory.
                ["Podcast", "#"],
                ["Spotify", "#"],
                ["YouTube", "#"],
                ["Instagram", "#"],
              ].map(([label, href]) => (
                <li key={label}>
                  <a
                    href={href}
                    target={href === "#" ? undefined : "_blank"}
                    rel={href === "#" ? undefined : "noopener noreferrer"}
                    className="text-sm text-charcoal hover:text-gold transition-colors"
                  >
                    {label} &nearr;
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-charcoal/10">
        <div className="mx-auto max-w-[1200px] px-6 md:px-10 py-5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[12px] text-text-secondary tracking-wide">
            &copy; {new Date().getFullYear()} <Wordmark />
          </p>
          <p className="font-handwritten text-text-secondary text-base">
            made with good intentions
          </p>
        </div>
      </div>
    </footer>
  );
}
