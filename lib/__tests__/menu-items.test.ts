import { describe, expect, it } from "vitest";
import { adminNavItems, sortMenuItemsByOrder } from "@/lib/menu-items";

const items = [
  { module: "dashboard" },
  { module: "users" },
  { module: "fleet" },
  { module: "settings" },
];

describe("sortMenuItemsByOrder", () => {
  it("orders items by the given moduleKey order", () => {
    const order = ["fleet", "settings", "users", "dashboard"];
    expect(sortMenuItemsByOrder(items, order).map((i) => i.module)).toEqual([
      "fleet",
      "settings",
      "users",
      "dashboard",
    ]);
  });

  it("keeps unknown items at the end in their original order", () => {
    const order = ["fleet"]; // only one key known
    expect(sortMenuItemsByOrder(items, order).map((i) => i.module)).toEqual([
      "fleet",
      "dashboard",
      "users",
      "settings",
    ]);
  });

  it("returns the original order when order is empty", () => {
    expect(sortMenuItemsByOrder(items, []).map((i) => i.module)).toEqual([
      "dashboard",
      "users",
      "fleet",
      "settings",
    ]);
  });

  it("does not mutate the input array", () => {
    const copy = [...items];
    sortMenuItemsByOrder(items, ["fleet"]);
    expect(items).toEqual(copy);
  });

  it("exposes the flat list of real nav items", () => {
    expect(adminNavItems.length).toBeGreaterThan(0);
    expect(adminNavItems.every((i) => typeof i.module === "string")).toBe(true);
  });

  it("includes the restored notifications and calendar items", () => {
    const modules = adminNavItems.map((i) => i.module);
    expect(modules).toContain("notifications");
    expect(modules).toContain("calendar");
  });
});
