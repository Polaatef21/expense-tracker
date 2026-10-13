// Keeps the category chart readable: the largest categories first, and the
// long tail folded into a single "Other (n)" bar.
export function groupCategories(rows, max = 7) {
  const toBar = (r) => ({ name: r.name, total: Number(r.total) });
  if (rows.length <= max) return rows.map(toBar);
  const top = rows.slice(0, max - 1).map(toBar);
  const rest = rows.slice(max - 1);
  const restTotal = rest.reduce((sum, r) => sum + Number(r.total), 0);
  return [...top, { name: `Other (${rest.length})`, total: Math.round(restTotal * 100) / 100 }];
}
