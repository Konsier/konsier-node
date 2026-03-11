import { NextResponse } from "next/server";

import {
  SHOPPER_USER_ID,
  addToCart,
  checkoutCart,
  removeFromCart,
} from "../../../lib/store";

export async function POST(request: Request) {
  const formData = await request.formData();
  const action = String(formData.get("action") || "");
  const productId = String(formData.get("productId") || "");
  const quantity = Number(formData.get("quantity") || "1");
  const redirectTo = String(formData.get("redirectTo") || "/");

  if (action === "add" && productId) {
    addToCart(
      SHOPPER_USER_ID,
      productId,
      Number.isFinite(quantity) ? quantity : 1,
    );
  }

  if (action === "remove" && productId) {
    removeFromCart(SHOPPER_USER_ID, productId);
  }

  if (action === "checkout") {
    checkoutCart(SHOPPER_USER_ID);
  }

  return NextResponse.redirect(new URL(redirectTo, request.url), 303);
}
