import "dotenv/config";
import { Konsier, type AttachInput } from "konsier";
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

function resolveMarketplaceOrigin(): string {
  const endpointUrl = process.env.KONSIER_ENDPOINT_URL?.trim();
  if (endpointUrl) {
    try {
      const parsed = new URL(endpointUrl);
      parsed.pathname =
        parsed.pathname.replace(/\/api\/konsier\/?$/, "") || "/";
      parsed.search = "";
      parsed.hash = "";
      return parsed.toString().replace(/\/+$/, "");
    } catch {
      // Fall through to local default below.
    }
  }

  return `http://localhost:${process.env.PORT ?? "3003"}`;
}

function toProductAttachments(product: { name: string; imagePath?: string }) {
  if (!product.imagePath) {
    return [];
  }

  const fileName = product.imagePath.split("/").at(-1);

  return [
    {
      type: "image",
      url: new URL(
        product.imagePath,
        `${resolveMarketplaceOrigin()}/`,
      ).toString(),
      ...(fileName ? { name: fileName } : {}),
      caption: product.name,
    },
  ] satisfies AttachInput[];
}

const searchProductsTool = Konsier.operation({
  service: "app",
  resource: "operations",
  action: "search_products",
  title: "Search Products",
  description: "Search the public catalog for available products.",
  input: z.object({
    query: z.string().optional(),
    category: z.string().optional(),
  }),
  output: z.record(z.string(), z.any()),
  handler: async (input) => {
    return {
      products: searchProducts(input),
    };
  },
});

const viewProductTool = Konsier.operation({
  service: "app",
  resource: "operations",
  action: "view_product",
  title: "View Product",
  description: "Load detailed information for one product.",
  input: z.object({
    productId: z.string().min(1),
  }),
  output: z.record(z.string(), z.any()),
  handler: async (input, ctx) => {
    const product = getProduct(input.productId);
    if (!product) {
      throw new Error(`Product "${input.productId}" was not found.`);
    }

    const attachments = toProductAttachments(product);

    if (attachments.length > 0) {
      ctx.attach(attachments);
    }

    return {
      ...("imagePath" in product
        ? (({ imagePath: _imagePath, ...rest }) => rest)(product)
        : product),
      // latestShopperMessage: ctx.messages.at(-1)?.text ?? null,
    };
  },
});

const addToCartTool = Konsier.operation({
  service: "app",
  resource: "operations",
  action: "add_to_cart",
  title: "Add To Cart",
  description: "Add a product to the current shopper cart.",
  input: z.object({
    productId: z.string().min(1),
    quantity: z.number().int().positive().default(1),
  }),
  output: z.record(z.string(), z.any()),
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

const viewCartTool = Konsier.operation({
  service: "app",
  resource: "operations",
  action: "view_cart",
  title: "View Cart",
  description: "Inspect the current shopper cart.",
  input: z.object({}),
  output: z.record(z.string(), z.any()),
  handler: async (_input, ctx) => {
    return {
      cart: getCart(ctx.user.id || SHOPPER_USER_ID),
    };
  },
});

const removeFromCartTool = Konsier.operation({
  service: "app",
  resource: "operations",
  action: "remove_from_cart",
  title: "Remove From Cart",
  description: "Remove one product from the current shopper cart.",
  input: z.object({
    productId: z.string().min(1),
  }),
  output: z.record(z.string(), z.any()),
  handler: async (input, ctx) => {
    return {
      cart: removeFromCart(ctx.user.id || SHOPPER_USER_ID, input.productId),
    };
  },
});

const checkoutQuoteTool = Konsier.operation({
  service: "app",
  resource: "operations",
  action: "checkout_quote",
  title: "Checkout Quote",
  description: "Create a mock quote for the current cart and clear it.",
  input: z.object({
    notes: z.string().optional(),
  }),
  output: z.record(z.string(), z.any()),
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

const listProductsTool = Konsier.operation({
  service: "app",
  resource: "operations",
  action: "list_products",
  title: "List Products",
  description: "List every product, including unavailable items.",
  input: z.object({}),
  output: z.record(z.string(), z.any()),
  handler: async () => {
    return {
      products: catalogSnapshot().products,
    };
  },
});

const createProductTool = Konsier.operation({
  service: "app",
  resource: "operations",
  action: "create_product",
  title: "Create Product",
  description: "Create a new mock product for owner workflows.",
  input: z.object({
    name: z.string().min(1),
    category: z.string().min(1),
    description: z.string().min(1),
    price: z.number().positive(),
    inventory: z.number().int().nonnegative(),
  }),
  output: z.record(z.string(), z.any()),
  handler: async (input) => {
    return {
      product: createProduct(input),
    };
  },
});

const updatePriceTool = Konsier.operation({
  service: "app",
  resource: "operations",
  action: "update_price",
  title: "Update Price",
  description: "Update the listed price for a product.",
  input: z.object({
    productId: z.string().min(1),
    price: z.number().positive(),
  }),
  output: z.record(z.string(), z.any()),
  handler: async (input) => {
    const product = updatePrice(input.productId, input.price);
    if (!product) {
      throw new Error(`Product "${input.productId}" was not found.`);
    }

    return { product };
  },
});

const setInventoryTool = Konsier.operation({
  service: "app",
  resource: "operations",
  action: "set_inventory",
  title: "Set Inventory",
  description: "Replace the current product inventory count.",
  input: z.object({
    productId: z.string().min(1),
    inventory: z.number().int().nonnegative(),
  }),
  output: z.record(z.string(), z.any()),
  handler: async (input) => {
    const product = setInventory(input.productId, input.inventory);
    if (!product) {
      throw new Error(`Product "${input.productId}" was not found.`);
    }

    return { product };
  },
});

const toggleAvailabilityTool = Konsier.operation({
  service: "app",
  resource: "operations",
  action: "toggle_availability",
  title: "Toggle Availability",
  description: "Publish or hide a product from the shopper catalog.",
  input: z.object({
    productId: z.string().min(1),
    available: z.boolean(),
  }),
  output: z.record(z.string(), z.any()),
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
  debug: true,
  endpointUrl:
    process.env.KONSIER_ENDPOINT_URL ??
    `http://localhost:${process.env.PORT ?? "3003"}/api/konsier`,
  publicUrl:
    process.env.KONSIER_PUBLIC_URL ??
    `http://localhost:${process.env.PORT ?? "3003"}`,
  agents: {
    shopping_assistant: {
      name: "Shopping Assistant",
      description: "Helps shoppers browse products and create quotes.",
      systemPrompt:
        "You help shoppers explore products and place mock orders. Always use tools before stating inventory or totals.",
      operations: [
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
    operations: [
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

let marketplaceSyncPromise: Promise<void> | null = null;

export async function ensureMarketplaceSdkSynced(): Promise<void> {
  if (marketplaceSyncPromise) {
    return marketplaceSyncPromise;
  }

  marketplaceSyncPromise = sdk
    .sync()
    .then(() => {
      console.log("[marketplace-example] sdk sync succeeded", {
        endpointUrl:
          process.env.KONSIER_ENDPOINT_URL ??
          `http://localhost:${process.env.PORT ?? "3003"}/api/konsier`,
      });
    })
    .catch((error) => {
      marketplaceSyncPromise = null;
      console.error("[marketplace-example] sdk sync failed", {
        endpointUrl:
          process.env.KONSIER_ENDPOINT_URL ??
          `http://localhost:${process.env.PORT ?? "3003"}/api/konsier`,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    });

  return marketplaceSyncPromise;
}
