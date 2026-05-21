import Link from "next/link";

const NAV_LINKS: Array<{ description: string; href: string; label: string }> = [
  { description: "Pagina principale", href: "/", label: "Home" },
  { description: "Progetti locali", href: "/projects", label: "Progetti" },
  { description: "Campagne", href: "/campaigns", label: "Campagne" },
  { description: "Libreria asset", href: "/assets", label: "Asset" },
  { description: "Gruppi di asset", href: "/asset-groups", label: "Gruppi" },
  { description: "Mappe di riferimento", href: "/references", label: "Riferimenti" },
  { description: "AI Bridge (automatico + manuale)", href: "/ai-bridge", label: "AI Bridge" },
  { description: "Anteprima generatore", href: "/generate", label: "Genera" }
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-brand">
        <Link href="/">
          <strong>DM-Instamap</strong>
          <span className="muted">toolkit DM locale</span>
        </Link>
      </div>
      <nav aria-label="Principale" className="site-nav">
        {NAV_LINKS.map((link) => (
          <Link href={link.href} key={link.href} title={link.description}>
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
