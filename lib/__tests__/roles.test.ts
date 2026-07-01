import { describe, expect, it } from "vitest";
import { roleGetsCredentials, labelForRole, type Role } from "@/lib/roles";

const ROLES: Role[] = [
  { id: 1, key: "admin", label: "Administrador", isSystem: true, isActive: true },
  { id: 2, key: "driver", label: "Usuario", isSystem: true, isActive: true },
  { id: 3, key: "lead", label: "Lead", isSystem: true, isActive: true },
  { id: 4, key: "taller", label: "Taller", color: "#ff0000", isSystem: false, isActive: true },
];

describe("roleGetsCredentials", () => {
  it("denies credentials only to leads", () => {
    expect(roleGetsCredentials("lead")).toBe(false);
  });

  it("grants credentials to admin, driver and custom roles", () => {
    expect(roleGetsCredentials("admin")).toBe(true);
    expect(roleGetsCredentials("driver")).toBe(true);
    expect(roleGetsCredentials("taller")).toBe(true);
  });
});

describe("labelForRole", () => {
  it("resolves the label for a known role key", () => {
    expect(labelForRole(ROLES, "taller")).toBe("Taller");
    expect(labelForRole(ROLES, "driver")).toBe("Usuario");
  });

  it("falls back to the key when the role is unknown", () => {
    expect(labelForRole(ROLES, "ghost")).toBe("ghost");
    expect(labelForRole([], "driver")).toBe("driver");
  });
});
