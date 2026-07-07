import Potrace from 'potrace/lib/Potrace';
import Bitmap from 'potrace/lib/types/Bitmap';

export async function traceContour(imageDataUrl, offsetPx = 10) {
  const { data: alpha, w, h } = await decodeAlpha(imageDataUrl);
  return traceFromAlpha(alpha, w, h, offsetPx);
}

export function traceFromAlpha(alpha, w, h, offsetPx = 10) {
  const pad = offsetPx + 2;
  const pw = w + pad * 2;
  const ph = h + pad * 2;

  const binary = new Uint8Array(pw * ph);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      binary[(y + pad) * pw + (x + pad)] = alpha[y * w + x] > 10 ? 1 : 0;
    }
  }

  const dilated = offsetPx > 0 ? dilateMask(binary, pw, ph, offsetPx) : binary;

  const bitmap = new Bitmap(pw, ph);
  for (let i = 0; i < dilated.length; i++) {
    bitmap.data[i] = dilated[i] > 0 ? 0 : 255;
  }

  const potrace = new Potrace({
    turdSize: 2,
    alphaMax: 1,
    optCurve: true,
    optTolerance: 0.2,
    threshold: 128,
    blackOnWhite: true,
  });

  potrace._luminanceData = bitmap;
  potrace._imageLoaded = true;

  const svg = potrace.getSVG();
  const rawPath = extractPathD(svg);
  if (!rawPath) return { svgPath: '', segments: [] };

  const segments = parseSvgPathToSegments(rawPath).map(seg => ({
    p0: { x: seg.p0.x - pad, y: seg.p0.y - pad },
    cp1: { x: seg.cp1.x - pad, y: seg.cp1.y - pad },
    cp2: { x: seg.cp2.x - pad, y: seg.cp2.y - pad },
    p1: { x: seg.p1.x - pad, y: seg.p1.y - pad },
  }));

  const svgPath = segmentsToSvgPath(segments);
  return { svgPath, segments };
}

function decodeAlpha(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      const alpha = new Uint8Array(img.width * img.height);
      for (let i = 0; i < alpha.length; i++) {
        alpha[i] = imageData.data[i * 4 + 3];
      }
      resolve({ data: alpha, w: img.width, h: img.height });
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function dilateMask(binary, w, h, radius) {
  const result = new Uint8Array(w * h);
  const r2 = radius * radius;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (binary[y * w + x] === 0) continue;
      const minY = Math.max(0, y - radius);
      const maxY = Math.min(h - 1, y + radius);
      const minX = Math.max(0, x - radius);
      const maxX = Math.min(w - 1, x + radius);
      for (let dy = minY; dy <= maxY; dy++) {
        for (let dx = minX; dx <= maxX; dx++) {
          if ((dx - x) * (dx - x) + (dy - y) * (dy - y) <= r2) {
            result[dy * w + dx] = 1;
          }
        }
      }
    }
  }
  return result;
}

function extractPathD(svgString) {
  const match = svgString.match(/\bd="([^"]+)"/);
  return match ? match[1] : null;
}

function segmentsToSvgPath(segs) {
  if (segs.length === 0) return '';
  const parts = [`M ${segs[0].p0.x},${segs[0].p0.y}`];
  for (const s of segs) {
    const isLine = s.cp1.x === s.p0.x && s.cp1.y === s.p0.y && s.cp2.x === s.p1.x && s.cp2.y === s.p1.y;
    if (isLine) {
      parts.push(`L ${s.p1.x},${s.p1.y}`);
    } else {
      parts.push(`C ${s.cp1.x},${s.cp1.y} ${s.cp2.x},${s.cp2.y} ${s.p1.x},${s.p1.y}`);
    }
  }
  parts.push('Z');
  return parts.join(' ');
}

function parseSvgPathToSegments(d) {
  const tokens = d.match(/[MLCZmlcz]|[-+]?[\d]*\.?\d+(?:[eE][-+]?\d+)?/g);
  if (!tokens) return [];

  const segments = [];
  let cx = 0, cy = 0;
  let i = 0;

  while (i < tokens.length) {
    const tok = tokens[i];

    if (tok === 'M' || tok === 'm') {
      i++;
      while (i + 1 < tokens.length && /^[-+.\d]/.test(tokens[i])) {
        const x = Number(tokens[i++]), y = Number(tokens[i++]);
        cx = tok === 'm' ? cx + x : x;
        cy = tok === 'm' ? cy + y : y;
      }
    } else if (tok === 'C' || tok === 'c') {
      const rel = tok === 'c';
      i++;
      while (i + 5 < tokens.length && /^[-+.\d]/.test(tokens[i])) {
        const x1 = Number(tokens[i++]), y1 = Number(tokens[i++]);
        const x2 = Number(tokens[i++]), y2 = Number(tokens[i++]);
        const x = Number(tokens[i++]), y = Number(tokens[i++]);
        const ax1 = rel ? cx + x1 : x1, ay1 = rel ? cy + y1 : y1;
        const ax2 = rel ? cx + x2 : x2, ay2 = rel ? cy + y2 : y2;
        const ex = rel ? cx + x : x, ey = rel ? cy + y : y;
        segments.push({
          p0: { x: cx, y: cy },
          cp1: { x: ax1, y: ay1 },
          cp2: { x: ax2, y: ay2 },
          p1: { x: ex, y: ey },
        });
        cx = ex; cy = ey;
      }
    } else if (tok === 'L' || tok === 'l') {
      const rel = tok === 'l';
      i++;
      while (i + 1 < tokens.length && /^[-+.\d]/.test(tokens[i])) {
        const x = Number(tokens[i++]), y = Number(tokens[i++]);
        const ex = rel ? cx + x : x, ey = rel ? cy + y : y;
        segments.push({
          p0: { x: cx, y: cy },
          cp1: { x: cx, y: cy },
          cp2: { x: ex, y: ey },
          p1: { x: ex, y: ey },
        });
        cx = ex; cy = ey;
      }
    } else if (tok === 'Z' || tok === 'z') {
      i++;
    } else {
      i++;
    }
  }

  return segments;
}
