import type { PageContext } from "konsier";

import {
  getTenantSnapshot,
  listDailySalesSnapshot,
  listStaffSummary,
  listTenants,
} from "../state";
import { renderTemplate } from "./template";

export function renderHomePage(input?: {
  connectStatus?: string | null;
}): string {
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
      connectPanel: renderConnectPanel(input),
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
  context: PageContext,
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
    theme: context.theme,
    body: renderTemplate("pages/ops-body.html", {
      accountName: escapeHtml(accountName),
      projectId: escapeHtml(context.projectId ?? "none"),
      theme: escapeHtml(context.theme),
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
  theme?: "light" | "dark";
}): string {
  return renderTemplate("shell.html", {
    title: escapeHtml(input.title),
    subtitle: escapeHtml(input.subtitle),
    body: input.body,
    themeClass: input.theme === "dark" ? "theme-dark" : "theme-light",
  });
}

function renderConnectPanel(input?: {
  connectStatus?: string | null;
}): string {
  const status = escapeHtml(input?.connectStatus ?? "");
  const cta =
    '<div class="actions"><a href="/connect" class="btn btn-primary">Connect Restaurant Project</a></div>';
  const helper =
    "Connect a Konsier project to this platform to start generating tenant-aware restaurant state.";
  const statusMarkup = status
    ? `<div class="meta-row"><span class="meta-tag">${status}</span></div>`
    : "";

  return `
    <section class="card" style="margin-bottom: 16px;">
      <div class="card-label">Accounts</div>
      <h2>Connect a restaurant</h2>
      <p style="color: var(--secondary); font-size: 0.938rem; line-height: 1.6; margin-top: 8px;">
        ${escapeHtml(helper)}
      </p>
      ${statusMarkup}
      ${cta}
    </section>
  `;
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
