/**
 * ProductLineBadge — displays a product line name as a colored badge.
 *
 * The `line` prop can be:
 *  - a populated product-line object { name, displayColor }
 *  - a plain string (name only)
 *  - null/undefined (renders an em-dash)
 */
export default function ProductLineBadge({ line }) {
  if (!line) return <span className="text-muted">—</span>;
  const name = line.name ?? line;
  const color = line.displayColor ?? "#6c757d";
  return (
    <span
      className="badge"
      style={{ backgroundColor: color, color: "#fff" }}
      aria-label={`Product Line: ${name}`}
    >
      {name}
    </span>
  );
}
