import { describe, expect, it } from "vitest";
import { getInitials } from "@/lib/format";

describe("getInitials", () => {
  it("returns up to two uppercase initials from a full name", () => {
    expect(getInitials("John Doe")).toBe("JD");
  });

  it("caps at two initials for longer names", () => {
    expect(getInitials("John Michael Doe Smith")).toBe("JM");
  });

  it("uppercases a single-word name to one initial", () => {
    expect(getInitials("madonna")).toBe("M");
  });

  it("collapses extra/leading/trailing whitespace", () => {
    expect(getInitials("  ada   byron  ")).toBe("AB");
  });

  it("is empty-safe for empty strings", () => {
    expect(getInitials("")).toBe("");
  });

  it("is null/undefined-safe", () => {
    expect(getInitials(null)).toBe("");
    expect(getInitials(undefined)).toBe("");
  });
});
