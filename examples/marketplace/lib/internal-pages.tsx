// @ts-nocheck
import { renderToStaticMarkup } from "react-dom/server";

import {
  SHOPPER_USER_ID,
  catalogSnapshot,
  listQuotes,
} from "./store";

export function renderCatalogInternalPage(context: unknown): string {
  const snapshot = catalogSnapshot();

  return renderOwnerPage(
    <OwnerShell
      title="Catalog"
      context={context}
      stats={[
        { label: "Products", value: snapshot.products.length },
        { label: "Live", value: snapshot.availableCount },
        { label: "Out of Stock", value: snapshot.outOfStockCount },
        { label: "Active Carts", value: snapshot.activeCartCount },
      ]}
    >
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th>Price</th>
            <th>Inventory</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {snapshot.products.map((product) => (
            <tr key={product.id}>
              <td className="cell-name">{product.name}</td>
              <td>{product.category}</td>
              <td>{formatDollars(product.price)}</td>
              <td>{product.inventory}</td>
              <td>
                <span className={`status-dot ${product.available ? "live" : "hidden"}`}>
                  {product.available ? "Live" : "Hidden"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </OwnerShell>,
  );
}

export function renderOrdersInternalPage(context: unknown): string {
  const quotes = listQuotes();

  return renderOwnerPage(
    <OwnerShell
      title="Orders"
      context={context}
      stats={[
        { label: "Quotes", value: quotes.length },
        {
          label: "Revenue",
          value: formatDollars(
            quotes.reduce((sum, quote) => sum + quote.total, 0),
          ),
        },
        { label: "Demo User", value: SHOPPER_USER_ID },
        { label: "Tools", value: 5 },
      ]}
    >
      {quotes.length === 0 ? (
        <div className="empty">
          No orders yet. Add items and checkout from the storefront to create one.
        </div>
      ) : (
        quotes.map((quote) => (
          <article className="quote-card" key={quote.id}>
            <div className="quote-head">
              <strong>{quote.id}</strong>
              <span className="quote-total">{formatDollars(quote.total)}</span>
            </div>
            <div className="quote-meta">
              {quote.itemCount} items &middot; {quote.createdAt}
            </div>
            <ul>
              {quote.items.map((item) => (
                <li key={`${quote.id}-${item.productId}`}>
                  <span>
                    {item.name} &times; {item.quantity}
                  </span>
                  <span>{formatDollars(item.lineTotal)}</span>
                </li>
              ))}
            </ul>
          </article>
        ))
      )}
    </OwnerShell>,
  );
}

function renderOwnerPage(page: JSX.Element): string {
  return `<!doctype html>${renderToStaticMarkup(page)}`;
}

function OwnerShell({
  title,
  stats,
  context,
  children,
}: {
  title: string;
  stats: Array<{ label: string; value: string | number }>;
  context: any;
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title} &middot; Store Admin</title>
        <style>{OWNER_PAGE_CSS}</style>
      </head>
      <body>
        <header className="app-header">
          <span className="logo">
            <span className="logo-icon">S</span>
            Store Admin
          </span>
        </header>
        <main className="shell">
          <div className="page-head">
            <h1>{title}</h1>
          </div>
          <ContextCard context={context} />
          <section className="stats">
            {stats.map((item) => (
              <div className="stat" key={item.label}>
                <span className="stat-value">{String(item.value)}</span>
                <span className="stat-label">{item.label}</span>
              </div>
            ))}
          </section>
          {children}
        </main>
      </body>
    </html>
  );
}

function ContextCard({ context }: { context: any }) {
  if (!context) {
    return null;
  }

  return (
    <section className="context-bar">
      <div>
        <div className="ctx-label">Account</div>
        <div className="ctx-value">{context.account?.name ?? "none"}</div>
      </div>
      <div>
        <div className="ctx-label">Project</div>
        <div className="ctx-value">{context.projectId ?? "none"}</div>
      </div>
      <div>
        <div className="ctx-label">User</div>
        <div className="ctx-value">{context.user.name ?? context.user.email ?? "unknown"}</div>
      </div>
    </section>
  );
}

function formatDollars(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

const OWNER_PAGE_CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; }

:root {
  --bg: #f5f5f4;
  --surface: #ffffff;
  --ink: #1c1917;
  --secondary: #57534e;
  --muted: #a8a29e;
  --accent: #4f46e5;
  --border: #e7e5e4;
  --border-hover: #d6d3d1;
  --green: #059669;
  --green-light: #ecfdf5;
  --red: #dc2626;
  --red-light: #fef2f2;
  --radius: 10px;
}

body {
  font-family: -apple-system, "Segoe UI", system-ui, sans-serif;
  background: var(--bg);
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
}

.app-header {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 0 24px;
  height: 56px;
  display: flex;
  align-items: center;
}

.logo {
  font-size: 0.938rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-icon {
  width: 24px;
  height: 24px;
  background: var(--accent);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 0.7rem;
  font-weight: 700;
}

.shell {
  max-width: 960px;
  margin: 0 auto;
  padding: 32px 24px 80px;
}

.page-head {
  margin-bottom: 24px;
}

.page-head h1 {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.context-bar {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
  margin-bottom: 20px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.ctx-label {
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}

.ctx-value {
  font-size: 0.85rem;
  font-weight: 600;
  margin-top: 1px;
}

.stats {
  display: flex;
  gap: 24px;
  margin-bottom: 24px;
  padding: 20px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  display: block;
}

.stat-label {
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin-top: 2px;
  display: block;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

th, td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  font-size: 0.875rem;
}

th {
  color: var(--muted);
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.cell-name {
  font-weight: 600;
}

.status-dot {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 2px 8px;
  border-radius: 4px;
}

.status-dot.live {
  background: var(--green-light);
  color: var(--green);
}

.status-dot.hidden {
  background: var(--red-light);
  color: var(--red);
}

.quote-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 18px;
  margin-bottom: 10px;
}

.quote-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.quote-head strong {
  font-size: 0.938rem;
}

.quote-total {
  font-weight: 700;
}

.quote-meta {
  font-size: 0.8rem;
  color: var(--muted);
  margin-top: 4px;
}

.quote-card ul {
  list-style: none;
  padding: 0;
  margin: 12px 0 0;
}

.quote-card li {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 0;
  border-top: 1px solid var(--border);
  font-size: 0.875rem;
}

.empty {
  text-align: center;
  padding: 48px 24px;
  color: var(--muted);
  font-size: 0.938rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

@media (max-width: 700px) {
  .stats {
    flex-wrap: wrap;
    gap: 16px;
  }
  .context-bar {
    grid-template-columns: 1fr;
  }
  table {
    display: block;
    overflow-x: auto;
  }
}
`;
