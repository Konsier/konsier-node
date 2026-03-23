export const SHOPPER_USER_ID = "storefront-demo-user";

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  inventory: number;
  available: boolean;
  featured: boolean;
  description: string;
  imagePath?: string;
};

type CartLineState = {
  productId: string;
  quantity: number;
};

type CartState = {
  items: CartLineState[];
};

type QuoteItem = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type Quote = {
  id: string;
  userId: string;
  notes: string | null;
  total: number;
  itemCount: number;
  items: QuoteItem[];
  createdAt: string;
};

const products: Product[] = [
  {
    id: "prod_amber_mug",
    name: "Amber Studio Mug",
    category: "kitchen",
    price: 28,
    inventory: 12,
    available: true,
    featured: true,
    description: "Stoneware mug with a satin glaze and thick cafe handle.",
    imagePath: "/products/amber-studio-mug.jpg",
  },
  {
    id: "prod_canvas_tote",
    name: "Market Canvas Tote",
    category: "bags",
    price: 34,
    inventory: 19,
    available: true,
    featured: false,
    description:
      "Heavy canvas everyday tote with inside pocket and brass snap.",
    imagePath: "/products/market-canvas-tote.jpg",
  },
  {
    id: "prod_lantern",
    name: "Oak Lantern",
    category: "home",
    price: 72,
    inventory: 6,
    available: true,
    featured: true,
    description: "Oak-framed table lantern with warm glass diffuser.",
    imagePath: "/products/oak-lantern.jpg",
  },
  {
    id: "prod_throw",
    name: "Merino Throw",
    category: "home",
    price: 94,
    inventory: 0,
    available: false,
    featured: false,
    description:
      "Soft woven merino throw for lounge chairs and reading corners.",
  },
];

const carts = new Map<string, CartState>();
const quotes: Quote[] = [];
let nextProductNumber = products.length + 1;
let nextQuoteNumber = 1;

export function listProducts(options: { availableOnly?: boolean } = {}) {
  const availableOnly = options.availableOnly === true;
  return products
    .filter((product) => (availableOnly ? product.available : true))
    .map((product) => ({ ...product }));
}

export function searchProducts(
  options: { query?: string | undefined; category?: string | undefined } = {},
) {
  const query =
    typeof options.query === "string" ? options.query.trim().toLowerCase() : "";
  const category =
    typeof options.category === "string"
      ? options.category.trim().toLowerCase()
      : "";

  return products
    .filter((product) => product.available)
    .filter((product) => (category ? product.category === category : true))
    .filter((product) => {
      if (!query) {
        return true;
      }
      return [product.name, product.category, product.description].some(
        (value) => value.toLowerCase().includes(query),
      );
    })
    .map((product) => ({ ...product }));
}

export function getProduct(productId: string) {
  const product = products.find((candidate) => candidate.id === productId);
  return product ? { ...product } : null;
}

export function createProduct(input: {
  name: string;
  category: string;
  description: string;
  price: number;
  inventory: number;
}) {
  const product: Product = {
    id: `prod_custom_${nextProductNumber++}`,
    name: input.name.trim(),
    category: input.category.trim().toLowerCase(),
    price: input.price,
    inventory: input.inventory,
    available: true,
    featured: false,
    description: input.description.trim(),
  };

  products.unshift(product);
  return { ...product };
}

export function updatePrice(productId: string, price: number) {
  const product = products.find((candidate) => candidate.id === productId);
  if (!product) {
    return null;
  }

  product.price = price;
  return { ...product };
}

export function setInventory(productId: string, inventory: number) {
  const product = products.find((candidate) => candidate.id === productId);
  if (!product) {
    return null;
  }

  product.inventory = inventory;
  if (inventory <= 0) {
    product.available = false;
  }
  return { ...product };
}

export function toggleAvailability(productId: string, available: boolean) {
  const product = products.find((candidate) => candidate.id === productId);
  if (!product) {
    return null;
  }

  product.available = available;
  return { ...product };
}

function getCartState(userId: string): CartState {
  const existing = carts.get(userId);
  if (existing) {
    return existing;
  }

  const cart: CartState = { items: [] };
  carts.set(userId, cart);
  return cart;
}

export function addToCart(userId: string, productId: string, quantity = 1) {
  const product = products.find((candidate) => candidate.id === productId);
  if (!product || !product.available) {
    return null;
  }

  const cart = getCartState(userId);
  const line = cart.items.find(
    (candidate) => candidate.productId === productId,
  );
  const nextQuantity = Math.max(
    1,
    Math.min(quantity, Math.max(product.inventory, 1)),
  );

  if (line) {
    line.quantity = Math.min(
      line.quantity + nextQuantity,
      Math.max(product.inventory, 1),
    );
  } else {
    cart.items.push({ productId, quantity: nextQuantity });
  }

  return getCart(userId);
}

export function removeFromCart(userId: string, productId: string) {
  const cart = getCartState(userId);
  cart.items = cart.items.filter((line) => line.productId !== productId);
  return getCart(userId);
}

export function getCart(userId: string) {
  const cart = getCartState(userId);
  const items = cart.items
    .map((line) => {
      const product = products.find(
        (candidate) => candidate.id === line.productId,
      );
      if (!product) {
        return null;
      }

      return {
        productId: product.id,
        name: product.name,
        quantity: line.quantity,
        unitPrice: product.price,
        lineTotal: product.price * line.quantity,
      };
    })
    .filter((item): item is QuoteItem => item !== null);

  const totalItems = items.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = items.reduce((sum, line) => sum + line.lineTotal, 0);

  return {
    userId,
    items,
    totalItems,
    subtotal,
  };
}

export function checkoutCart(userId: string, notes = "") {
  const cart = getCart(userId);
  if (cart.items.length === 0) {
    return null;
  }

  const quote: Quote = {
    id: `quote_${nextQuoteNumber++}`,
    userId,
    notes: notes.trim() || null,
    total: cart.subtotal,
    itemCount: cart.totalItems,
    items: cart.items.map((item) => ({ ...item })),
    createdAt: new Date().toISOString(),
  };

  quotes.unshift(quote);
  carts.set(userId, { items: [] });
  return { ...quote };
}

export function listQuotes() {
  return quotes.map((quote) => ({
    ...quote,
    items: quote.items.map((item) => ({ ...item })),
  }));
}

export function catalogSnapshot() {
  const availableCount = products.filter((product) => product.available).length;
  const outOfStockCount = products.filter(
    (product) => product.inventory <= 0,
  ).length;
  const quoteCount = quotes.length;
  const activeCartCount = Array.from(carts.values()).filter(
    (cart) => cart.items.length > 0,
  ).length;

  return {
    products: listProducts(),
    quotes: listQuotes(),
    availableCount,
    outOfStockCount,
    quoteCount,
    activeCartCount,
  };
}
