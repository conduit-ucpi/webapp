import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// The pages are pre-rendered, where useLayoutEffect only warns.
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Least space kept between the links and the actions before the bar collapses (px). */
const MIN_GAP = 24;

/**
 * Whether a top bar's brand, links and actions fit on one line, measured rather than guessed
 * from a breakpoint: the width depends on the brand's name and fonts, the signed-in label, and
 * the width the page is given — an iframe on a partner's page, not just the device.
 *
 * Put `rowRef` on the bar's row and the part refs on its three blocks; give the links and actions
 * `barPart`, the menu button and its panel `menuPart`, and the row `rowClip`. Collapsed parts stay
 * laid out but invisible, so their natural widths can still be read and the answer never flips
 * with the mode. Until measured (the pre-rendered HTML) the CSS falls back to the `xl` breakpoint.
 *
 * @param brandGap the row's gap between the brand and the links (px)
 * @param onFit called when the bar is found to fit, e.g. to shut an open mobile panel
 */
export function useBarFit(brandGap: number, onFit?: () => void) {
  const rowRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const linksRef = useRef<HTMLUListElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [fits, setFits] = useState<boolean | null>(null);
  const onFitRef = useRef(onFit);
  onFitRef.current = onFit;

  useIsomorphicLayoutEffect(() => {
    const row = rowRef.current, brand = brandRef.current, links = linksRef.current, actions = actionsRef.current;
    if (!row || !brand || !links || !actions) return;
    const measure = () => {
      if (!row.clientWidth) return; // not laid out (hidden, or a test DOM)
      const needed = brand.scrollWidth + brandGap + links.scrollWidth + MIN_GAP + actions.scrollWidth;
      const nowFits = needed <= row.clientWidth;
      setFits(nowFits);
      if (nowFits) onFitRef.current?.();
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    [row, brand, links, actions].forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [brandGap]);

  return {
    rowRef,
    brandRef,
    linksRef,
    actionsRef,
    fits,
    barPart:
      fits === null ? 'flex max-xl:absolute max-xl:invisible max-xl:pointer-events-none'
        : fits ? 'flex' : 'flex absolute invisible pointer-events-none',
    menuPart: fits === null ? 'xl:hidden' : fits ? 'hidden' : '',
    // Collapsed, the invisible bar still has its full width: clip it so a narrow page doesn't
    // scroll sideways. Only then — open dropdowns may reach past the row.
    rowClip: fits === null ? 'max-xl:overflow-x-clip' : fits ? '' : 'overflow-x-clip',
  };
}
