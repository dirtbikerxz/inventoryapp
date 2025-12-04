export function generateOrderNumber(now = new Date()): string {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.floor(100 + Math.random() * 900);
  return `ORD-${datePart}-${randomPart}`;
}
