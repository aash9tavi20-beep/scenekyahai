import { expect, it } from "vitest";
import { curationPrice } from "./curation-policy";

it("requires no payment for either new or returning devices while payments are suspended", () => {
  expect(curationPrice(0)).toBe(0);
  expect(curationPrice(1)).toBe(0);
  expect(curationPrice(50)).toBe(0);
});