import { InferenceSession, Tensor } from 'onnxruntime-web';

const MODEL_SIZE = 1024;
let cachedSession = null;

export async function loadRMBGModel() {
  if (cachedSession) return cachedSession;
  cachedSession = await InferenceSession.create('/models/rmbg-1.4-quantized.onnx', {
    executionProviders: ['wasm'],
  });
  return cachedSession;
}

function preprocess(img) {
  const canvas = document.createElement('canvas');
  canvas.width = MODEL_SIZE;
  canvas.height = MODEL_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, MODEL_SIZE, MODEL_SIZE);
  const imageData = ctx.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE);

  const float32 = new Float32Array(3 * MODEL_SIZE * MODEL_SIZE);
  const pixels = imageData.data;

  for (let i = 0; i < MODEL_SIZE * MODEL_SIZE; i++) {
    float32[i] = pixels[i * 4] / 255.0 - 0.5;
    float32[MODEL_SIZE * MODEL_SIZE + i] = pixels[i * 4 + 1] / 255.0 - 0.5;
    float32[2 * MODEL_SIZE * MODEL_SIZE + i] = pixels[i * 4 + 2] / 255.0 - 0.5;
  }

  return {
    tensor: new Tensor('float32', float32, [1, 3, MODEL_SIZE, MODEL_SIZE]),
    origWidth: img.naturalWidth || img.width,
    origHeight: img.naturalHeight || img.height,
  };
}

export async function runRMBG(model, img) {
  const { tensor, origWidth, origHeight } = preprocess(img);

  const results = await model.run({ input: tensor });
  const outputName = model.outputNames[0];
  const output = results[outputName];
  const rawMask = output.data;

  let min = Infinity, max = -Infinity;
  for (let i = 0; i < rawMask.length; i++) {
    if (rawMask[i] < min) min = rawMask[i];
    if (rawMask[i] > max) max = rawMask[i];
  }
  const range = max - min || 1;
  const normalized = new Float32Array(rawMask.length);
  for (let i = 0; i < rawMask.length; i++) {
    normalized[i] = (rawMask[i] - min) / range;
  }

  const alpha = new Float32Array(origWidth * origHeight);
  const scaleX = MODEL_SIZE / origWidth;
  const scaleY = MODEL_SIZE / origHeight;

  for (let y = 0; y < origHeight; y++) {
    const sy = y * scaleY;
    const sy0 = Math.floor(sy);
    const sy1 = Math.min(sy0 + 1, MODEL_SIZE - 1);
    const fy = sy - sy0;

    for (let x = 0; x < origWidth; x++) {
      const sx = x * scaleX;
      const sx0 = Math.floor(sx);
      const sx1 = Math.min(sx0 + 1, MODEL_SIZE - 1);
      const fx = sx - sx0;

      const v00 = normalized[sy0 * MODEL_SIZE + sx0];
      const v10 = normalized[sy0 * MODEL_SIZE + sx1];
      const v01 = normalized[sy1 * MODEL_SIZE + sx0];
      const v11 = normalized[sy1 * MODEL_SIZE + sx1];

      alpha[y * origWidth + x] =
        v00 * (1 - fx) * (1 - fy) +
        v10 * fx * (1 - fy) +
        v01 * (1 - fx) * fy +
        v11 * fx * fy;
    }
  }

  return { alpha, width: origWidth, height: origHeight };
}

export function applyAlphaToImage(alpha, width, height, sourceImage) {
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = width;
  srcCanvas.height = height;
  const srcCtx = srcCanvas.getContext('2d');
  srcCtx.drawImage(sourceImage, 0, 0, width, height);
  const srcData = srcCtx.getImageData(0, 0, width, height);

  const cleaned = cleanMask(alpha, width, height);
  const smoothAlpha = buildSmoothAlpha(cleaned, width, height);

  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = smoothAlpha[y * width + x];
      srcData.data[(y * width + x) * 4 + 3] = a;
      if (a > 10) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX <= minX || maxY <= minY) return null;

  const pad = 5;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  srcCtx.putImageData(srcData, 0, 0);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = cropW;
  outCanvas.height = cropH;
  const outCtx = outCanvas.getContext('2d');
  outCtx.drawImage(srcCanvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

  return outCanvas.toDataURL('image/png');
}

export function alphaToOverlayURL(alpha, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(width, height);

  for (let i = 0; i < alpha.length; i++) {
    if (alpha[i] > 0.1) {
      imageData.data[i * 4] = 41;
      imageData.data[i * 4 + 1] = 98;
      imageData.data[i * 4 + 2] = 255;
      imageData.data[i * 4 + 3] = Math.round(alpha[i] * 100);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL();
}

function cleanMask(alpha, width, height) {
  const n = width * height;
  const binary = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    binary[i] = alpha[i] > 0.5 ? 1 : 0;
  }

  const labels = new Int32Array(n).fill(-1);
  const areas = [];
  let nextId = 0;

  for (let i = 0; i < n; i++) {
    if (binary[i] === 0 || labels[i] !== -1) continue;
    let area = 0;
    const queue = [i];
    labels[i] = nextId;
    while (queue.length > 0) {
      const ci = queue.pop();
      area++;
      const cx = ci % width;
      const cy = (ci - cx) / width;
      const neighbors = [
        cy > 0 ? ci - width : -1,
        cy < height - 1 ? ci + width : -1,
        cx > 0 ? ci - 1 : -1,
        cx < width - 1 ? ci + 1 : -1,
      ];
      for (const ni of neighbors) {
        if (ni >= 0 && binary[ni] === 1 && labels[ni] === -1) {
          labels[ni] = nextId;
          queue.push(ni);
        }
      }
    }
    areas.push(area);
    nextId++;
  }

  if (areas.length === 0) return new Float32Array(alpha);

  let largestId = 0;
  for (let i = 1; i < areas.length; i++) {
    if (areas[i] > areas[largestId]) largestId = i;
  }
  const kept = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    kept[i] = labels[i] === largestId ? 1 : 0;
  }

  // Fill holes via border flood-fill
  const exterior = new Uint8Array(n);
  const bq = [];
  for (let x = 0; x < width; x++) {
    if (!kept[x] && !exterior[x]) { exterior[x] = 1; bq.push(x); }
    const b = (height - 1) * width + x;
    if (!kept[b] && !exterior[b]) { exterior[b] = 1; bq.push(b); }
  }
  for (let y = 1; y < height - 1; y++) {
    const l = y * width;
    if (!kept[l] && !exterior[l]) { exterior[l] = 1; bq.push(l); }
    const r = y * width + width - 1;
    if (!kept[r] && !exterior[r]) { exterior[r] = 1; bq.push(r); }
  }
  while (bq.length > 0) {
    const ci = bq.pop();
    const cx = ci % width;
    const cy = (ci - cx) / width;
    const neighbors = [
      cy > 0 ? ci - width : -1,
      cy < height - 1 ? ci + width : -1,
      cx > 0 ? ci - 1 : -1,
      cx < width - 1 ? ci + 1 : -1,
    ];
    for (const ni of neighbors) {
      if (ni >= 0 && !kept[ni] && !exterior[ni]) {
        exterior[ni] = 1;
        bq.push(ni);
      }
    }
  }

  const result = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (kept[i]) {
      result[i] = alpha[i];
    } else if (!exterior[i]) {
      result[i] = 1.0; // hole — fill
    } else {
      result[i] = 0.0;
    }
  }
  return result;
}

function buildSmoothAlpha(mask, width, height) {
  const steepness = 6.0;
  const alpha = new Float32Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    const v = mask[i] * 2 - 1; // remap [0,1] to [-1,1] for sigmoid
    alpha[i] = 1 / (1 + Math.exp(-v * steepness));
  }

  const blurred = gaussianBlur(alpha, width, height, 2);

  const result = new Uint8ClampedArray(width * height);
  for (let i = 0; i < blurred.length; i++) {
    result[i] = Math.round(blurred[i] * 255);
  }
  return result;
}

function gaussianBlur(data, width, height, radius) {
  const kernel = makeGaussianKernel(radius);
  const kSize = kernel.length;
  const kHalf = Math.floor(kSize / 2);

  const temp = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = 0; k < kSize; k++) {
        const sx = Math.min(Math.max(x + k - kHalf, 0), width - 1);
        sum += data[y * width + sx] * kernel[k];
      }
      temp[y * width + x] = sum;
    }
  }

  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = 0; k < kSize; k++) {
        const sy = Math.min(Math.max(y + k - kHalf, 0), height - 1);
        sum += temp[sy * width + x] * kernel[k];
      }
      out[y * width + x] = sum;
    }
  }

  return out;
}

function makeGaussianKernel(radius) {
  const sigma = radius / 2;
  const size = radius * 2 + 1;
  const kernel = new Float32Array(size);
  let sum = 0;
  for (let i = 0; i < size; i++) {
    const x = i - radius;
    kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
    sum += kernel[i];
  }
  for (let i = 0; i < size; i++) kernel[i] /= sum;
  return kernel;
}
