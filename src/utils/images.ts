// srcset для <source>/<img>: одна картинка в нескольких ширинах и одном формате (AVIF / WebP / PNG)
import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';

export type ImageFormat = 'avif' | 'webp' | 'png';

export async function srcset(src: ImageMetadata, widths: number[], format: ImageFormat) {
  const images = await Promise.all(widths.map((width) => getImage({ src, width, format })));
  return images.map((image, i) => `${image.src} ${widths[i]}w`).join(', ');
}
