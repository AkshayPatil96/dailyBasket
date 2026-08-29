export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Renders the cropped region of an image onto a canvas and returns it as a Blob. */
export function getCroppedImageBlob(imageSrc: string, crop: CropArea): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = crop.width;
      canvas.height = crop.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }
      ctx.drawImage(
        image,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        crop.width,
        crop.height,
      );
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Could not crop image'))),
        'image/jpeg',
        0.92,
      );
    };
    image.onerror = () => reject(new Error('Could not load image'));
    image.src = imageSrc;
  });
}
