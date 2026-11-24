export interface CaptureElementOptions {
  element: HTMLElement;
  filename: string;
  backgroundColor?: string;
  scale?: number;
}

const UNSUPPORTED_COLOR_FN_RE = /oklch|oklab|color-mix|\blab\(|\blch\(/i;
const STANDALONE_COLOR_FN_RE = /(?:oklch|oklab|lab|lch)\([^()]*\)/gi;
const GRADIENT_SPACE_RE = /\s+in\s+(?:oklab|oklch|srgb|hsl|lab|lch)(?:\s+(?:shorter|longer|increasing|decreasing)\s+hue)?/gi;

/**
 * Lightweight, fast DOM-to-PNG capture helper for the currently visible Dashboard view.
 * - Dynamically imports html2canvas only when triggered (zero startup overhead).
 * - Resolves Tailwind v4 oklch/oklab/color-mix colors on document.body/html, cloned <style> sheets,
 *   and all cloned elements parsed by html2canvas CSSParsedDeclaration.
 * - Expands internal scroll areas on the cloned tree so all visible menu data is captured cleanly.
 * - Uses async canvas.toBlob + ObjectURL (with toDataURL fallback) for fast download.
 */
export async function captureElementToPng({
  element,
  filename,
  backgroundColor = '#0A0E17',
  scale = 1.5,
}: CaptureElementOptions): Promise<void> {
  // Yield one frame so any loading state renders immediately at 0ms
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

  const { default: html2canvas } = await import('html2canvas');

  const offscreen = document.createElement('canvas');
  offscreen.width = 1;
  offscreen.height = 1;
  const ctx = offscreen.getContext('2d', { willReadFrequently: true });
  const colorCache = new Map<string, string>();

  const normalizeColor = (cssVal: string): string | null => {
    if (!cssVal || !UNSUPPORTED_COLOR_FN_RE.test(cssVal)) {
      return null;
    }
    const cached = colorCache.get(cssVal);
    if (cached !== undefined) return cached;
    if (!ctx) return null;
    try {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.fillStyle = cssVal;
      ctx.fillRect(0, 0, 1, 1);
      const data = ctx.getImageData(0, 0, 1, 1).data;
      const a = +(data[3] / 255).toFixed(3);
      const resolved = `rgba(${data[0]}, ${data[1]}, ${data[2]}, ${a})`;
      colorCache.set(cssVal, resolved);
      return resolved;
    } catch {
      return null;
    }
  };

  const sanitizeCssText = (cssText: string): string => {
    if (!cssText || !UNSUPPORTED_COLOR_FN_RE.test(cssText)) return cssText;
    let out = cssText.replace(GRADIENT_SPACE_RE, '');
    out = out.replace(STANDALONE_COLOR_FN_RE, (match) => normalizeColor(match) || match);
    return out;
  };

  // html2canvas parses ownerDocument.documentElement & ownerDocument.body backgroundColor BEFORE onclone!
  const docEl = document.documentElement;
  const bodyEl = document.body;
  const prevDocBg = docEl.style.backgroundColor;
  const prevBodyBg = bodyEl.style.backgroundColor;
  const rawDocBg = getComputedStyle(docEl).backgroundColor;
  const rawBodyBg = getComputedStyle(bodyEl).backgroundColor;

  if (UNSUPPORTED_COLOR_FN_RE.test(rawDocBg)) {
    docEl.style.backgroundColor = normalizeColor(rawDocBg) || 'rgba(0, 0, 0, 0)';
  }
  if (UNSUPPORTED_COLOR_FN_RE.test(rawBodyBg)) {
    bodyEl.style.backgroundColor = normalizeColor(rawBodyBg) || '#0A0E17';
  }

  const markerAttr = 'data-capture-root';
  element.setAttribute(markerAttr, '1');

  try {
    const captureWidth = Math.max(element.scrollWidth, element.clientWidth);
    const canvas = await html2canvas(element, {
      scale,
      useCORS: true,
      backgroundColor,
      logging: false,
      width: captureWidth,
      windowWidth: Math.max(1280, captureWidth),
      ignoreElements: (el) => el.getAttribute('data-capture-hide') === 'true',
      onclone: (clonedDoc) => {
        // 1. Sanitize inline <style> sheets in clonedDoc so CSS vars/gradients use rgba()
        const styleTags = clonedDoc.querySelectorAll('style');
        styleTags.forEach((tag) => {
          if (tag.textContent && UNSUPPORTED_COLOR_FN_RE.test(tag.textContent)) {
            tag.textContent = sanitizeCssText(tag.textContent);
          }
        });

        const clonedRoot = clonedDoc.querySelector<HTMLElement>(`[${markerAttr}="1"]`);
        if (!clonedRoot) return;

        const win = clonedDoc.defaultView || window;
        const targets: Element[] = [
          clonedDoc.documentElement,
          clonedDoc.body,
          clonedRoot,
          ...Array.from(clonedRoot.querySelectorAll('*')),
        ];

        for (let i = 0; i < targets.length; i++) {
          const el = targets[i] as HTMLElement | SVGElement;
          if (!el || !('style' in el)) continue;
          const cs = win.getComputedStyle(el);

          const bgCol = normalizeColor(cs.backgroundColor);
          if (bgCol) el.style.backgroundColor = bgCol;

          const txtCol = normalizeColor(cs.color);
          if (txtCol) el.style.color = txtCol;

          const bTop = normalizeColor(cs.borderTopColor);
          if (bTop) el.style.borderTopColor = bTop;

          const bRight = normalizeColor(cs.borderRightColor);
          if (bRight) el.style.borderRightColor = bRight;

          const bBottom = normalizeColor(cs.borderBottomColor);
          if (bBottom) el.style.borderBottomColor = bBottom;

          const bLeft = normalizeColor(cs.borderLeftColor);
          if (bLeft) el.style.borderLeftColor = bLeft;

          const decCol = normalizeColor(cs.textDecorationColor);
          if (decCol) {
            el.style.textDecorationColor = decCol;
          } else if (txtCol) {
            el.style.textDecorationColor = txtCol;
          }

          const strokeTextCol = normalizeColor(
            (cs as CSSStyleDeclaration & { webkitTextStrokeColor?: string }).webkitTextStrokeColor || ''
          );
          if (strokeTextCol) {
            (el.style as CSSStyleDeclaration & { webkitTextStrokeColor?: string }).webkitTextStrokeColor =
              strokeTextCol;
          }

          if (cs.fill && UNSUPPORTED_COLOR_FN_RE.test(cs.fill)) {
            const fillCol = normalizeColor(cs.fill);
            if (fillCol) el.style.fill = fillCol;
          }

          if (cs.stroke && UNSUPPORTED_COLOR_FN_RE.test(cs.stroke)) {
            const strokeCol = normalizeColor(cs.stroke);
            if (strokeCol) el.style.stroke = strokeCol;
          }

          if (cs.boxShadow && UNSUPPORTED_COLOR_FN_RE.test(cs.boxShadow)) {
            el.style.boxShadow = 'none';
          }

          if (cs.textShadow && UNSUPPORTED_COLOR_FN_RE.test(cs.textShadow)) {
            el.style.textShadow = 'none';
          }

          if (cs.listStyleImage && UNSUPPORTED_COLOR_FN_RE.test(cs.listStyleImage)) {
            el.style.listStyleImage = 'none';
          }

          if (cs.backgroundImage && UNSUPPORTED_COLOR_FN_RE.test(cs.backgroundImage)) {
            const sanitizedBg = sanitizeCssText(cs.backgroundImage);
            el.style.backgroundImage = UNSUPPORTED_COLOR_FN_RE.test(sanitizedBg)
              ? 'none'
              : sanitizedBg;
          }

          // Expand internal scroll boxes on the cloned DOM so truncated lists show completely
          if (
            (cs.overflowY === 'auto' || cs.overflowY === 'scroll') &&
            cs.maxHeight &&
            cs.maxHeight !== 'none'
          ) {
            el.style.maxHeight = 'none';
            el.style.overflowY = 'visible';
          }
          if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') {
            el.style.overflowX = 'visible';
          }
        }
      },
    });

    await new Promise<void>((resolve, reject) => {
      const triggerDownload = (href: string, revokeAfter: boolean) => {
        const link = document.createElement('a');
        link.style.display = 'none';
        link.href = href;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        if (revokeAfter) {
          setTimeout(() => URL.revokeObjectURL(href), 2000);
        }
      };

      canvas.toBlob(
        (blob) => {
          try {
            if (blob) {
              const url = URL.createObjectURL(blob);
              triggerDownload(url, true);
            } else {
              const dataUrl = canvas.toDataURL('image/png');
              triggerDownload(dataUrl, false);
            }
            resolve();
          } catch (err) {
            reject(err);
          }
        },
        'image/png',
        0.95
      );
    });
  } finally {
    docEl.style.backgroundColor = prevDocBg;
    bodyEl.style.backgroundColor = prevBodyBg;
    element.removeAttribute(markerAttr);
  }
}
