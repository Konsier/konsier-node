import type { PageAuthContext } from "konsier";

import {
  getTenantSnapshot,
  listDailySalesSnapshot,
  listStaffSummary,
  listTenants,
} from "../state";
import { renderTemplate } from "./template";

export function renderHomePage(): string {
  const tenants = listTenants()
    .map((tenant) =>
      renderTemplate("partials/home-tenant-card.html", {
        accountId: encodeURIComponent(tenant.accountId),
        accountIdLabel: escapeHtml(tenant.accountId),
        accountName: escapeHtml(tenant.accountName),
        openOrders: String(tenant.openOrders),
        activeReservations: String(tenant.activeReservations),
      }),
    )
    .join("");

  return renderShell({
    title: "Dashboard",
    subtitle: "Overview of all connected restaurants and their current status.",
    body: renderTemplate("pages/home-body.html", {
      tenants,
    }),
  });
}

export function renderTenantPage(
  accountId: string,
  accountName: string,
): string {
  const snapshot = getTenantSnapshot({ accountId, accountName });
  const menu = snapshot.menu
    .map((item) =>
      renderTemplate("partials/menu-item.html", {
        name: escapeHtml(item.name),
        metaPrimary: money(item.price),
        metaSecondary: escapeHtml(item.category),
      }),
    )
    .join("");
  const reservations = snapshot.reservations
    .map((reservation) =>
      renderTemplate("partials/reservation-item.html", {
        name: escapeHtml(reservation.name),
        metaPrimary: `${reservation.partySize} guests`,
        metaSecondary: `${escapeHtml(reservation.time)} · ${escapeHtml(reservation.status)}`,
      }),
    )
    .join("");

  return renderShell({
    title: accountName,
    subtitle: "Browse the menu and view upcoming reservations.",
    body: renderTemplate("pages/tenant-body.html", {
      menu,
      reservations,
    }),
  });
}

export function renderWorkerPage(
  accountId: string,
  accountName: string,
): string {
  const snapshot = getTenantSnapshot({ accountId, accountName });
  const orders = snapshot.orders
    .map((order) =>
      renderTemplate("partials/worker-order-item.html", {
        name: escapeHtml(order.id),
        metaPrimary: escapeHtml(order.status),
        metaSecondary: `${order.lines.length} items`,
      }),
    )
    .join("");
  const reservations = snapshot.reservations
    .map((reservation) =>
      renderTemplate("partials/reservation-item.html", {
        name: escapeHtml(reservation.name),
        metaPrimary: escapeHtml(reservation.status),
        metaSecondary: escapeHtml(reservation.time),
      }),
    )
    .join("");

  return renderShell({
    title: `${accountName} · Service Board`,
    subtitle: "Active orders and upcoming reservations for the front of house.",
    body: renderTemplate("pages/worker-body.html", {
      orders,
      reservations,
    }),
  });
}

export function renderOpsPage(
  accountId: string,
  accountName: string,
  context: PageAuthContext,
): string {
  const snapshot = getTenantSnapshot({ accountId, accountName });
  const sales = listDailySalesSnapshot({ accountId, accountName });
  const staffSummary = listStaffSummary({ accountId, accountName });
  const menuItems = snapshot.menu
    .map((item) =>
      renderTemplate("partials/ops-menu-item.html", {
        name: escapeHtml(item.name),
        metaPrimary: money(item.price),
        metaSecondary: item.available ? "available" : "hidden",
      }),
    )
    .join("");

  return renderShell({
    title: `${accountName} · Operations`,
    subtitle: "Revenue, open orders, and menu management.",
    body: renderTemplate("pages/ops-body.html", {
      accountName: escapeHtml(accountName),
      projectId: escapeHtml(context.projectId ?? "none"),
      userName: escapeHtml(
        context.user.name ?? context.user.email ?? "unknown",
      ),
      pagePath: escapeHtml(context.pagePath),
      openOrders: String(staffSummary.openOrders),
      readyOrders: String(staffSummary.readyOrders),
      revenue: money(sales.revenue),
      menuItems,
    }),
  });
}

export function renderUnauthorizedPage(): string {
  return renderShell({
    title: "Unauthorized",
    subtitle: "You don\u2019t have permission to view this page.",
    body: renderTemplate("pages/message-body.html", {
      message:
        "This page requires valid authentication. Please open it through an authorized channel.",
    }),
  });
}

export function renderNotFoundPage(): string {
  return renderShell({
    title: "Not Found",
    subtitle: "The page you\u2019re looking for doesn\u2019t exist.",
    body: renderTemplate("pages/message-body.html", {
      message: "Check the URL and try again, or go back to the dashboard.",
    }),
  });
}

function renderShell(input: {
  title: string;
  subtitle: string;
  body: string;
}): string {
  return renderTemplate("shell.html", {
    title: escapeHtml(input.title),
    subtitle: escapeHtml(input.subtitle),
    body: input.body,
  });
}

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
