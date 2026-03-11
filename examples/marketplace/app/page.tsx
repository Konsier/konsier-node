// @ts-nocheck
import Link from "next/link";

import { listProducts } from "../lib/store";

const CATEGORY_ICONS: Record<string, string> = {
  kitchen: "\u2615",
  bags: "\uD83D\uDC5C",
  home: "\uD83C\uDFE0",
};

function categoryClass(category: string) {
  const key = category.toLowerCase();
  if (key === "kitchen") return "cat-kitchen";
  if (key === "bags") return "cat-bags";
  if (key === "home") return "cat-home";
  return "cat-default";
}

export default function HomePage() {
  const products = listProducts({ availableOnly: true });

  return (
    <main className="shell">
      <div className="page-head">
        <h1>All Products</h1>
        <p>Handcrafted goods for everyday living.</p>
      </div>

      <div className="product-grid">
        {products.map((product) => (
          <article className="product-card" key={product.id}>
            <div className={`product-image ${categoryClass(product.category)}`}>
              {CATEGORY_ICONS[product.category] ?? "\uD83D\uDCE6"}
            </div>
            <div className="product-body">
              <div className="product-category">{product.category}</div>
              <div className="product-name">{product.name}</div>
              <p className="product-desc">{product.description}</p>
            </div>
            <div className="product-footer">
              <span className="product-price">${product.price}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <Link className="btn btn-secondary btn-sm" href={`/products/${product.id}`}>
                  Details
                </Link>
                <form action="/api/cart" method="post">
                  <input type="hidden" name="action" value="add" />
                  <input type="hidden" name="productId" value={product.id} />
                  <input type="hidden" name="quantity" value="1" />
                  <input type="hidden" name="redirectTo" value="/" />
                  <button type="submit" className="btn btn-primary btn-sm">Add to Cart</button>
                </form>
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
