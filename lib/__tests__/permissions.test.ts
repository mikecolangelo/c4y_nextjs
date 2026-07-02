import { describe, expect, it } from "vitest";
import { can, canAccessPath, type RolePermissions } from "@/lib/permissions";

const perms: RolePermissions = {
  fleet: {
    canAccess: true,
    canRead: true,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
  },
  billing: {
    canAccess: false,
    canRead: false,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
  },
};

describe("can", () => {
  it("permite una acción concedida", () => {
    expect(can(perms, "fleet", "canRead")).toBe(true);
    expect(can(perms, "fleet", "canAccess")).toBe(true);
  });

  it("niega una acción no concedida", () => {
    expect(can(perms, "fleet", "canUpdate")).toBe(false);
    expect(can(perms, "fleet", "canDelete")).toBe(false);
  });

  it("niega cuando el módulo no está en la matriz", () => {
    expect(can(perms, "stock", "canRead")).toBe(false);
  });

  it("niega todo sobre un módulo sin acceso", () => {
    expect(can(perms, "billing", "canRead")).toBe(false);
    expect(can(perms, "billing", "canCreate")).toBe(false);
  });
});

describe("canAccessPath", () => {
  it("bloquea una ruta cuyo módulo no tiene canAccess", () => {
    expect(canAccessPath(perms, "/billing")).toBe(false);
  });

  it("permite una ruta cuyo módulo tiene canAccess", () => {
    expect(canAccessPath(perms, "/fleet/details/123")).toBe(true);
  });

  it("no bloquea rutas no mapeadas", () => {
    expect(canAccessPath(perms, "/algo-no-mapeado")).toBe(true);
  });
});
