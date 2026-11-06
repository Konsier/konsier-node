import "dotenv/config";
import { Konsier, type OperationContext } from "konsier";
import { z } from "zod";

import {
  addItemToOrder,
  bookTable,
  cancelReservation,
  completeReservation,
  createMenuItem,
  ensureTenant,
  getMenu,
  getMenuItem,
  listDailySalesSnapshot,
  listMenuItems,
  listOpenOrders,
  listReservations,
  listStaffSummary,
  listTodaysReservations,
  markOrderPreparing,
  markOrderReady,
  placeOrder,
  removeItemFromOrder,
  seatReservation,
  startOrder,
  toggleMenuItemAvailability,
  updateMenuItemPrice,
  viewOrder,
  viewOrderDetails,
} from "./state";

const restaurantCustomer = {
  name: "Restaurant Customer",
  description: "Handles menu, orders, and reservations for guests.",
  systemPrompt:
    "You are the guest-facing concierge for a restaurant. Always use tools before confirming menu details, orders, or reservations.",
  operations: [
    Konsier.operation({
      service: "app",
      resource: "operations",
      action: "get_menu",
      title: "get_menu",
      description: "Return currently available menu items.",
      input: z.object({}),
      output: z.record(z.string(), z.any()),
      handler: async (_input, ctx) => {
        return {
          menu: getMenu(accountFor(ctx)),
        };
      },
    }),
    Konsier.operation({
      service: "app",
      resource: "operations",
      action: "get_menu_item",
      title: "get_menu_item",
      description: "Return details for one menu item.",
      input: z.object({ itemId: z.string().min(1) }),
      output: z.record(z.string(), z.any()),
      handler: async (input, ctx) => {
        const item = getMenuItem({ ...accountFor(ctx), itemId: input.itemId });
        if (!item) {
          throw new Error(`Menu item "${input.itemId}" was not found.`);
        }
        return { item };
      },
    }),
    Konsier.operation({
      service: "app",
      resource: "operations",
      action: "start_order",
      title: "start_order",
      description: "Create or resume an order for the current conversation.",
      input: z.object({}),
      output: z.record(z.string(), z.any()),
      handler: async (_input, ctx) => {
        return {
          order: startOrder({
            ...accountFor(ctx),
            conversationId: ctx.conversation.id,
          }),
        };
      },
    }),
    Konsier.operation({
      service: "app",
      resource: "operations",
      action: "add_item_to_order",
      title: "add_item_to_order",
      description: "Add one menu item to the current guest order.",
      input: z.object({
        itemId: z.string().min(1),
        quantity: z.number().int().positive().default(1),
      }),
      output: z.record(z.string(), z.any()),
      handler: async (input, ctx) => {
        const order = addItemToOrder({
          ...accountFor(ctx),
          conversationId: ctx.conversation.id,
          itemId: input.itemId,
          quantity: input.quantity,
        });
        if (!order) {
          throw new Error(`Menu item "${input.itemId}" is unavailable.`);
        }
        return { order };
      },
    }),
    Konsier.operation({
      service: "app",
      resource: "operations",
      action: "remove_item_from_order",
      title: "remove_item_from_order",
      description: "Remove one menu item from the current order.",
      input: z.object({ itemId: z.string().min(1) }),
      output: z.record(z.string(), z.any()),
      handler: async (input, ctx) => {
        const order = removeItemFromOrder({
          ...accountFor(ctx),
          conversationId: ctx.conversation.id,
          itemId: input.itemId,
        });
        if (!order) {
          throw new Error("There is no active order for this conversation.");
        }
        return { order };
      },
    }),
    Konsier.operation({
      service: "app",
      resource: "operations",
      action: "view_order",
      title: "view_order",
      description: "Inspect the current order state for the conversation.",
      input: z.object({}),
      output: z.record(z.string(), z.any()),
      handler: async (_input, ctx) => {
        const order = viewOrder({
          ...accountFor(ctx),
          conversationId: ctx.conversation.id,
        });
        if (!order) {
          throw new Error("There is no active order yet.");
        }
        return { order };
      },
    }),
    Konsier.operation({
      service: "app",
      resource: "operations",
      action: "place_order",
      title: "place_order",
      description: "Finalize the current order.",
      input: z.object({}),
      output: z.record(z.string(), z.any()),
      handler: async (_input, ctx) => {
        const order = placeOrder({
          ...accountFor(ctx),
          conversationId: ctx.conversation.id,
        });
        if (!order) {
          throw new Error("Add items before placing the order.");
        }
        return { order };
      },
    }),
    Konsier.operation({
      service: "app",
      resource: "operations",
      action: "book_table",
      title: "book_table",
      description: "Create a reservation for a guest.",
      input: z.object({
        name: z.string().min(1),
        partySize: z.number().int().positive(),
        time: z.string().min(1),
      }),
      output: z.record(z.string(), z.any()),
      handler: async (input, ctx) => {
        return {
          reservation: bookTable({
            ...accountFor(ctx),
            ...input,
          }),
        };
      },
    }),
    Konsier.operation({
      service: "app",
      resource: "operations",
      action: "list_reservations",
      title: "list_reservations",
      description: "List reservations for the restaurant.",
      input: z.object({}),
      output: z.record(z.string(), z.any()),
      handler: async (_input, ctx) => {
        return {
          reservations: listReservations(accountFor(ctx)),
        };
      },
    }),
    Konsier.operation({
      service: "app",
      resource: "operations",
      action: "cancel_reservation",
      title: "cancel_reservation",
      description: "Cancel one reservation.",
      input: z.object({ reservationId: z.string().min(1) }),
      output: z.record(z.string(), z.any()),
      handler: async (input, ctx) => {
        const reservation = cancelReservation({
          ...accountFor(ctx),
          reservationId: input.reservationId,
        });
        if (!reservation) {
          throw new Error(
            `Reservation "${input.reservationId}" was not found.`,
          );
        }
        return { reservation };
      },
    }),
  ],
};

const restaurantWorker = {
  name: "Restaurant Worker",
  description: "Helps staff coordinate orders and seating.",
  systemPrompt:
    "You help restaurant staff move service forward. Use tools before describing order or reservation state.",
  operations: [
    Konsier.operation({
      service: "app",
      resource: "operations",
      action: "list_open_orders",
      title: "list_open_orders",
      description: "List orders still moving through service.",
      input: z.object({}),
      output: z.record(z.string(), z.any()),
      handler: async (_input, ctx) => {
        return {
          orders: listOpenOrders(accountFor(ctx)),
        };
      },
    }),
    Konsier.operation({
      service: "app",
      resource: "operations",
      action: "view_order_details",
      title: "view_order_details",
      description: "Return one order in full detail.",
      input: z.object({ orderId: z.string().min(1) }),
      output: z.record(z.string(), z.any()),
      handler: async (input, ctx) => {
        const order = viewOrderDetails({
          ...accountFor(ctx),
          orderId: input.orderId,
        });
        if (!order) {
          throw new Error(`Order "${input.orderId}" was not found.`);
        }
        return { order };
      },
    }),
    Konsier.operation({
      service: "app",
      resource: "operations",
      action: "mark_order_preparing",
      title: "mark_order_preparing",
      description: "Move an order into preparing state.",
      input: z.object({ orderId: z.string().min(1) }),
      output: z.record(z.string(), z.any()),
      handler: async (input, ctx) => {
        const order = markOrderPreparing({
          ...accountFor(ctx),
          orderId: input.orderId,
        });
        if (!order) {
          throw new Error(`Order "${input.orderId}" was not found.`);
        }
        return { order };
      },
    }),
    Konsier.operation({
      service: "app",
      resource: "operations",
      action: "mark_order_ready",
      title: "mark_order_ready",
      description: "Mark an order as ready for pickup or service.",
      input: z.object({ orderId: z.string().min(1) }),
      output: z.record(z.string(), z.any()),
      handler: async (input, ctx) => {
        const order = markOrderReady({
          ...accountFor(ctx),
          orderId: input.orderId,
        });
        if (!order) {
          throw new Error(`Order "${input.orderId}" was not found.`);
        }
        return { order };
      },
    }),
    Konsier.operation({
      service: "app",
      resource: "operations",
      action: "list_todays_reservations",
      title: "list_todays_reservations",
      description: "List active reservations for the current restaurant.",
      input: z.object({}),
      output: z.record(z.string(), z.any()),
      handler: async (_input, ctx) => {
        return {
          reservations: listTodaysReservations(accountFor(ctx)),
        };
      },
    }),
    Konsier.operation({
      service: "app",
      resource: "operations",
      action: "seat_reservation",
      title: "seat_reservation",
      description: "Mark a reservation as seated.",
      input: z.object({ reservationId: z.string().min(1) }),
      output: z.record(z.string(), z.any()),
      handler: async (input, ctx) => {
        const reservation = seatReservation({
          ...accountFor(ctx),
          reservationId: input.reservationId,
        });
        if (!reservation) {
          throw new Error(
            `Reservation "${input.reservationId}" was not found.`,
          );
        }
        return { reservation };
      },
    }),
    Konsier.operation({
      service: "app",
      resource: "operations",
      action: "complete_reservation",
      title: "complete_reservation",
      description: "Close out a completed seating.",
      input: z.object({ reservationId: z.string().min(1) }),
      output: z.record(z.string(), z.any()),
      handler: async (input, ctx) => {
        const reservation = completeReservation({
          ...accountFor(ctx),
          reservationId: input.reservationId,
        });
        if (!reservation) {
          throw new Error(
            `Reservation "${input.reservationId}" was not found.`,
          );
        }
        return { reservation };
      },
    }),
  ],
};

const listMenuItemsTool = Konsier.operation({
  service: "app",
  resource: "operations",
  action: "list_menu_items",
  title: "list_menu_items",
  description: "List all menu items for owner operations.",
  input: z.object({}),
  output: z.record(z.string(), z.any()),
  handler: async (_input, ctx) => {
    return {
      menu: listMenuItems(accountFor(ctx)),
    };
  },
});

const createMenuItemTool = Konsier.operation({
  service: "app",
  resource: "operations",
  action: "create_menu_item",
  title: "create_menu_item",
  description: "Add a new menu item to the tenant menu.",
  input: z.object({
    name: z.string().min(1),
    price: z.number().positive(),
    category: z.enum(["starter", "main", "dessert", "drink"]),
  }),
  output: z.record(z.string(), z.any()),
  handler: async (input, ctx) => {
    return {
      item: createMenuItem({
        ...accountFor(ctx),
        ...input,
      }),
    };
  },
});

const updateMenuItemPriceTool = Konsier.operation({
  service: "app",
  resource: "operations",
  action: "update_menu_item_price",
  title: "update_menu_item_price",
  description: "Update the price for a menu item.",
  input: z.object({
    itemId: z.string().min(1),
    price: z.number().positive(),
  }),
  output: z.record(z.string(), z.any()),
  handler: async (input, ctx) => {
    const item = updateMenuItemPrice({
      ...accountFor(ctx),
      ...input,
    });
    if (!item) {
      throw new Error(`Menu item "${input.itemId}" was not found.`);
    }
    return { item };
  },
});

const toggleMenuItemAvailabilityTool = Konsier.operation({
  service: "app",
  resource: "operations",
  action: "toggle_menu_item_availability",
  title: "toggle_menu_item_availability",
  description: "Publish or hide a menu item.",
  input: z.object({
    itemId: z.string().min(1),
    available: z.boolean(),
  }),
  output: z.record(z.string(), z.any()),
  handler: async (input, ctx) => {
    const item = toggleMenuItemAvailability({
      ...accountFor(ctx),
      ...input,
    });
    if (!item) {
      throw new Error(`Menu item "${input.itemId}" was not found.`);
    }
    return { item };
  },
});

const listStaffSummaryTool = Konsier.operation({
  service: "app",
  resource: "operations",
  action: "list_staff_summary",
  title: "list_staff_summary",
  description: "Summarize staff-facing service activity.",
  input: z.object({}),
  output: z.record(z.string(), z.any()),
  handler: async (_input, ctx) => {
    return {
      summary: listStaffSummary(accountFor(ctx)),
    };
  },
});

const listDailySalesSnapshotTool = Konsier.operation({
  service: "app",
  resource: "operations",
  action: "list_daily_sales_snapshot",
  title: "list_daily_sales_snapshot",
  description: "Return a mock owner sales summary.",
  input: z.object({}),
  output: z.record(z.string(), z.any()),
  handler: async (_input, ctx) => {
    return {
      snapshot: listDailySalesSnapshot(accountFor(ctx)),
    };
  },
});

const endpointUrl =
  process.env.KONSIER_ENDPOINT_URL ??
  `http://localhost:${process.env.PORT ?? "3004"}/konsier`;
const publicUrl =
  process.env.KONSIER_PUBLIC_URL ??
  `http://localhost:${process.env.PORT ?? "3004"}`;

export const sdk = new Konsier({
  apiKey: process.env.KONSIER_API_KEY ?? "",
  endpointUrl,
  publicUrl,
  debug: process.env.KONSIER_DEBUG === "true",
  agents: {
    restaurant_customer: restaurantCustomer,
    restaurant_worker: restaurantWorker,
  },
  internal: {
    operations: [
      listMenuItemsTool,
      createMenuItemTool,
      updateMenuItemPriceTool,
      toggleMenuItemAvailabilityTool,
      listStaffSummaryTool,
      listDailySalesSnapshotTool,
    ],
    pages: [{ name: "Ops", path: "/pages/ops" }],
  },
});

function accountFor(ctx: Pick<OperationContext, "account">): {
  accountId: string;
  accountName?: string | null;
} {
  const accountId = ctx.account?.id ?? "rest_brass_lantern";
  const accountName = ctx.account?.name ?? "Brass Lantern";
  ensureTenant({ accountId, accountName });
  return { accountId, accountName };
}
