import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { traceContour } from '../helpers/contourTracing.js';
import { loadRMBGModel, runRMBG, applyAlphaToImage } from '../helpers/rmbgModel.js';
import { useIsMobile } from '../hooks/useIsMobile.js';

const DEFAULT_SIZE_IN = 2;
const MAX_SIZE_IN = 5;
const RULER_HEIGHT = 24;

const CUT_TYPES = [
  { value: 'contour', label: 'Contour' },
  { value: 'circle', label: 'Circle' },
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded' },
];

function ToggleSwitch({ checked, onChange, disabled }) {
  return (
    <div
      onClick={disabled ? undefined : () => onChange(!checked)}
      style={{
        width: 44, height: 24, borderRadius: 12,
        backgroundColor: checked ? '#34c759' : '#d1d1d6',
        padding: 2, cursor: disabled ? 'default' : 'pointer',
        transition: 'background-color 0.2s',
        opacity: disabled ? 0.4 : 1, flexShrink: 0,
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        transition: 'transform 0.2s',
        transform: checked ? 'translateX(20px)' : 'translateX(0)',
      }} />
    </div>
  );
}

function unitToInches(value, unit) { return unit === 'cm' ? value / 2.54 : value; }
function inchesToUnit(inches, unit) { return unit === 'cm' ? inches * 2.54 : inches; }
function formatDim(v) { return Math.round(v * 100) / 100; }

function Ruler({ length, pxPerInch, unit, vertical }) {
  const maxVal = inchesToUnit(MAX_SIZE_IN, unit);
  const subStep = 0.5;
  const ticks = [];
  for (let v = 0; v <= maxVal + 0.001; v += subStep) {
    const pos = unitToInches(v, unit) * pxPerInch;
    if (pos > length) break;
    const isMajor = Math.abs(v - Math.round(v)) < 0.001;
    const h = isMajor ? RULER_HEIGHT : RULER_HEIGHT * 0.5;
    ticks.push(
      <line key={v}
        x1={vertical ? RULER_HEIGHT - h : pos} y1={vertical ? pos : RULER_HEIGHT - h}
        x2={vertical ? RULER_HEIGHT : pos} y2={vertical ? pos : RULER_HEIGHT}
        stroke="#b0b0b0" strokeWidth="1" />
    );
    if (isMajor && v > 0) {
      ticks.push(vertical
        ? <text key={`t${v}`} x={4} y={pos + 4} fill="#86868b" style={{ fontSize: 9, fontFamily: 'system-ui' }}>{v}</text>
        : <text key={`t${v}`} x={pos} y={10} fill="#86868b" textAnchor="middle" style={{ fontSize: 9, fontFamily: 'system-ui' }}>{v}</text>
      );
    }
  }
  return (
    <svg width={vertical ? RULER_HEIGHT : length} height={vertical ? length : RULER_HEIGHT}
      style={{ position: 'absolute', ...(vertical ? { left: 0, top: RULER_HEIGHT } : { top: 0, left: RULER_HEIGHT }), overflow: 'hidden' }}>
      <rect width="100%" height="100%" fill="#fafafa" />
      {ticks}
    </svg>
  );
}

function drawBezierPath(ctx, segments) {
  if (segments.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(segments[0].p0.x, segments[0].p0.y);
  for (const s of segments) {
    const isLine = s.cp1.x === s.p0.x && s.cp1.y === s.p0.y && s.cp2.x === s.p1.x && s.cp2.y === s.p1.y;
    if (isLine) ctx.lineTo(s.p1.x, s.p1.y);
    else ctx.bezierCurveTo(s.cp1.x, s.cp1.y, s.cp2.x, s.cp2.y, s.p1.x, s.p1.y);
  }
  ctx.closePath();
}

function drawCutShapePath(ctx, cutType, w, h) {
  const r = Math.min(w, h) * 0.15;
  if (cutType === 'circle') {
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.closePath();
  } else if (cutType === 'square') {
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.closePath();
  } else if (cutType === 'rounded') {
    ctx.beginPath();
    ctx.moveTo(r, 0); ctx.lineTo(w - r, 0); ctx.arcTo(w, 0, w, r, r);
    ctx.lineTo(w, h - r); ctx.arcTo(w, h, w - r, h, r);
    ctx.lineTo(r, h); ctx.arcTo(0, h, 0, h - r, r);
    ctx.lineTo(0, r); ctx.arcTo(0, 0, r, 0, r);
    ctx.closePath();
  }
}

function getPointer(e) {
  if (e.touches) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}

function useDraggable(initialPos, initialSizeIn, pxPerInch, aspectRatio, onPosChange, onSizeChange, onDragStart, onDragEnd) {
  const draggingRef = useRef(false);

  const handleMoveStart = useCallback((e) => {
    if (draggingRef.current) return;
    e.preventDefault();
    draggingRef.current = 'move';
    onDragStart();
    const start = getPointer(e);
    const startPos = { ...initialPos };
    const isTouch = !!e.touches;
    function onMove(e) {
      if (draggingRef.current !== 'move') return;
      const p = getPointer(e);
      onPosChange({ x: startPos.x + (p.x - start.x), y: startPos.y + (p.y - start.y) });
    }
    function onUp() {
      draggingRef.current = false;
      window.removeEventListener(isTouch ? 'touchmove' : 'mousemove', onMove);
      window.removeEventListener(isTouch ? 'touchend' : 'mouseup', onUp);
      onDragEnd();
    }
    window.addEventListener(isTouch ? 'touchmove' : 'mousemove', onMove, { passive: false });
    window.addEventListener(isTouch ? 'touchend' : 'mouseup', onUp);
  }, [initialPos, onPosChange, onDragStart, onDragEnd]);

  const handleResizeStart = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    draggingRef.current = 'resize';
    onDragStart();
    const start = getPointer(e);
    const startW = initialSizeIn;
    const isTouch = !!e.touches;
    function onMove(e) {
      if (draggingRef.current !== 'resize') return;
      const p = getPointer(e);
      const dx = p.x - start.x, dy = p.y - start.y;
      const delta = (Math.abs(dx) > Math.abs(dy) ? dx : dy) / pxPerInch;
      let newW = Math.max(0.25, Math.min(MAX_SIZE_IN, startW + delta));
      if (aspectRatio && newW / aspectRatio > MAX_SIZE_IN) newW = MAX_SIZE_IN * aspectRatio;
      onSizeChange(newW);
    }
    function onUp() {
      draggingRef.current = false;
      window.removeEventListener(isTouch ? 'touchmove' : 'mousemove', onMove);
      window.removeEventListener(isTouch ? 'touchend' : 'mouseup', onUp);
      onDragEnd();
    }
    window.addEventListener(isTouch ? 'touchmove' : 'mousemove', onMove, { passive: false });
    window.addEventListener(isTouch ? 'touchend' : 'mouseup', onUp);
  }, [initialSizeIn, pxPerInch, aspectRatio, onSizeChange, onDragStart, onDragEnd]);

  return { handleMoveStart, handleResizeStart };
}

function useContourTracing(compositeUrl, outlineEnabled, outlineOffsetPx, isDragging, targetW, targetH) {
  const [traceResult, setTraceResult] = useState(null);
  const [tracing, setTracing] = useState(false);
  useEffect(() => {
    if (isDragging) return;
    if (!outlineEnabled || !compositeUrl || !targetW || !targetH) { setTraceResult(null); return; }
    let cancelled = false;
    setTracing(true);
    traceContour(compositeUrl, outlineOffsetPx, Math.round(targetW), Math.round(targetH)).then((result) => {
      if (!cancelled) { setTraceResult(result); setTracing(false); }
    }).catch(() => { if (!cancelled) { setTraceResult(null); setTracing(false); } });
    return () => { cancelled = true; };
  }, [compositeUrl, outlineEnabled, outlineOffsetPx, isDragging, targetW, targetH]);
  return { traceResult, tracing };
}

function useImageElement(imageUrl) {
  const [img, setImg] = useState(null);
  useEffect(() => {
    if (!imageUrl) return;
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => setImg(el);
    el.src = imageUrl;
  }, [imageUrl]);
  return img;
}

function DraggableObject({ pos, widthPx, heightPx, onMoveStart, onResizeStart, selected, children }) {
  return (
    <div
      onMouseDown={onMoveStart}
      onTouchStart={onMoveStart}
      style={{
        position: 'absolute', left: pos.x, top: pos.y,
        width: widthPx, height: heightPx, cursor: 'grab',
        outline: selected ? '2px dashed #007aff' : 'none',
        outlineOffset: 2, touchAction: 'none',
      }}
    >
      {children}
      <div onMouseDown={onResizeStart} onTouchStart={onResizeStart} style={styles.dragHandle} />
    </div>
  );
}

function buildCompositeDataUrl(img, cutType, cutBgColor, shapeWidthPx, shapeHeightPx, stickerOffsetX, stickerOffsetY) {
  const minX = Math.min(0, stickerOffsetX);
  const minY = Math.min(0, stickerOffsetY);
  const maxX = Math.max(shapeWidthPx, stickerOffsetX + img.width);
  const maxY = Math.max(shapeHeightPx, stickerOffsetY + img.height);
  const totalW = Math.round(maxX - minX);
  const totalH = Math.round(maxY - minY);

  const canvas = document.createElement('canvas');
  canvas.width = totalW;
  canvas.height = totalH;
  const ctx = canvas.getContext('2d');

  if (cutType !== 'contour') {
    ctx.save();
    ctx.translate(-minX, -minY);
    drawCutShapePath(ctx, cutType, shapeWidthPx, shapeHeightPx);
    ctx.fillStyle = cutBgColor;
    ctx.fill();
    ctx.restore();
  }

  ctx.drawImage(img, stickerOffsetX - minX, stickerOffsetY - minY);
  return { dataUrl: canvas.toDataURL('image/png'), minX, minY, totalW, totalH };
}

function renderFinal(img, cutType, cutBgColor, shapeWidthPx, shapeHeightPx, stickerOffsetX, stickerOffsetY, outlineEnabled, outlineColor, outlineThicknessPx, traceResult) {
  const minX = Math.min(0, stickerOffsetX);
  const minY = Math.min(0, stickerOffsetY);
  const maxX = Math.max(shapeWidthPx, stickerOffsetX + img.width);
  const maxY = Math.max(shapeHeightPx, stickerOffsetY + img.height);
  const compW = Math.round(maxX - minX);
  const compH = Math.round(maxY - minY);
  const pad = outlineEnabled && traceResult ? outlineThicknessPx + 2 : 0;

  const canvas = document.createElement('canvas');
  canvas.width = compW + pad * 2;
  canvas.height = compH + pad * 2;
  const ctx = canvas.getContext('2d');

  if (outlineEnabled && traceResult && traceResult.segments.length > 0) {
    ctx.save(); ctx.translate(pad, pad);
    drawBezierPath(ctx, traceResult.segments);
    ctx.fillStyle = outlineColor; ctx.fill(); ctx.restore();
  }

  if (cutType !== 'contour') {
    ctx.save();
    ctx.translate(pad - minX, pad - minY);
    drawCutShapePath(ctx, cutType, shapeWidthPx, shapeHeightPx);
    ctx.fillStyle = cutBgColor;
    ctx.fill();
    ctx.restore();
  }

  ctx.drawImage(img, pad + stickerOffsetX - minX, pad + stickerOffsetY - minY);
  return canvas.toDataURL('image/png');
}

export default function EditModal({ sticker, onSave, onCancel }) {
  const isMobile = useIsMobile();
  const prev = sticker.settings || {};
  const [outlineEnabled, setOutlineEnabled] = useState(prev.outlineEnabled || false);
  const [outlineColor, setOutlineColor] = useState(prev.outlineColor || '#ffffff');
  const [outlineThickness, setOutlineThickness] = useState(prev.outlineThickness ?? 0.04);
  const [unit, setUnit] = useState(prev.unit || 'in');
  const [stickerWidthIn, setStickerWidthIn] = useState(prev.stickerWidthIn ?? null);
  const [bgRemovalEnabled, setBgRemovalEnabled] = useState(prev.bgRemovalEnabled || false);
  const [bgRemovedUrl, setBgRemovedUrl] = useState(prev.bgRemovedUrl || null);
  const [bgRemovalRunning, setBgRemovalRunning] = useState(false);
  const [bgRemovalProgress, setBgRemovalProgress] = useState('');
  const [cutType, setCutType] = useState(prev.cutType || 'contour');
  const [cutBgColor, setCutBgColor] = useState(prev.cutBgColor || '#ffffff');
  const [shapeWidthIn, setShapeWidthIn] = useState(prev.shapeWidthIn ?? null);

  const [stickerPos, setStickerPos] = useState({ x: 40, y: 40 });
  const [shapePos, setShapePos] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const dragCountRef = useRef(0);

  const onDragStart = useCallback(() => { dragCountRef.current++; setIsDragging(true); }, []);
  const onDragEnd = useCallback(() => { dragCountRef.current--; if (dragCountRef.current <= 0) { dragCountRef.current = 0; setIsDragging(false); } }, []);

  const workspaceRef = useRef(null);

  const activeImageUrl = bgRemovalEnabled && bgRemovedUrl ? bgRemovedUrl : sticker.imageUrl;
  const img = useImageElement(activeImageUrl);
  const imageDims = img ? { width: img.width, height: img.height } : null;
  const stickerAspect = imageDims ? imageDims.width / imageDims.height : 1;

  useEffect(() => {
    if (!imageDims || stickerWidthIn !== null) return;
    const longer = Math.max(imageDims.width, imageDims.height);
    const wIn = DEFAULT_SIZE_IN * imageDims.width / longer;
    setStickerWidthIn(wIn);
    setShapeWidthIn(wIn * 1.2);
  }, [imageDims]);

  const stickerHeightIn = stickerWidthIn !== null ? stickerWidthIn / stickerAspect : null;
  const shapeHeightIn = shapeWidthIn !== null ? shapeWidthIn : null; // shapes are 1:1 for circle/square, free for rounded
  const shapeAspect = cutType === 'rounded' ? stickerAspect : 1;
  const shapeHIn = shapeWidthIn !== null ? shapeWidthIn / shapeAspect : null;

  const [workspaceSize, setWorkspaceSize] = useState({ w: 400, h: 400 });
  useEffect(() => {
    const el = workspaceRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWorkspaceSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pxPerInch = Math.min(workspaceSize.w, workspaceSize.h) / MAX_SIZE_IN;
  const effectiveDpi = imageDims && stickerWidthIn ? imageDims.width / stickerWidthIn : 300;
  const outlineThicknessPx = Math.max(1, Math.round(unitToInches(outlineThickness, unit) * effectiveDpi));
  const outlineCanvasPx = Math.max(1, Math.round(unitToInches(outlineThickness, unit) * pxPerInch));

  const stickerPxW = stickerWidthIn ? stickerWidthIn * pxPerInch : 0;
  const stickerPxH = stickerHeightIn ? stickerHeightIn * pxPerInch : 0;
  const shapePxW = shapeWidthIn ? shapeWidthIn * pxPerInch : 0;
  const shapePxH = shapeHIn ? shapeHIn * pxPerInch : 0;

  const shapeWidthImgPx = shapeWidthIn ? Math.round(shapeWidthIn * effectiveDpi) : 0;
  const shapeHeightImgPx = shapeHIn ? Math.round(shapeHIn * effectiveDpi) : 0;
  const stickerOffsetXImgPx = imageDims ? Math.round((stickerPos.x - shapePos.x) / pxPerInch * effectiveDpi) : 0;
  const stickerOffsetYImgPx = imageDims ? Math.round((stickerPos.y - shapePos.y) / pxPerInch * effectiveDpi) : 0;

  const composite = useMemo(() => {
    if (!img || cutType === 'contour') return null;
    return buildCompositeDataUrl(img, cutType, cutBgColor, shapeWidthImgPx, shapeHeightImgPx, stickerOffsetXImgPx, stickerOffsetYImgPx);
  }, [img, cutType, cutBgColor, shapeWidthImgPx, shapeHeightImgPx, stickerOffsetXImgPx, stickerOffsetYImgPx]);

  const traceUrl = cutType === 'contour' ? activeImageUrl : composite?.dataUrl;
  const traceTargetW = cutType === 'contour' ? stickerPxW : (composite ? composite.totalW * pxPerInch / effectiveDpi : 0);
  const traceTargetH = cutType === 'contour' ? stickerPxH : (composite ? composite.totalH * pxPerInch / effectiveDpi : 0);
  const { traceResult, tracing } = useContourTracing(traceUrl, outlineEnabled, outlineCanvasPx, isDragging, traceTargetW, traceTargetH);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', handleKey); document.body.style.overflow = ''; };
  }, [onCancel]);

  const stickerDrag = useDraggable(stickerPos, stickerWidthIn, pxPerInch, stickerAspect, setStickerPos, setStickerWidthIn, onDragStart, onDragEnd);
  const shapeDrag = useDraggable(shapePos, shapeWidthIn, pxPerInch, shapeAspect, setShapePos, setShapeWidthIn, onDragStart, onDragEnd);

  const handleBgRemoval = useCallback(async () => {
    if (bgRemovedUrl) {
      setBgRemovalEnabled(true);
      return;
    }
    setBgRemovalRunning(true);
    setBgRemovalProgress('Loading model (~40 MB)...');
    try {
      const model = await loadRMBGModel();
      setBgRemovalProgress('Running inference...');
      const origImg = new Image();
      origImg.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        origImg.onload = resolve;
        origImg.onerror = reject;
        origImg.src = sticker.imageUrl;
      });
      const { alpha, width, height } = await runRMBG(model, origImg);
      setBgRemovalProgress('Applying mask...');
      const resultUrl = applyAlphaToImage(alpha, width, height, origImg);
      if (resultUrl) {
        setBgRemovedUrl(resultUrl);
        setBgRemovalEnabled(true);
      }
    } catch (err) {
      console.error('Background removal failed:', err);
      setBgRemovalProgress('Failed: ' + err.message);
      setTimeout(() => setBgRemovalProgress(''), 3000);
    } finally {
      setBgRemovalRunning(false);
      setBgRemovalProgress('');
    }
  }, [sticker.imageUrl, bgRemovedUrl]);

  const handleBgRemovalToggle = useCallback((checked) => {
    if (checked && !bgRemovedUrl) {
      handleBgRemoval();
    } else {
      setBgRemovalEnabled(checked);
    }
  }, [bgRemovedUrl, handleBgRemoval]);

  const handleWidthChange = (val) => {
    const wIn = Math.max(0.25, Math.min(MAX_SIZE_IN, unitToInches(parseFloat(val) || 0.25, unit)));
    setStickerWidthIn(wIn / stickerAspect > MAX_SIZE_IN ? MAX_SIZE_IN * stickerAspect : wIn);
  };
  const handleHeightChange = (val) => {
    const hIn = Math.max(0.25, Math.min(MAX_SIZE_IN, unitToInches(parseFloat(val) || 0.25, unit)));
    setStickerWidthIn(hIn * stickerAspect > MAX_SIZE_IN ? MAX_SIZE_IN : hIn * stickerAspect);
  };

  function scaleSegments(segments, scale) {
    return segments.map(s => ({
      p0: { x: s.p0.x * scale, y: s.p0.y * scale },
      cp1: { x: s.cp1.x * scale, y: s.cp1.y * scale },
      cp2: { x: s.cp2.x * scale, y: s.cp2.y * scale },
      p1: { x: s.p1.x * scale, y: s.p1.y * scale },
    }));
  }

  const handleSave = useCallback(() => {
    const displayW = formatDim(inchesToUnit(stickerWidthIn, unit));
    const displayH = formatDim(inchesToUnit(stickerHeightIn, unit));
    const settings = {
      outlineEnabled, outlineColor, outlineThickness, outlineThicknessPx,
      unit, stickerWidth: displayW, stickerHeight: displayH,
      stickerWidthIn, stickerHeightIn, bgRemovalEnabled, bgRemovedUrl,
      cutType, cutBgColor, shapeWidthIn,
    };
    if (!img) { onSave(sticker, settings); return; }

    const nativeScale = effectiveDpi / pxPerInch;
    let processedUrl;
    if (cutType === 'contour') {
      if (outlineEnabled && traceResult && traceResult.segments.length > 0) {
        const nativeSegments = scaleSegments(traceResult.segments, nativeScale);
        const pad = outlineThicknessPx + 2;
        const c = document.createElement('canvas');
        c.width = img.width + pad * 2; c.height = img.height + pad * 2;
        const ctx = c.getContext('2d');
        ctx.save(); ctx.translate(pad, pad);
        drawBezierPath(ctx, nativeSegments);
        ctx.fillStyle = outlineColor; ctx.fill(); ctx.restore();
        ctx.drawImage(img, pad, pad);
        processedUrl = c.toDataURL('image/png');
      } else {
        processedUrl = activeImageUrl;
      }
    } else {
      const nativeTrace = outlineEnabled && traceResult && traceResult.segments.length > 0
        ? { segments: scaleSegments(traceResult.segments, nativeScale), svgPath: '' }
        : null;
      processedUrl = renderFinal(img, cutType, cutBgColor, shapeWidthImgPx, shapeHeightImgPx, stickerOffsetXImgPx, stickerOffsetYImgPx, outlineEnabled, outlineColor, outlineThicknessPx, nativeTrace);
    }
    onSave(sticker, { ...settings, processedImageUrl: processedUrl });
  }, [sticker, onSave, img, outlineEnabled, outlineColor, outlineThickness, outlineThicknessPx, effectiveDpi, pxPerInch, unit, stickerWidthIn, stickerHeightIn, bgRemovalEnabled, bgRemovedUrl, activeImageUrl, cutType, cutBgColor, shapeWidthIn, shapeWidthImgPx, shapeHeightImgPx, stickerOffsetXImgPx, stickerOffsetYImgPx, traceResult]);

  const unitLabel = unit === 'cm' ? 'cm' : '"';
  const thicknessStep = unit === 'cm' ? 0.05 : 0.02;
  const thicknessMax = unit === 'cm' ? 1.5 : 0.5;
  const displayW = stickerWidthIn !== null ? formatDim(inchesToUnit(stickerWidthIn, unit)) : '';
  const displayH = stickerHeightIn !== null ? formatDim(inchesToUnit(stickerHeightIn, unit)) : '';
  const showCutOptions = cutType !== 'contour';

  const objectsOverlap = cutType === 'contour' || (
    stickerPos.x < shapePos.x + shapePxW && stickerPos.x + stickerPxW > shapePos.x &&
    stickerPos.y < shapePos.y + shapePxH && stickerPos.y + stickerPxH > shapePos.y
  );
  const outlineError = outlineEnabled && !objectsOverlap;

  if (isMobile) {
    return (
      <div style={styles.backdrop} onClick={onCancel}>
        <div style={styles.mobileModal} onClick={(e) => e.stopPropagation()}>
          <div style={styles.mobileHeader}>
            <button onClick={onCancel} style={styles.mobileHeaderBtn}>Cancel</button>
            <h2 style={styles.mobileHeaderTitle}>Edit Sticker</h2>
            <button onClick={handleSave} style={styles.mobileHeaderSave}>Save</button>
          </div>

          <div style={styles.mobileWorkspaceWrap}>
            <div ref={workspaceRef} style={styles.mobileWorkspace}>
              {outlineEnabled && !outlineError && traceResult && traceResult.segments.length > 0 && (() => {
                const pad = outlineCanvasPx + 2;
                const baseX = cutType === 'contour' ? stickerPos.x : Math.min(stickerPos.x, shapePos.x);
                const baseY = cutType === 'contour' ? stickerPos.y : Math.min(stickerPos.y, shapePos.y);
                const contentW = cutType === 'contour' ? stickerPxW : traceTargetW;
                const contentH = cutType === 'contour' ? stickerPxH : traceTargetH;
                const svgW = contentW + pad * 2;
                const svgH = contentH + pad * 2;
                return (
                  <svg
                    style={{ position: 'absolute', pointerEvents: 'none', left: baseX - pad, top: baseY - pad }}
                    width={svgW} height={svgH}
                    viewBox={`0 0 ${svgW} ${svgH}`}
                  >
                    <g transform={`translate(${pad},${pad})`}>
                      <path d={traceResult.svgPath} fill={outlineColor} />
                    </g>
                  </svg>
                );
              })()}

              {showCutOptions && shapeWidthIn !== null && (
                <DraggableObject pos={shapePos} widthPx={shapePxW} heightPx={shapePxH}
                  onMoveStart={shapeDrag.handleMoveStart} onResizeStart={shapeDrag.handleResizeStart} selected={false}>
                  <svg width="100%" height="100%" viewBox={`0 0 ${shapePxW} ${shapePxH}`} style={{ position: 'absolute', top: 0, left: 0 }}>
                    {cutType === 'circle' && <ellipse cx={shapePxW / 2} cy={shapePxH / 2} rx={shapePxW / 2} ry={shapePxH / 2} fill={cutBgColor} />}
                    {cutType === 'square' && <rect width={shapePxW} height={shapePxH} fill={cutBgColor} />}
                    {cutType === 'rounded' && <rect width={shapePxW} height={shapePxH} rx={Math.min(shapePxW, shapePxH) * 0.15} fill={cutBgColor} />}
                  </svg>
                </DraggableObject>
              )}

              {stickerWidthIn !== null && img && (
                <DraggableObject pos={stickerPos} widthPx={stickerPxW} heightPx={stickerPxH}
                  onMoveStart={stickerDrag.handleMoveStart} onResizeStart={stickerDrag.handleResizeStart} selected={false}>
                  <img src={activeImageUrl} alt="Sticker" style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
                </DraggableObject>
              )}

              {tracing && <div style={styles.tracingOverlay}>Processing...</div>}
              {outlineError && <div style={styles.errorOverlay}>Sticker and shape must overlap</div>}
            </div>
          </div>

          <div style={styles.mobileControls}>
            <div style={styles.mobileControlRow}>
              <div style={styles.mobileControlLabel}>
                <span style={styles.mobileControlIcon}>✂️</span>
                <span>Remove Background</span>
              </div>
              <ToggleSwitch checked={bgRemovalEnabled} onChange={handleBgRemovalToggle} disabled={bgRemovalRunning} />
            </div>
            {bgRemovalRunning && (
              <p style={styles.mobileHint}>{bgRemovalProgress}</p>
            )}

            <div style={styles.mobileDivider} />

            <div style={styles.mobileControlRow}>
              <div style={styles.mobileControlLabel}>
                <span style={styles.mobileControlIcon}>◯</span>
                <span>Outline</span>
              </div>
              <ToggleSwitch checked={outlineEnabled} onChange={setOutlineEnabled} />
            </div>
            {outlineEnabled && (
              <div style={styles.mobileOutlineOptions}>
                <div style={styles.mobileColorRow}>
                  <span style={styles.mobileSubLabel}>Color</span>
                  <input type="color" value={outlineColor} onChange={(e) => setOutlineColor(e.target.value)} style={styles.mobileColorInput} />
                </div>
                <div style={styles.mobileColorRow}>
                  <span style={styles.mobileSubLabel}>Thickness</span>
                  <input type="range" min={thicknessStep} max={thicknessMax} step={thicknessStep}
                    value={outlineThickness} onChange={(e) => setOutlineThickness(parseFloat(e.target.value) || 0)}
                    style={styles.mobileRange} />
                </div>
              </div>
            )}

            <div style={styles.mobileDivider} />

            <div style={{ marginBottom: '0.4rem' }}>
              <div style={styles.mobileControlLabel}>
                <span style={styles.mobileControlIcon}>⬡</span>
                <span>Cut Shape</span>
              </div>
            </div>
            <div style={styles.mobileChipRow}>
              {CUT_TYPES.map((t) => (
                <button key={t.value} onClick={() => setCutType(t.value)}
                  style={cutType === t.value ? { ...styles.mobileChip, ...styles.mobileChipActive } : styles.mobileChip}
                >{t.label}</button>
              ))}
            </div>
            {showCutOptions && (
              <div style={styles.mobileColorRow}>
                <span style={styles.mobileSubLabel}>Background</span>
                <input type="color" value={cutBgColor} onChange={(e) => setCutBgColor(e.target.value)} style={styles.mobileColorInput} />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.backdrop} onClick={onCancel}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.headerTitle}>Edit Sticker</h2>
          <button onClick={onCancel} style={styles.closeBtn}>&times;</button>
        </div>

        <div style={styles.body}>
          <div style={styles.previewSection}>
            <div style={styles.rulerContainer}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: RULER_HEIGHT, height: RULER_HEIGHT, background: '#fafafa' }} />
              <Ruler length={workspaceSize.w} pxPerInch={pxPerInch} unit={unit} />
              <Ruler length={workspaceSize.h} pxPerInch={pxPerInch} unit={unit} vertical />
              <div ref={workspaceRef} style={styles.workspace}>
                {outlineEnabled && !outlineError && traceResult && traceResult.segments.length > 0 && (() => {
                  const pad = outlineCanvasPx + 2;
                  const baseX = cutType === 'contour' ? stickerPos.x : Math.min(stickerPos.x, shapePos.x);
                  const baseY = cutType === 'contour' ? stickerPos.y : Math.min(stickerPos.y, shapePos.y);
                  const contentW = cutType === 'contour' ? stickerPxW : traceTargetW;
                  const contentH = cutType === 'contour' ? stickerPxH : traceTargetH;
                  const svgW = contentW + pad * 2;
                  const svgH = contentH + pad * 2;
                  return (
                    <svg
                      style={{ position: 'absolute', pointerEvents: 'none', left: baseX - pad, top: baseY - pad }}
                      width={svgW} height={svgH}
                      viewBox={`0 0 ${svgW} ${svgH}`}
                    >
                      <g transform={`translate(${pad},${pad})`}>
                        <path d={traceResult.svgPath} fill={outlineColor} />
                      </g>
                    </svg>
                  );
                })()}

                {showCutOptions && shapeWidthIn !== null && (
                  <DraggableObject pos={shapePos} widthPx={shapePxW} heightPx={shapePxH}
                    onMoveStart={shapeDrag.handleMoveStart} onResizeStart={shapeDrag.handleResizeStart} selected={false}>
                    <svg width="100%" height="100%" viewBox={`0 0 ${shapePxW} ${shapePxH}`} style={{ position: 'absolute', top: 0, left: 0 }}>
                      {cutType === 'circle' && <ellipse cx={shapePxW / 2} cy={shapePxH / 2} rx={shapePxW / 2} ry={shapePxH / 2} fill={cutBgColor} />}
                      {cutType === 'square' && <rect width={shapePxW} height={shapePxH} fill={cutBgColor} />}
                      {cutType === 'rounded' && <rect width={shapePxW} height={shapePxH} rx={Math.min(shapePxW, shapePxH) * 0.15} fill={cutBgColor} />}
                    </svg>
                  </DraggableObject>
                )}

                {stickerWidthIn !== null && img && (
                  <DraggableObject pos={stickerPos} widthPx={stickerPxW} heightPx={stickerPxH}
                    onMoveStart={stickerDrag.handleMoveStart} onResizeStart={stickerDrag.handleResizeStart} selected={false}>
                    <img src={activeImageUrl} alt="Sticker" style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
                  </DraggableObject>
                )}

                {tracing && <div style={styles.tracingOverlay}>Tracing...</div>}
                {outlineError && <div style={styles.errorOverlay}>Sticker and shape must overlap to enable outline</div>}
              </div>
            </div>
          </div>

          <div style={styles.controlsSection}>
            <div style={styles.controlGroup}>
              <h3 style={styles.groupTitle}>Size</h3>
              <div style={styles.controlRow}>
                <span style={styles.label}>Unit</span>
                <div style={styles.chipRow}>
                  {['in', 'cm'].map((u) => (
                    <button key={u} onClick={() => setUnit(u)}
                      style={unit === u ? { ...styles.chip, ...styles.chipActive } : styles.chip}
                    >{u === 'in' ? 'Inches' : 'cm'}</button>
                  ))}
                </div>
              </div>
              <div style={styles.controlRow}>
                <span style={styles.label}>Width</span>
                <input type="number" min={0.25} step={0.1} max={formatDim(inchesToUnit(MAX_SIZE_IN, unit))}
                  value={displayW} onChange={(e) => handleWidthChange(e.target.value)} style={styles.numberInput} />
                <span style={styles.valueLabel}>{unitLabel}</span>
              </div>
              <div style={styles.controlRow}>
                <span style={styles.label}>Height</span>
                <input type="number" min={0.25} step={0.1} max={formatDim(inchesToUnit(MAX_SIZE_IN, unit))}
                  value={displayH} onChange={(e) => handleHeightChange(e.target.value)} style={styles.numberInput} />
                <span style={styles.valueLabel}>{unitLabel}</span>
              </div>
              {imageDims && (
                <p style={styles.hint}>{imageDims.width} &times; {imageDims.height} px ({Math.round(effectiveDpi)} DPI)</p>
              )}
            </div>

            <div style={styles.controlGroup}>
              <h3 style={styles.groupTitle}>Cut Shape</h3>
              <div style={styles.chipRow}>
                {CUT_TYPES.map((t) => (
                  <button key={t.value} onClick={() => setCutType(t.value)}
                    style={cutType === t.value ? { ...styles.chip, ...styles.chipActive } : styles.chip}
                  >{t.label}</button>
                ))}
              </div>
              {showCutOptions && (
                <>
                  <div style={{ ...styles.controlRow, marginTop: '0.5rem' }}>
                    <span style={styles.label}>Background</span>
                    <input type="color" value={cutBgColor} onChange={(e) => setCutBgColor(e.target.value)} style={styles.colorInput} />
                  </div>
                  <div style={styles.controlRow}>
                    <span style={styles.label}>Shape size</span>
                    <input type="number" min={0.25} step={0.1} max={formatDim(inchesToUnit(MAX_SIZE_IN, unit))}
                      value={shapeWidthIn !== null ? formatDim(inchesToUnit(shapeWidthIn, unit)) : ''}
                      onChange={(e) => {
                        const v = Math.max(0.25, Math.min(MAX_SIZE_IN, unitToInches(parseFloat(e.target.value) || 0.25, unit)));
                        setShapeWidthIn(v);
                      }}
                      style={styles.numberInput} />
                    <span style={styles.valueLabel}>{unitLabel}</span>
                  </div>
                </>
              )}
            </div>

            <div style={styles.controlGroup}>
              <h3 style={styles.groupTitle}>Outline / Border</h3>
              <div style={styles.controlRow}>
                <span style={styles.label}>Enable outline</span>
                <ToggleSwitch checked={outlineEnabled} onChange={setOutlineEnabled} />
              </div>
              <div style={{ ...styles.controlRow, opacity: outlineEnabled ? 1 : 0.4 }}>
                <span style={styles.label}>Color</span>
                <input type="color" value={outlineColor} onChange={(e) => setOutlineColor(e.target.value)}
                  disabled={!outlineEnabled} style={styles.colorInput} />
              </div>
              <div style={{ ...styles.controlRow, opacity: outlineEnabled ? 1 : 0.4 }}>
                <span style={styles.label}>Thickness</span>
                <input type="number" min={thicknessStep} max={thicknessMax} step={thicknessStep}
                  value={outlineThickness} onChange={(e) => setOutlineThickness(parseFloat(e.target.value) || 0)}
                  disabled={!outlineEnabled} style={styles.numberInput} />
                <span style={styles.valueLabel}>{unitLabel}</span>
              </div>
            </div>

            <div style={styles.controlGroup}>
              <h3 style={styles.groupTitle}>Background Removal</h3>
              <div style={styles.controlRow}>
                <span style={styles.label}>Remove background</span>
                <ToggleSwitch checked={bgRemovalEnabled} onChange={handleBgRemovalToggle} disabled={bgRemovalRunning} />
              </div>
              {bgRemovalRunning && (
                <p style={styles.hint}>{bgRemovalProgress}</p>
              )}
              {bgRemovedUrl && !bgRemovalRunning && (
                <p style={styles.hint}>Background removed{bgRemovalEnabled ? '' : ' (disabled)'}</p>
              )}
            </div>
          </div>
        </div>

        <div style={styles.footer}>
          <button onClick={onCancel} style={styles.cancelBtn}>Cancel</button>
          <button onClick={handleSave} style={styles.saveBtn}>Save</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  mobileModal: {
    position: 'fixed', inset: 0, background: 'var(--bg)',
    display: 'flex', flexDirection: 'column', zIndex: 1001,
  },
  mobileHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-light)',
    background: 'var(--bg-card)', flexShrink: 0,
  },
  mobileHeaderTitle: {
    fontSize: '1rem', fontWeight: 600, margin: 0,
  },
  mobileHeaderBtn: {
    background: 'none', border: 'none', fontSize: '0.95rem',
    color: 'var(--text-muted)', cursor: 'pointer', padding: '0.4rem 0.5rem',
  },
  mobileHeaderSave: {
    background: 'none', border: 'none', fontSize: '0.95rem',
    fontWeight: 600, color: 'var(--brand-purple)', cursor: 'pointer', padding: '0.4rem 0.5rem',
  },
  mobileWorkspaceWrap: {
    flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden',
  },
  mobileWorkspace: {
    position: 'absolute', inset: 0, overflow: 'hidden',
    background: 'repeating-conic-gradient(#e8e8e8 0% 25%, #fff 0% 50%) 0 0 / 16px 16px',
  },
  mobileControls: {
    flexShrink: 0, background: 'var(--bg-card)',
    borderTop: '1px solid var(--border-light)', padding: '0.75rem 1.25rem',
    paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
    maxHeight: '45vh', overflowY: 'auto',
  },
  mobileControlRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.6rem 0',
  },
  mobileControlLabel: {
    display: 'flex', alignItems: 'center', gap: '0.6rem',
    fontSize: '0.95rem', fontWeight: 500,
  },
  mobileControlIcon: {
    fontSize: '1.1rem', width: 24, textAlign: 'center',
  },
  mobileDivider: {
    height: 1, background: 'var(--border-light)', margin: '0.25rem 0',
  },
  mobileOutlineOptions: {
    padding: '0.25rem 0 0.25rem 2.1rem',
    display: 'flex', flexDirection: 'column', gap: '0.6rem',
  },
  mobileColorRow: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
  },
  mobileSubLabel: {
    fontSize: '0.85rem', color: 'var(--text-muted)', minWidth: 64,
  },
  mobileColorInput: {
    width: 36, height: 36, border: 'none', borderRadius: 8,
    cursor: 'pointer', padding: 0,
  },
  mobileRange: {
    flex: 1, accentColor: 'var(--brand-purple)',
  },
  mobileChipRow: {
    display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem',
  },
  mobileChip: {
    padding: '0.4rem 0.75rem', borderRadius: 8, fontSize: '0.8rem',
    fontWeight: 500, cursor: 'pointer', border: '1.5px solid var(--border)',
    background: 'var(--bg-card)', color: 'var(--text)',
  },
  mobileChipActive: {
    borderColor: 'var(--brand-purple)', background: 'rgba(124,58,237,0.06)',
    color: 'var(--brand-purple)',
  },
  mobileHint: {
    fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic',
    padding: '0 0 0.25rem 2.1rem',
  },
  modal: {
    background: '#fff', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
    maxWidth: 1200, width: '92vw', height: '90vh',
    overflow: 'hidden', display: 'flex', flexDirection: 'column',
  },
  header: {
    padding: '1.25rem 1.5rem', borderBottom: '1px solid #f0f0f0',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { fontSize: '1.15rem', fontWeight: 600, margin: 0 },
  closeBtn: {
    background: 'none', border: 'none', fontSize: '1.5rem',
    color: '#86868b', cursor: 'pointer', padding: '0 0.25rem', lineHeight: 1,
  },
  body: {
    padding: '1.5rem', display: 'flex', gap: '1.5rem',
    flex: 1, overflow: 'hidden', minHeight: 0,
  },
  previewSection: { flex: 3, display: 'flex', minWidth: 0, minHeight: 0 },
  rulerContainer: {
    position: 'relative', width: '100%', height: '100%',
    border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden',
  },
  workspace: {
    position: 'absolute', top: RULER_HEIGHT, left: RULER_HEIGHT,
    right: 0, bottom: 0, overflow: 'hidden',
    background: 'repeating-conic-gradient(#e8e8e8 0% 25%, #fff 0% 50%) 0 0 / 20px 20px',
  },
  dragHandle: {
    position: 'absolute', bottom: -4, right: -4,
    width: 14, height: 14, cursor: 'nwse-resize',
    borderRight: '3px solid #007aff', borderBottom: '3px solid #007aff',
    borderRadius: '0 0 3px 0',
  },
  tracingOverlay: {
    position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '0.8rem',
    padding: '0.3rem 0.8rem', borderRadius: 6,
  },
  errorOverlay: {
    position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(255,59,48,0.9)', color: '#fff', fontSize: '0.8rem',
    padding: '0.3rem 0.8rem', borderRadius: 6, whiteSpace: 'nowrap',
  },
  controlsSection: { flex: 1, minWidth: 220, maxWidth: 280, overflowY: 'auto' },
  controlGroup: { marginBottom: '1.25rem' },
  groupTitle: {
    fontSize: '0.8rem', fontWeight: 600, color: '#86868b',
    textTransform: 'uppercase', letterSpacing: '0.04em',
    margin: 0, marginBottom: '0.6rem',
  },
  controlRow: { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' },
  label: { fontSize: '0.9rem', color: '#1d1d1f', flex: 1 },
  colorInput: { width: 32, height: 32, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 0 },
  numberInput: {
    width: 64, padding: '0.3rem 0.4rem', fontSize: '0.85rem',
    border: '1px solid #d1d1d6', borderRadius: 6, textAlign: 'right',
  },
  valueLabel: { fontSize: '0.8rem', color: '#86868b', minWidth: 24, textAlign: 'right' },
  hint: { fontSize: '0.8rem', color: '#86868b', fontStyle: 'italic', margin: '0.25rem 0 0' },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' },
  chip: {
    padding: '0.4rem 0.8rem', borderRadius: 8, fontSize: '0.8rem',
    fontWeight: 500, cursor: 'pointer', border: '1.5px solid #d1d1d6',
    background: '#fff', color: '#1d1d1f',
  },
  chipActive: { borderColor: '#007aff', background: '#eef4ff', color: '#007aff' },
  footer: {
    padding: '1rem 1.5rem', borderTop: '1px solid #f0f0f0',
    display: 'flex', justifyContent: 'flex-end', gap: '0.75rem',
  },
  cancelBtn: {
    padding: '0.5rem 1.25rem', fontSize: '0.9rem', fontWeight: 500,
    background: '#f5f5f7', color: '#1d1d1f', border: 'none', borderRadius: 8, cursor: 'pointer',
  },
  saveBtn: {
    padding: '0.5rem 1.25rem', fontSize: '0.9rem', fontWeight: 500,
    background: '#007aff', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
  },
};
