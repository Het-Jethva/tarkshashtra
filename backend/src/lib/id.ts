import { randomUUID } from "node:crypto";

export function createId(prefix: string): string {
  const compactUuid = randomUUID().replace(/-/g, "");
  return `${prefix}_${compactUuid}`;
}
