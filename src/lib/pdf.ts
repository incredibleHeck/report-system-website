import { toCanvas } from 'html-to-image';
import { jsPDF } from 'jspdf';

const MARGIN = 6;

async function waitForImages(element: HTMLElement) {
  const images = Array.from(element.querySelectorAll('img'));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
          if (!img.src) resolve();
        })
    )
  );
}

/**
 * Render HTML to A4 PDF.
 * Fits on 1 page when possible; splits across pages if taller.
 * Explicitly cleans up HTML5 Canvas memory in finally block.
 */
export async function elementToPdfBase64(
  element: HTMLElement, 
  fileName: string,
  opts?: { orientation?: 'portrait' | 'landscape' }
) {
  const orientation = opts?.orientation || 'landscape';
  const PAGE_W = orientation === 'landscape' ? 297 : 210;
  const PAGE_H = orientation === 'landscape' ? 210 : 297;

  await waitForImages(element);
  const canvas = await toCanvas(element, {
    pixelRatio: 2,
    backgroundColor: '#ffffff',
  });

  const createdCanvases: HTMLCanvasElement[] = [canvas];

  try {
    const pdf = new jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: 'a4',
    });

    const usableW = PAGE_W - MARGIN * 2;
    const usableH = PAGE_H - MARGIN * 2;

    // Width-fit scale (full page width)
    const scale = usableW / canvas.width;
    const scaledFullH = canvas.height * scale;

    if (scaledFullH <= usableH) {
      // Single page — centre vertically
      const y = MARGIN + (usableH - scaledFullH) / 2;
      pdf.addImage(
        canvas.toDataURL('image/jpeg', 0.93),
        'JPEG',
        MARGIN,
        y,
        usableW,
        scaledFullH
      );
    } else {
      // Spans across multiple pages dynamically
      const defaultSlicePx = Math.floor(usableH / scale);

      const rootRect = element.getBoundingClientRect();
      const breakableElements = Array.from(element.querySelectorAll('tr, .avoid-break'));
      const breakBounds = breakableElements.map((el) => {
        const avoidParent = (el.closest('.avoid-break') as HTMLElement) || null;
        const rect = el.getBoundingClientRect();
        return {
          el,
          avoidParent,
          top: (rect.top - rootRect.top) * 2,
          bottom: (rect.bottom - rootRect.top) * 2,
        };
      });

      let currentY = 0;
      let pageCount = 0;

      while (currentY < canvas.height && pageCount < 10) {
        let sliceH = Math.min(defaultSlicePx, canvas.height - currentY);
        let breakY = currentY + sliceH;

        if (breakY < canvas.height) {
          for (let i = breakBounds.length - 1; i >= 0; i--) {
            const rb = breakBounds[i];
            let top = rb.top;
            let bottom = rb.bottom;

            if (rb.avoidParent) {
              const pRect = rb.avoidParent.getBoundingClientRect();
              const pTop = (pRect.top - rootRect.top) * 2;
              const pBottom = (pRect.bottom - rootRect.top) * 2;
              if (pTop > currentY) {
                top = pTop;
                bottom = pBottom;
              }
            }

            // If the element (or its container) crosses the break boundary
            if (top > currentY && top < breakY && bottom > breakY) {
              // Provide a 10px (scaled) safety margin above the element to avoid clipping borders
              breakY = Math.max(currentY + 1, top - 10);
              sliceH = breakY - currentY;
              break;
            }
          }
        }

        // Fallback if an element is taller than a whole page
        if (sliceH <= 0) {
          sliceH = Math.min(defaultSlicePx, canvas.height - currentY);
          breakY = currentY + sliceH;
        }

        const sliceCanvas = document.createElement('canvas');
        createdCanvases.push(sliceCanvas);
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceH;
        const ctx = sliceCanvas.getContext('2d');
        if (!ctx) break;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(
          canvas,
          0,
          currentY,
          canvas.width,
          sliceH,
          0,
          0,
          canvas.width,
          sliceH
        );

        if (pageCount > 0) pdf.addPage('a4', orientation);
        const drawH = sliceH * scale;
        pdf.addImage(
          sliceCanvas.toDataURL('image/jpeg', 0.93),
          'JPEG',
          MARGIN,
          MARGIN,
          usableW,
          drawH
        );

        currentY = breakY;
        pageCount++;
      }
    }

    const dataUri = pdf.output('datauristring');
    const base64 = dataUri.split(',')[1] || '';
    return { base64, dataUri, fileName, blob: pdf.output('blob') as Blob };
  } finally {
    // Explicit HTML5 Canvas memory cleanup to free GPU memory
    for (const c of createdCanvases) {
      try {
        c.width = 0;
        c.height = 0;
      } catch {}
    }
  }
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
