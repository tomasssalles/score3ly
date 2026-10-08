// An amount in US dollars with two decimals (DESIGN.md §10): "$0.12". A paid amount below one cent is "<$0.01",
// so "$0.00" only ever means free.
export function dollars(amount: number): string {
  if (amount > 0 && amount < 0.005) return "<$0.01";
  return `$${amount.toFixed(2)}`;
}
