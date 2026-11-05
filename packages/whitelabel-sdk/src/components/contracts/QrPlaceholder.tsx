const MODULES = 25;
const FINDER = 7;

/** Whether a module sits in, or in the clear margin around, one of the three corner squares. */
function inFinderArea(x: number, y: number) {
  const left = x <= FINDER;
  const right = x >= MODULES - FINDER - 1;
  const top = y <= FINDER;
  const bottom = y >= MODULES - FINDER - 1;
  return (left && top) || (right && top) || (left && bottom);
}

/** A fixed scatter, so the picture is the same on every render. */
function isFilled(x: number, y: number) {
  let hash = Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) % 100 < 48;
}

const CELLS = Array.from({ length: MODULES * MODULES }, (_, i) => ({
  x: i % MODULES,
  y: Math.floor(i / MODULES),
})).filter(({ x, y }) => !inFinderArea(x, y) && isFilled(x, y));

const FINDER_CORNERS = [
  [0, 0],
  [MODULES - FINDER, 0],
  [0, MODULES - FINDER],
];

/**
 * The shape of a QR code, for a seller's preview of their own request.
 *
 * ⚠️ A PICTURE, NOT A CODE. It encodes nothing: that preview has no escrow address, and money sent
 *    to one nothing is watching can be stranded. Sized as QrPaymentPanel's real code, in its frame.
 */
export default function QrPlaceholder() {
  return (
    <svg
      data-testid="qr-placeholder"
      aria-hidden="true"
      width={200}
      height={200}
      viewBox={`-2 -2 ${MODULES + 4} ${MODULES + 4}`}
      fill="#000000"
    >
      {FINDER_CORNERS.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <path fillRule="evenodd" d={`M${x} ${y}h7v7h-7zM${x + 1} ${y + 1}v5h5v-5z`} />
          <rect x={x + 2} y={y + 2} width={3} height={3} />
        </g>
      ))}
      {CELLS.map(({ x, y }) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />
      ))}
    </svg>
  );
}
