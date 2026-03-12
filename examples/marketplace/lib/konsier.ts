import "dotenv/config";
import { Konsier } from "konsier";
import { z } from "zod";

import {
  SHOPPER_USER_ID,
  addToCart,
  catalogSnapshot,
  checkoutCart,
  createProduct,
  getCart,
  getProduct,
  removeFromCart,
  searchProducts,
  setInventory,
  toggleAvailability,
  updatePrice,
} from "./store";

const searchProductsTool = Konsier.tool({
  name: "search_products",
  description: "Search the public catalog for available products.",
  input: z.object({
    query: z.string().optional(),
    category: z.string().optional(),
  }),
  handler: async (input) => {
    return {
      products: searchProducts(input),
    };
  },
});

const viewProductTool = Konsier.tool({
  name: "view_product",
  description: "Load detailed information for one product.",
  input: z.object({
    productId: z.string().min(1),
  }),
  handler: async (input) => {
    const product = getProduct(input.productId);
    if (!product) {
      throw new Error(`Product "${input.productId}" was not found.`);
    }

    return { product };
  },
});

const addToCartTool = Konsier.tool({
  name: "add_to_cart",
  description: "Add a product to the current shopper cart.",
  input: z.object({
    productId: z.string().min(1),
    quantity: z.number().int().positive().default(1),
  }),
  handler: async (input, ctx) => {
    const cart = addToCart(
      ctx.user.id || SHOPPER_USER_ID,
      input.productId,
      input.quantity,
    );
    if (!cart) {
      throw new Error(`Product "${input.productId}" is unavailable.`);
    }

    return { cart };
  },
});

const viewCartTool = Konsier.tool({
  name: "view_cart",
  description: "Inspect the current shopper cart.",
  input: z.object({}),
  handler: async (_input, ctx) => {
    return {
      cart: getCart(ctx.user.id || SHOPPER_USER_ID),
    };
  },
});

const removeFromCartTool = Konsier.tool({
  name: "remove_from_cart",
  description: "Remove one product from the current shopper cart.",
  input: z.object({
    productId: z.string().min(1),
  }),
  handler: async (input, ctx) => {
    return {
      cart: removeFromCart(ctx.user.id || SHOPPER_USER_ID, input.productId),
    };
  },
});

const checkoutQuoteTool = Konsier.tool({
  name: "checkout_quote",
  description: "Create a mock quote for the current cart and clear it.",
  input: z.object({
    notes: z.string().optional(),
  }),
  handler: async (input, ctx) => {
    const quote = checkoutCart(
      ctx.user.id || SHOPPER_USER_ID,
      input.notes ?? "",
    );
    if (!quote) {
      throw new Error("Cart is empty.");
    }

    return { quote };
  },
});

const listProductsTool = Konsier.tool({
  name: "list_products",
  description: "List every product, including unavailable items.",
  input: z.object({}),
  handler: async () => {
    return {
      products: catalogSnapshot().products,
    };
  },
});

const createProductTool = Konsier.tool({
  name: "create_product",
  description: "Create a new mock product for owner workflows.",
  input: z.object({
    name: z.string().min(1),
    category: z.string().min(1),
    description: z.string().min(1),
    price: z.number().positive(),
    inventory: z.number().int().nonnegative(),
  }),
  handler: async (input) => {
    return {
      product: createProduct(input),
    };
  },
});

const updatePriceTool = Konsier.tool({
  name: "update_price",
  description: "Update the listed price for a product.",
  input: z.object({
    productId: z.string().min(1),
    price: z.number().positive(),
  }),
  handler: async (input) => {
    const product = updatePrice(input.productId, input.price);
    if (!product) {
      throw new Error(`Product "${input.productId}" was not found.`);
    }

    return { product };
  },
});

const setInventoryTool = Konsier.tool({
  name: "set_inventory",
  description: "Replace the current product inventory count.",
  input: z.object({
    productId: z.string().min(1),
    inventory: z.number().int().nonnegative(),
  }),
  handler: async (input) => {
    const product = setInventory(input.productId, input.inventory);
    if (!product) {
      throw new Error(`Product "${input.productId}" was not found.`);
    }

    return { product };
  },
});

const toggleAvailabilityTool = Konsier.tool({
  name: "toggle_availability",
  description: "Publish or hide a product from the shopper catalog.",
  input: z.object({
    productId: z.string().min(1),
    available: z.boolean(),
  }),
  handler: async (input) => {
    const product = toggleAvailability(input.productId, input.available);
    if (!product) {
      throw new Error(`Product "${input.productId}" was not found.`);
    }

    return { product };
  },
});

export const sdk = new Konsier({
  apiKey: process.env.KONSIER_API_KEY ?? "",
  endpointUrl:
    process.env.KONSIER_ENDPOINT_URL ??
    `http://localhost:${process.env.PORT ?? "3003"}/api/konsier`,
  agents: {
    shopping_assistant: {
      name: "Shopping Assistant",
      description: "Helps shoppers browse products and create quotes.",
      systemPrompt:
        "You help shoppers explore products and place mock orders. Always use tools before stating inventory or totals.",
      tools: [
        searchProductsTool,
        viewProductTool,
        addToCartTool,
        viewCartTool,
        removeFromCartTool,
        checkoutQuoteTool,
      ],
    },
  },
  internal: {
    tools: [
      listProductsTool,
      createProductTool,
      updatePriceTool,
      setInventoryTool,
      toggleAvailabilityTool,
    ],
    pages: [
      { name: "Catalog", path: "/pages/catalog" },
      { name: "Orders", path: "/pages/orders" },
    ],
  },
});
