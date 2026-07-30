export function compressImage(
  dataUrl: string,
  maxDimension: number = 512,
  quality: number = 0.8
): Promise<string> {
  return new Promise((resolve) => {
    if (!dataUrl || !dataUrl.startsWith('data:image')) {
      resolve(dataUrl);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width <= maxDimension && height <= maxDimension && dataUrl.length < 80000) {
        resolve(dataUrl);
        return;
      }

      if (width > height) {
        if (width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      try {
        const compressedWebp = canvas.toDataURL('image/webp', quality);
        if (compressedWebp && compressedWebp.startsWith('data:image/webp')) {
          resolve(compressedWebp);
          return;
        }
      } catch (err) {
        console.warn('WebP conversion fallback to PNG:', err);
      }

      const compressedPng = canvas.toDataURL('image/png');
      resolve(compressedPng);
    };

    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
