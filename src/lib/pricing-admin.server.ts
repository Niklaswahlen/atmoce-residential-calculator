import { timingSafeEqual } from "node:crypto";

export function verifyAdmin(password: unknown) {
  const expected = process.env.PRISER_ADMIN_PASSWORD;
  if (!expected) {
    throw new Error("PRISER_ADMIN_PASSWORD is not configured on the server");
  }
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("Unauthorized");
  }
  const a = Buffer.from(password, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Unauthorized");
  }
}