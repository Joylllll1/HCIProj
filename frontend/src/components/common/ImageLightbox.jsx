import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import Icon from './Icon';

function ImageLightbox({ images = [], initialIndex = 0, onClose }) {
  const [mounted, setMounted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragOrigin, setDragOrigin] = useState(null);
  const [swipeStart, setSwipeStart] = useState(null);
  const safeImages = useMemo(() => (Array.isArray(images) ? images.filter(Boolean) : []), [images]);
  const hasMultiple = safeImages.length > 1;

  const showPrevious = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setActiveIndex((current) => (current - 1 + safeImages.length) % safeImages.length);
  }, [safeImages.length]);

  const showNext = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setActiveIndex((current) => (current + 1) % safeImages.length);
  }, [safeImages.length]);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!mounted || safeImages.length === 0) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (hasMultiple && event.key === 'ArrowLeft') {
        showPrevious();
      } else if (hasMultiple && event.key === 'ArrowRight') {
        showNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mounted, safeImages.length, hasMultiple, onClose, showPrevious, showNext]);

  useEffect(() => {
    setActiveIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setDragging(false);
    setDragOrigin(null);
    setSwipeStart(null);
  }, [activeIndex]);

  if (!mounted || safeImages.length === 0) return null;

  const currentImage = safeImages[activeIndex] || safeImages[0];

  const toggleZoom = () => {
    if (scale > 1) {
      setScale(1);
      setOffset({ x: 0, y: 0 });
      return;
    }

    setScale(2);
  };

  const handlePointerDown = (event) => {
    if (scale > 1) {
      event.preventDefault();
      setDragging(true);
      setDragOrigin({
        x: event.clientX - offset.x,
        y: event.clientY - offset.y,
      });
      event.currentTarget.setPointerCapture?.(event.pointerId);
      return;
    }

    if (event.pointerType === 'touch') {
      setSwipeStart({
        x: event.clientX,
        y: event.clientY,
      });
    }
  };

  const handlePointerMove = (event) => {
    if (!dragging || scale <= 1 || !dragOrigin) return;

    event.preventDefault();
    setOffset({
      x: event.clientX - dragOrigin.x,
      y: event.clientY - dragOrigin.y,
    });
  };

  const handlePointerUp = (event) => {
    if (dragging) {
      setDragging(false);
      setDragOrigin(null);
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      return;
    }

    if (!swipeStart || scale > 1 || !hasMultiple) {
      setSwipeStart(null);
      return;
    }

    const deltaX = event.clientX - swipeStart.x;
    const deltaY = event.clientY - swipeStart.y;

    if (Math.abs(deltaX) > 56 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0) {
        showNext();
      } else {
        showPrevious();
      }
    }

    setSwipeStart(null);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = currentImage;
    link.download = `treehole-image-${activeIndex + 1}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/88 px-3 py-4 backdrop-blur-sm animate-modal-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
    >
      <div className="absolute left-3 top-4 z-10 flex items-center gap-2 sm:left-5">
        <button
          type="button"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-white/20"
          onClick={(event) => {
            event.stopPropagation();
            handleDownload();
          }}
        >
          <Icon name="download" size={18} />
          <span className="hidden sm:inline">保存原图</span>
        </button>
        <button
          type="button"
          className="grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-white/10 text-white transition-colors duration-150 hover:bg-white/20"
          onClick={(event) => {
            event.stopPropagation();
            toggleZoom();
          }}
          aria-label={scale > 1 ? '缩小图片' : '放大图片'}
        >
          <Icon name={scale > 1 ? 'zoom_out' : 'zoom_in'} size={18} />
        </button>
      </div>

      <button
        type="button"
        className="absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-white/10 text-white transition-colors duration-150 hover:bg-white/20"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        aria-label="关闭预览"
      >
        <Icon name="close" />
      </button>

      {hasMultiple && (
        <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full border border-white/12 bg-black/35 px-3 py-1.5 text-xs font-semibold text-white/90">
          {activeIndex + 1} / {safeImages.length}
        </div>
      )}

      {hasMultiple && (
        <button
          type="button"
          className="absolute left-3 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-white/10 text-white transition-colors duration-150 hover:bg-white/20 sm:left-5"
          onClick={(event) => {
            event.stopPropagation();
            showPrevious();
          }}
          aria-label="上一张"
        >
          <Icon name="chevron_left" />
        </button>
      )}

      <div
        className="flex max-h-full w-full max-w-[min(1200px,100vw)] flex-col items-center justify-center gap-4"
        onClick={(event) => event.stopPropagation()}
      >
        <img
          src={currentImage}
          alt={`预览图片 ${activeIndex + 1}`}
          className={`max-h-[72vh] w-auto max-w-full rounded-2xl object-contain shadow-[0_18px_60px_rgba(0,0,0,0.45)] transition-transform duration-200 ${
            scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'
          }`}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          }}
          onDoubleClick={(event) => {
            event.stopPropagation();
            toggleZoom();
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            setDragging(false);
            setDragOrigin(null);
            setSwipeStart(null);
          }}
        />

        {hasMultiple && (
          <div className="flex w-full max-w-[min(900px,92vw)] gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-black/25 p-2 backdrop-blur-sm">
            {safeImages.map((image, index) => (
              <button
                key={`${image}-${index}`}
                type="button"
                className={`relative h-16 w-16 flex-none overflow-hidden rounded-xl border transition-all duration-150 sm:h-20 sm:w-20 ${
                  activeIndex === index
                    ? 'border-white shadow-[0_0_0_2px_rgba(255,255,255,0.2)]'
                    : 'border-white/10 opacity-70 hover:opacity-100'
                }`}
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveIndex(index);
                }}
                aria-label={`查看第 ${index + 1} 张图片`}
              >
                <img src={image} alt={`缩略图 ${index + 1}`} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs text-white/75 backdrop-blur-sm">
          双击放大，拖拽查看；移动端可左右滑动切换
        </div>
      </div>

      {hasMultiple && (
        <button
          type="button"
          className="absolute right-3 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-white/10 text-white transition-colors duration-150 hover:bg-white/20 sm:right-5"
          onClick={(event) => {
            event.stopPropagation();
            showNext();
          }}
          aria-label="下一张"
        >
          <Icon name="chevron_right" />
        </button>
      )}
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}

export default ImageLightbox;
