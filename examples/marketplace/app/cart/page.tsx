// @ts-nocheck
import Link from "next/link";

import { SHOPPER_USER_ID, getCart, listQuotes } from "../../lib/store";

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const cart = getCart(SHOPPER_USER_ID);
  const recentQuote = params?.checked_out ? listQuotes()[0] ?? null : null;

  return (
    <main className="shell">
      <div className="page-head">
        <h1>Cart</h1>
        <p>{cart.totalItems} {cart.totalItems === 1 ? "item" : "items"} in your cart.</p>
      </div>

      {recentQuote && (
        <div className="quote-banner">
          <div>
            <strong>Order confirmed</strong>
            <br />
            <span>Quote {recentQuote.id} created for ${recentQuote.total}.</span>
          </div>
        </div>
      )}

      {cart.items.length === 0 ? (
        <div className="empty-cart">
          <div style={{ fontSize: "2rem" }}>&#128722;</div>
          <p>Your cart is empty.</p>
          <Link className="btn btn-primary" href="/" style={{ marginTop: 16, display: "inline-flex" }}>
            Browse Products
          </Link>
        </div>
      ) : (
        <div className="cart-layout">
          <div className="cart-items">
            {cart.items.map((item) => (
              <div className="cart-line" key={item.productId}>
                <div className="cart-line-info">
                  <div className="cart-line-name">{item.name}</div>
                  <div className="cart-line-meta">
                    Qty {item.quantity} &times; ${item.unitPrice}
                  </div>
                </div>
                <div className="cart-line-price">${item.lineTotal}</div>
                <form action="/api/cart" method="post">
                  <input type="hidden" name="action" value="remove" />
                  <input type="hidden" name="productId" value={item.productId} />
                  <input type="hidden" name="redirectTo" value="/cart" />
                  <button className="btn btn-secondary btn-sm" type="submit">
                    Remove
                  </button>
                </form>
              </div>
            ))}
          </div>

          <div className="cart-summary">
            <h2>Summary</h2>
            <div className="summary-row">
              <span>Subtotal</span>
              <span>${cart.subtotal}</span>
            </div>
            <div className="summary-row">
              <span>Shipping</span>
              <span>Free</span>
            </div>
            <div className="summary-row total">
              <span>Total</span>
              <span>${cart.subtotal}</span>
            </div>
            <form action="/api/cart" method="post">
              <input type="hidden" name="action" value="checkout" />
              <input type="hidden" name="redirectTo" value="/cart?checked_out=1" />
              <button type="submit" className="btn btn-primary">Checkout</button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
