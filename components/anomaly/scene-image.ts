import { createElement } from 'react';
import type { BoundingBox, Camera, DetectionClass } from '@/lib/types';
import { ZoneScene } from './zone-feed';

const W = 1280;
const H = 720;

// Renders the drawn camera scene (heads anonymised) to a PNG, for simulated frames that have no camera image.
export async function sceneToPng(camera: Camera, boxes: BoundingBox[], active: Set<DetectionClass>): Promise<Blob> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const markup = renderToStaticMarkup(createElement(ZoneScene, { camera: { ...camera, status: 'online' }, boxes, active, privacy: true }))
    .replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" `);
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    canvas.getContext('2d')!.drawImage(img, 0, 0, W, H);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Scene could not be rendered'))), 'image/png')
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
