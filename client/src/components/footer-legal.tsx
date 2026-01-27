import { Link } from "wouter";
import { ExternalLink } from "lucide-react";

export function FooterLegal() {
  const currentYear = new Date().getFullYear();

  const internalLinks = [
    { label: "Terms of Use", href: "/terms-of-use" },
    { label: "Privacy", href: "/privacy" },
    { label: "Security", href: "/security" },
    { label: "Site Map", href: "/site-map" },
    { label: "Accessibility", href: "/accessibility" },
  ];

  const externalLinks = [
    { label: "Contact Us", href: "/contact-us" },
    { label: "Share Your Screen", href: "/share-your-screen" },
    { label: "Disclosures", href: "/disclosures" },
    { label: "Cookie Preferences", href: "/cookie-preferences" },
  ];

  return (
    <footer className="border-t border-border bg-muted/30 dark:bg-muted/10">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
            {internalLinks.map((link, index) => (
              <span key={link.href} className="flex items-center gap-4">
                <Link
                  href={link.href}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  data-testid={`link-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {link.label}
                </Link>
                {index < internalLinks.length - 1 && (
                  <span className="text-muted-foreground/50">|</span>
                )}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
            {externalLinks.map((link, index) => (
              <span key={link.href} className="flex items-center gap-4">
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                  data-testid={`link-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {link.label}
                  <ExternalLink className="h-3 w-3" />
                </a>
                {index < externalLinks.length - 1 && (
                  <span className="text-muted-foreground/50">|</span>
                )}
              </span>
            ))}
          </div>

          <div className="text-center text-xs text-muted-foreground space-y-1">
            <p>This is for persons in the US only.</p>
            <p>&copy; {currentYear} JACE Management, LLC. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
