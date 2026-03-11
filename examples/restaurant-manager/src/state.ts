export type MenuItem = {
  id: string;
  name: string;
  price: number;
  available: boolean;
  category: "starter" | "main" | "dessert" | "drink";
};

export type OrderStatus = "draft" | "preparing" | "ready" | "placed";

export type OrderLine = {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

export type Order = {
  id: string;
  conversationId: string;
  status: OrderStatus;
  lines: OrderLine[];
  createdAt: string;
};

export type ReservationStatus =
  | "booked"
  | "seated"
  | "completed"
  | "cancelled";

export type Reservation = {
  id: string;
  name: string;
  partySize: number;
  time: string;
  status: ReservationStatus;
};

type TenantState = {
  accountId: string;
  accountName: string;
  menu: MenuItem[];
  orders: Order[];
  reservations: Reservation[];
  nextMenuNumber: number;
  nextOrderNumber: number;
  nextReservationNumber: number;
};

const tenants = new Map<string, TenantState>();

seedTenant("rest_brass_lantern", "Brass Lantern");
seedTenant("rest_saffron_table", "Saffron Table");

export function listTenants(): Array<{
  accountId: string;
  accountName: string;
  openOrders: number;
  activeReservations: number;
}> {
  return Array.from(tenants.values()).map((tenant) => ({
    accountId: tenant.accountId,
    accountName: tenant.accountName,
    openOrders: tenant.orders.filter((order) => order.status !== "ready").length,
    activeReservations: tenant.reservations.filter(
      (reservation) =>
        reservation.status === "booked" || reservation.status === "seated",
    ).length,
  }));
}

export function ensureTenant(input: {
  accountId: string;
  accountName?: string | null;
}): TenantState {
  const existing = tenants.get(input.accountId);
  if (existing) {
    return existing;
  }

  return seedTenant(input.accountId, input.accountName ?? prettifyAccountId(input.accountId));
}

export function getTenantSnapshot(input: {
  accountId: string;
  accountName?: string | null;
}) {
  const tenant = ensureTenant(input);

  return {
    accountId: tenant.accountId,
    accountName: tenant.accountName,
    menu: tenant.menu.map((item) => ({ ...item })),
    orders: tenant.orders.map((order) => ({
      ...order,
      lines: order.lines.map((line) => ({ ...line })),
    })),
    reservations: tenant.reservations.map((reservation) => ({ ...reservation })),
  };
}

export function getMenu(input: { accountId: string; accountName?: string | null }) {
  return getTenantSnapshot(input).menu.filter((item) => item.available);
}

export function getMenuItem(input: {
  accountId: string;
  accountName?: string | null;
  itemId: string;
}) {
  const tenant = ensureTenant(input);
  const item = tenant.menu.find((candidate) => candidate.id === input.itemId);
  return item ? { ...item } : null;
}

export function startOrder(input: {
  accountId: string;
  accountName?: string | null;
  conversationId: string;
}) {
  const tenant = ensureTenant(input);
  const existing = tenant.orders.find(
    (order) =>
      order.conversationId === input.conversationId &&
      (order.status === "draft" || order.status === "preparing"),
  );
  if (existing) {
    return cloneOrder(existing);
  }

  const order: Order = {
    id: `order_${tenant.nextOrderNumber++}`,
    conversationId: input.conversationId,
    status: "draft",
    lines: [],
    createdAt: new Date().toISOString(),
  };
  tenant.orders.unshift(order);
  return cloneOrder(order);
}

export function addItemToOrder(input: {
  accountId: string;
  accountName?: string | null;
  conversationId: string;
  itemId: string;
  quantity: number;
}) {
  const tenant = ensureTenant(input);
  const item = tenant.menu.find((candidate) => candidate.id === input.itemId);
  if (!item || !item.available) {
    return null;
  }

  const order = startOrder(input);
  const stored = tenant.orders.find((candidate) => candidate.id === order.id);
  if (!stored) {
    return null;
  }

  const existingLine = stored.lines.find((line) => line.itemId === item.id);
  if (existingLine) {
    existingLine.quantity += input.quantity;
  } else {
    stored.lines.push({
      itemId: item.id,
      name: item.name,
      quantity: input.quantity,
      unitPrice: item.price,
    });
  }

  return cloneOrder(stored);
}

export function removeItemFromOrder(input: {
  accountId: string;
  accountName?: string | null;
  conversationId: string;
  itemId: string;
}) {
  const tenant = ensureTenant(input);
  const order = tenant.orders.find(
    (candidate) => candidate.conversationId === input.conversationId,
  );
  if (!order) {
    return null;
  }

  order.lines = order.lines.filter((line) => line.itemId !== input.itemId);
  return cloneOrder(order);
}

export function viewOrder(input: {
  accountId: string;
  accountName?: string | null;
  conversationId: string;
}) {
  const tenant = ensureTenant(input);
  const order = tenant.orders.find(
    (candidate) => candidate.conversationId === input.conversationId,
  );
  return order ? cloneOrder(order) : null;
}

export function placeOrder(input: {
  accountId: string;
  accountName?: string | null;
  conversationId: string;
}) {
  const tenant = ensureTenant(input);
  const order = tenant.orders.find(
    (candidate) => candidate.conversationId === input.conversationId,
  );
  if (!order || order.lines.length === 0) {
    return null;
  }

  order.status = "placed";
  return cloneOrder(order);
}

export function listOpenOrders(input: {
  accountId: string;
  accountName?: string | null;
}) {
  return getTenantSnapshot(input).orders.filter((order) => order.status !== "ready");
}

export function viewOrderDetails(input: {
  accountId: string;
  accountName?: string | null;
  orderId: string;
}) {
  const tenant = ensureTenant(input);
  const order = tenant.orders.find((candidate) => candidate.id === input.orderId);
  return order ? cloneOrder(order) : null;
}

export function markOrderPreparing(input: {
  accountId: string;
  accountName?: string | null;
  orderId: string;
}) {
  const tenant = ensureTenant(input);
  const order = tenant.orders.find((candidate) => candidate.id === input.orderId);
  if (!order) {
    return null;
  }

  order.status = "preparing";
  return cloneOrder(order);
}

export function markOrderReady(input: {
  accountId: string;
  accountName?: string | null;
  orderId: string;
}) {
  const tenant = ensureTenant(input);
  const order = tenant.orders.find((candidate) => candidate.id === input.orderId);
  if (!order) {
    return null;
  }

  order.status = "ready";
  return cloneOrder(order);
}

export function bookTable(input: {
  accountId: string;
  accountName?: string | null;
  name: string;
  partySize: number;
  time: string;
}) {
  const tenant = ensureTenant(input);
  const reservation: Reservation = {
    id: `res_${tenant.nextReservationNumber++}`,
    name: input.name.trim(),
    partySize: input.partySize,
    time: input.time,
    status: "booked",
  };

  tenant.reservations.unshift(reservation);
  return { ...reservation };
}

export function listReservations(input: {
  accountId: string;
  accountName?: string | null;
}) {
  return getTenantSnapshot(input).reservations;
}

export function cancelReservation(input: {
  accountId: string;
  accountName?: string | null;
  reservationId: string;
}) {
  const tenant = ensureTenant(input);
  const reservation = tenant.reservations.find(
    (candidate) => candidate.id === input.reservationId,
  );
  if (!reservation) {
    return null;
  }

  reservation.status = "cancelled";
  return { ...reservation };
}

export function listTodaysReservations(input: {
  accountId: string;
  accountName?: string | null;
}) {
  return listReservations(input).filter(
    (reservation) =>
      reservation.status === "booked" || reservation.status === "seated",
  );
}

export function seatReservation(input: {
  accountId: string;
  accountName?: string | null;
  reservationId: string;
}) {
  return updateReservationStatus({
    ...input,
    status: "seated",
  });
}

export function completeReservation(input: {
  accountId: string;
  accountName?: string | null;
  reservationId: string;
}) {
  return updateReservationStatus({
    ...input,
    status: "completed",
  });
}

export function listMenuItems(input: {
  accountId: string;
  accountName?: string | null;
}) {
  return getTenantSnapshot(input).menu;
}

export function createMenuItem(input: {
  accountId: string;
  accountName?: string | null;
  name: string;
  price: number;
  category: MenuItem["category"];
}) {
  const tenant = ensureTenant(input);
  const item: MenuItem = {
    id: `item_${tenant.nextMenuNumber++}`,
    name: input.name.trim(),
    price: input.price,
    category: input.category,
    available: true,
  };
  tenant.menu.push(item);
  return { ...item };
}

export function updateMenuItemPrice(input: {
  accountId: string;
  accountName?: string | null;
  itemId: string;
  price: number;
}) {
  const tenant = ensureTenant(input);
  const item = tenant.menu.find((candidate) => candidate.id === input.itemId);
  if (!item) {
    return null;
  }

  item.price = input.price;
  return { ...item };
}

export function toggleMenuItemAvailability(input: {
  accountId: string;
  accountName?: string | null;
  itemId: string;
  available: boolean;
}) {
  const tenant = ensureTenant(input);
  const item = tenant.menu.find((candidate) => candidate.id === input.itemId);
  if (!item) {
    return null;
  }

  item.available = input.available;
  return { ...item };
}

export function listStaffSummary(input: {
  accountId: string;
  accountName?: string | null;
}) {
  const snapshot = getTenantSnapshot(input);
  return {
    openOrders: snapshot.orders.filter((order) => order.status !== "ready").length,
    readyOrders: snapshot.orders.filter((order) => order.status === "ready").length,
    reservationsToday: snapshot.reservations.filter(
      (reservation) => reservation.status !== "cancelled",
    ).length,
  };
}

export function listDailySalesSnapshot(input: {
  accountId: string;
  accountName?: string | null;
}) {
  const snapshot = getTenantSnapshot(input);
  const placedOrders = snapshot.orders.filter(
    (order) => order.status === "placed" || order.status === "ready",
  );

  const revenue = placedOrders.reduce(
    (sum, order) =>
      sum +
      order.lines.reduce(
        (lineSum, line) => lineSum + line.unitPrice * line.quantity,
        0,
      ),
    0,
  );

  return {
    placedOrders: placedOrders.length,
    revenue,
    activeReservations: snapshot.reservations.filter(
      (reservation) =>
        reservation.status === "booked" || reservation.status === "seated",
    ).length,
  };
}

function updateReservationStatus(input: {
  accountId: string;
  accountName?: string | null;
  reservationId: string;
  status: ReservationStatus;
}) {
  const tenant = ensureTenant(input);
  const reservation = tenant.reservations.find(
    (candidate) => candidate.id === input.reservationId,
  );
  if (!reservation) {
    return null;
  }

  reservation.status = input.status;
  return { ...reservation };
}

function cloneOrder(order: Order): Order {
  return {
    ...order,
    lines: order.lines.map((line) => ({ ...line })),
  };
}

function seedTenant(accountId: string, accountName: string): TenantState {
  const tenant: TenantState = {
    accountId,
    accountName,
    menu: [
      {
        id: "item_1",
        name: "Charred Carrots",
        price: 14,
        available: true,
        category: "starter",
      },
      {
        id: "item_2",
        name: "Braised Short Rib",
        price: 34,
        available: true,
        category: "main",
      },
      {
        id: "item_3",
        name: "Lemon Tart",
        price: 11,
        available: true,
        category: "dessert",
      },
      {
        id: "item_4",
        name: "House Spritz",
        price: 12,
        available: true,
        category: "drink",
      },
    ],
    orders: [
      {
        id: "order_1",
        conversationId: "conv_demo_1",
        status: "preparing",
        createdAt: new Date("2026-03-10T18:00:00.000Z").toISOString(),
        lines: [
          {
            itemId: "item_2",
            name: "Braised Short Rib",
            quantity: 1,
            unitPrice: 34,
          },
        ],
      },
    ],
    reservations: [
      {
        id: "res_1",
        name: "Ava Johnson",
        partySize: 2,
        time: "7:00 PM",
        status: "booked",
      },
      {
        id: "res_2",
        name: "Malik Peters",
        partySize: 4,
        time: "8:30 PM",
        status: "seated",
      },
    ],
    nextMenuNumber: 5,
    nextOrderNumber: 2,
    nextReservationNumber: 3,
  };

  tenants.set(accountId, tenant);
  return tenant;
}

function prettifyAccountId(accountId: string): string {
  return accountId
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}
