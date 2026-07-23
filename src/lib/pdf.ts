import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/** A4 landscape in mm */
const PAGE_W = 297;
const PAGE_H = 210;
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
 * Render report HTML to A4 landscape PDF.
 * Fits on 1 page when possible; splits across at most 2 pages if taller.
 */
export async function elementToPdfBase64(element: HTMLElement, fileName: string) {
  await waitForImages(element);
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
  });

  const pdf = new jsPDF({
    orientation: 'landscape',
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
    // Cap at 2 pages: slice the source canvas into two vertical bands
    const maxScaledH = usableH * 2;
    const drawScale = scaledFullH > maxScaledH ? maxScaledH / canvas.height : scale;
    const pageSlicePx = Math.floor(usableH / drawScale);

    for (let page = 0; page < 2; page++) {
      const srcY = page * pageSlicePx;
      if (srcY >= canvas.height) break;

      const sliceH = Math.min(pageSlicePx, canvas.height - srcY);
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceH;
      const ctx = sliceCanvas.getContext('2d');
      if (!ctx) break;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      ctx.drawImage(
        canvas,
        0,
        srcY,
        canvas.width,
        sliceH,
        0,
        0,
        canvas.width,
        sliceH
      );

      if (page > 0) pdf.addPage('a4', 'landscape');
      const drawH = sliceH * drawScale;
      pdf.addImage(
        sliceCanvas.toDataURL('image/jpeg', 0.93),
        'JPEG',
        MARGIN,
        MARGIN,
        usableW,
        drawH
      );
    }
  }

  const dataUri = pdf.output('datauristring');
  const base64 = dataUri.split(',')[1] || '';
  return { base64, dataUri, fileName, blob: pdf.output('blob') as Blob };
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
