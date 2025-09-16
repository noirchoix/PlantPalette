// Utility to extract dominant colors from an HTMLImageElement

export interface PaletteColor {
  hex: string;
  rgb: string;
  cmyk: number[];
  count: number;
  share: number;
}

export async function extractColors(
  imageEl: HTMLImageElement,
  maxColors = 10
): Promise<PaletteColor[]> {
  const pixels = getPixelsFromImage(imageEl, 12000);
  if (pixels.length === 0) return [];

  const k = Math.min(maxColors, 12);
  const clusters = kmeans(pixels, k, 30).slice(0, maxColors);
  const total = clusters.reduce((s, c) => s + c.count, 0);

  return clusters.map(c => {
    const [r, g, b] = c.rgb as number[];
    const hex = rgbToHex(r, g, b);
    const rgb = `rgb(${r}, ${g}, ${b})`;
    const cmyk = rgbToCmyk(r, g, b).map(x => Math.round(x * 100));
    return { hex, rgb, cmyk, count: c.count, share: +(c.count / total).toFixed(3) };
  });
}

// ---- helper functions (can remain in same file or separate util module) ----
function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function rgbToCmyk(r: number, g: number, b: number) {
  if (r === 0 && g === 0 && b === 0) return [0, 0, 0, 1];
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const k = 1 - Math.max(rr, gg, bb);
  const c = (1 - rr - k) / (1 - k) || 0;
  const m = (1 - gg - k) / (1 - k) || 0;
  const y = (1 - bb - k) / (1 - k) || 0;
  return [c, m, y, k];
}

function getPixelsFromImage(img: HTMLImageElement, maxSamples = 10000) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const total = width * height;
  const step = Math.max(1, Math.floor(total / maxSamples));
  const pixels: number[][] = [];
  for (let i = 0; i < total; i += step) {
    const idx = i * 4;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
    if (a >= 125) pixels.push([r, g, b]);
  }
  return pixels;
}

function kmeans(pixels: number[][], k = 8, maxIter = 20) {
  if (pixels.length === 0) return [];
  const centroids: number[][] = [];
  const used = new Set<number>();
  while (centroids.length < k) {
    const idx = Math.floor(Math.random() * pixels.length);
    if (!used.has(idx)) {
      centroids.push([...pixels[idx]]);
      used.add(idx);
    }
  }
  let assignments = new Array(pixels.length).fill(-1);
  for (let iter = 0; iter < maxIter; iter++) {
    let moved = false;
    // assign
    for (let i = 0; i < pixels.length; i++) {
      let best = 0, bestd = Infinity;
      for (let j = 0; j < k; j++) {
        const d = dist2(pixels[i], centroids[j]);
        if (d < bestd) { bestd = d; best = j; }
      }
      if (assignments[i] !== best) { moved = true; assignments[i] = best; }
    }
    // update
    const sums = Array.from({ length: k }, () => [0, 0, 0, 0]);
    for (let i = 0; i < pixels.length; i++) {
      const a = assignments[i];
      sums[a][0] += pixels[i][0];
      sums[a][1] += pixels[i][1];
      sums[a][2] += pixels[i][2];
      sums[a][3] += 1;
    }
    for (let j = 0; j < k; j++) {
      if (sums[j][3] === 0) continue;
      centroids[j][0] = Math.round(sums[j][0] / sums[j][3]);
      centroids[j][1] = Math.round(sums[j][1] / sums[j][3]);
      centroids[j][2] = Math.round(sums[j][2] / sums[j][3]);
    }
    if (!moved) break;
  }
  const counts = new Array(k).fill(0);
  for (let a of assignments) counts[a]++;
  return centroids.map((c, i) => ({ rgb: c as number[], count: counts[i] }))
                  .sort((a, b) => b.count - a.count);
}

function dist2(a: number[], b: number[]) {
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}
