import { describe, expect, it } from "vitest";

import { isAdminRole, isModuleActionAllowed } from "../module-guard";

describe("isAdminRole", () => {
  it("reconoce admin y super-admin", () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("super-admin")).toBe(true);
  });

  it("rechaza cualquier otro rol", () => {
    expect(isAdminRole("driver")).toBe(false);
    expect(isAdminRole("test")).toBe(false);
    expect(isAdminRole("lead")).toBe(false);
  });
});

describe("isModuleActionAllowed", () => {
  it("el admin siempre puede, tenga o no permiso en la matriz", () => {
    expect(isModuleActionAllowed({ role: "admin", hasPermission: false })).toBe(true);
    expect(isModuleActionAllowed({ role: "super-admin", hasPermission: false })).toBe(true);
  });

  it("permite a un no-admin con permiso", () => {
    expect(isModuleActionAllowed({ role: "driver", hasPermission: true })).toBe(true);
  });

  it("niega a un no-admin sin permiso", () => {
    expect(isModuleActionAllowed({ role: "test", hasPermission: false })).toBe(false);
  });
});
