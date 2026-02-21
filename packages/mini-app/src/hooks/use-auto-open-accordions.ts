import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/**
 * Auto-opens accordions if viewport has enough space.
 *
 * Uses useLayoutEffect to measure BEFORE browser paint.
 * scrollHeight on overflow:hidden children reflects full content height
 * even when the parent grid row collapses them to 0px.
 *
 * @param count - total number of accordions
 * @param enabled - whether auto-open is enabled
 * @param skipIndices - indices to skip from auto-opening (e.g. [0] to skip rate)
 */
export function useAutoOpenAccordions(count: number, enabled = true, skipIndices: number[] = []) {
  const containerRef = useRef<HTMLElement>(null);
  const contentRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [openSet, setOpenSet] = useState<Set<number>>(new Set());
  const hasCalculatedRef = useRef(false);

  const setContentRef = useCallback((index: number) => {
    return (el: HTMLDivElement | null) => {
      contentRefs.current[index] = el;
    };
  }, []);

  useLayoutEffect(() => {
    if (!enabled || hasCalculatedRef.current) return;

    const container = containerRef.current;
    if (!container) return;

    // The container is a scrollable flex-1 element.
    // clientHeight = visible area (including padding).
    // scrollHeight = total content height (may equal clientHeight if no overflow).
    // We want: how much free space is there for accordion content?
    // Free space = clientHeight - (sum of children's heights when all closed)
    //
    // Since the container has pb-32 (128px) for the fixed CTA button,
    // and scrollHeight === clientHeight when there's no overflow,
    // we compute: freeSpace = clientHeight - actualContentHeight
    // where actualContentHeight = last child's bottom - container's top (in scroll coords)

    const children = container.children;
    if (children.length === 0) return;

    const lastChild = children[children.length - 1] as HTMLElement;
    const contentBottom = lastChild.offsetTop + lastChild.offsetHeight;
    const freeSpace = container.clientHeight - contentBottom;

    if (freeSpace <= 0) return;

    // scrollHeight on overflow:hidden divs returns full content height
    const heights = Array.from({ length: count }, (_, i) =>
      contentRefs.current[i]?.scrollHeight ?? 0,
    );

    // Greedily open from top until budget exhausted
    const skipSet = new Set(skipIndices);
    let budget = freeSpace;
    const toOpen = new Set<number>();
    for (let i = 0; i < count; i++) {
      if (skipSet.has(i)) continue;
      if (heights[i] > 0 && heights[i] <= budget) {
        toOpen.add(i);
        budget -= heights[i];
      } else if (heights[i] > budget) {
        break;
      }
    }

    if (toOpen.size > 0) {
      setOpenSet(toOpen);
    }
    hasCalculatedRef.current = true;
  }, [count, enabled, skipIndices.join(',')]);

  const isOpen = useCallback((index: number) => openSet.has(index), [openSet]);

  const toggle = useCallback((index: number) => {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  return { containerRef, setContentRef, isOpen, toggle };
}
