import Link from "next/link";

const NAV_LINKS: Array<{ description: string; href: string; label: string }> = [
  { description: "Home", href: "/", label: "Home" },
  { description: "Projects", href: "/projects", label: "Projects" },
  { description: "Campaigns", href: "/campaigns", label: "Campaigns" },
  { description: "Asset Library", href: "/assets", label: "Assets" },
  { description: "Asset Groups", href: "/asset-groups", label: "Groups" },
  { description: "Reference Maps", href: "/references", label: "References" },
  { description: "AI Bridge (auto + manual)", href: "/ai-bridge", label: "AI Bridge" },
  { description: "Generator preview", href: "/generate", label: "Generate" }
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-brand">
        <Link href="/">
          <strong>DM-Instamap</strong>
          <span className="muted">local-first DM toolkit</span>
        </Link>
      </div>
      <nav aria-label="Primary" className="site-nav">
        {NAV_LINKS.map((link) => (
          <Link href={link.href} key={link.href} title={link.description}>
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
