// @ts-nocheck
import "./globals.css";

import Link from "next/link";

import { SHOPPER_USER_ID, getCart } from "../lib/store";

export const metadata = {
  title: "Store",
  description: "A curated collection of handcrafted goods.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cart = getCart(SHOPPER_USER_ID);

  return (
    <html lang="en">
      <body>
        <header className="app-header">
          <Link href="/" className="logo">
            <div className="logo-icon">S</div>
            Store
          </Link>
          <nav className="header-nav">
            <Link href="/">Products</Link>
          </nav>
          <div className="header-right">
            <Link href="/cart" className="cart-link">
              Cart
              {cart.totalItems > 0 && (
                <span className="cart-count">{cart.totalItems}</span>
              )}
            </Link>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
