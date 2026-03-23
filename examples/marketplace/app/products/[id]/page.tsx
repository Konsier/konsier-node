// @ts-nocheck
import Link from "next/link";
import { notFound } from "next/navigation";

import { getProduct } from "../../../lib/store";

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

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = getProduct(id);

  if (!product) {
    notFound();
  }

  return (
    <main className="shell">
      <div className="detail-layout">
        <div className={`detail-image ${categoryClass(product.category)}`}>
          {product.imagePath ? (
            <img src={product.imagePath} alt={product.name} />
          ) : (
            CATEGORY_ICONS[product.category] ?? "\uD83D\uDCE6"
          )}
        </div>

        <div className="detail-info">
          <div className="detail-category">{product.category}</div>
          <h1>{product.name}</h1>
          <p className="detail-desc">{product.description}</p>

          <div className="detail-price">${product.price}</div>

          <div className="detail-meta">
            <span>
              {product.inventory > 0 ? (
                <span className="stock-badge stock-in">In Stock ({product.inventory})</span>
              ) : (
                <span className="stock-badge stock-out">Out of Stock</span>
              )}
            </span>
          </div>

          <div className="detail-actions">
            <form action="/api/cart" method="post">
              <input type="hidden" name="action" value="add" />
              <input type="hidden" name="productId" value={product.id} />
              <input type="hidden" name="quantity" value="1" />
              <input type="hidden" name="redirectTo" value={`/products/${product.id}`} />
              <button type="submit" className="btn btn-primary">Add to Cart</button>
            </form>
            <Link className="btn btn-secondary" href="/">
              Back to Products
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
