import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import useDialogFocus from '../../hooks/useDialogFocus';
import Icon from './Icon';
import '../../styles/lightbox.css';

function ImageLightbox({ images = [], initialIndex = 0, onClose }) {
  const [mounted, setMounted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [zoomScale, setZoomScale] = useState(null);
  const [imageAttempt, setImageAttempt] = useState(0);
  const [imageState, setImageState] = useState({ source: null, attempt: 0, status: 'loading' });
  const [imageSize, setImageSize] = useState(null);
  const [dragOrigin, setDragOrigin] = useState(null);
  const [swipeStart, setSwipeStart] = useState(null);
  const dialogRef = useRef(null);
  const viewportRef = useRef(null);
  const safeImages = useMemo(() => (Array.isArray(images) ? images.filter(Boolean) : []), [images]);
  const hasMultiple = safeImages.length > 1;
  const zoomed = zoomScale !== null;
  const currentIndex = safeImages.length > 0 ? ((activeIndex % safeImages.length) + safeImages.length) % safeImages.length : 0;
  const currentImage = safeImages[currentIndex];
  const isCurrentImageLoading = imageState.source !== currentImage
    || imageState.attempt !== imageAttempt
    || imageState.status === 'loading';
  const isCurrentImageFailed = imageState.source === currentImage
    && imageState.attempt === imageAttempt
    && imageState.status === 'error';

  useDialogFocus(dialogRef, mounted && safeImages.length > 0, onClose);

  const resetView = useCallback(() => {
    setZoomScale(null);
    setDragOrigin(null);
    setSwipeStart(null);
    if (viewportRef.current) {
      viewportRef.current.scrollLeft = 0;
      viewportRef.current.scrollTop = 0;
    }
  }, []);

  const showIndex = useCallback((index) => {
    if (safeImages.length === 0) return;
    setActiveIndex((index + safeImages.length) % safeImages.length);
    setImageAttempt(0);
    setImageSize(null);
    resetView();
  }, [resetView, safeImages.length]);

  const showPrevious = useCallback(() => {
    showIndex(currentIndex - 1);
  }, [currentIndex, showIndex]);

  const showNext = useCallback(() => {
    showIndex(currentIndex + 1);
  }, [currentIndex, showIndex]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || safeImages.length === 0) return undefined;

    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const clientWidth = document.documentElement.clientWidth;
    const scrollbarWidth = clientWidth > 0 ? Math.max(0, window.innerWidth - clientWidth) : 0;
    const computedPadding = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;

    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) body.style.paddingRight = `${computedPadding + scrollbarWidth}px`;

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [mounted, safeImages.length]);

  useEffect(() => {
    if (!mounted || safeImages.length === 0) return undefined;

    const handleKeyDown = (event) => {
      if (zoomed && viewportRef.current?.contains(event.target)) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.target?.matches?.('input, textarea, select')) return;
      if (hasMultiple && event.key === 'ArrowLeft') {
        event.preventDefault();
        showPrevious();
      } else if (hasMultiple && event.key === 'ArrowRight') {
        event.preventDefault();
        showNext();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mounted, safeImages.length, hasMultiple, showNext, showPrevious, zoomed]);

  useEffect(() => {
    if (safeImages.length === 0) return;
    setActiveIndex(Math.min(Math.max(initialIndex, 0), safeImages.length - 1));
  }, [initialIndex, safeImages.length]);

  useEffect(() => {
    if (!currentImage) return;
    setImageState({ source: currentImage, attempt: imageAttempt, status: 'loading' });
  }, [currentImage, imageAttempt]);

  if (!mounted || safeImages.length === 0) return null;

  const toggleZoom = () => {
    if (viewportRef.current) {
      viewportRef.current.scrollLeft = 0;
      viewportRef.current.scrollTop = 0;
    }
    if (zoomed) {
      setZoomScale(null);
      return;
    }

    if (!currentSize || !viewportRef.current) return;
    const fitScale = Math.min(
      1,
      viewportRef.current.clientWidth / currentSize.width,
      viewportRef.current.clientHeight / currentSize.height,
    );
    setZoomScale(Math.max(1, fitScale * 2));
    viewportRef.current.focus({ preventScroll: true });
  };

  const handleImageLoad = (event) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    setImageSize({ source: currentImage, width: naturalWidth, height: naturalHeight });
    setImageState({ source: currentImage, attempt: imageAttempt, status: 'loaded' });
  };

  const handleImageError = () => {
    setImageState({ source: currentImage, attempt: imageAttempt, status: 'error' });
  };

  const retryImage = () => {
    setImageState({ source: currentImage, attempt: imageAttempt + 1, status: 'loading' });
    setImageAttempt((attempt) => attempt + 1);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = currentImage;
    link.download = `treehole-image-${currentIndex + 1}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePointerDown = (event) => {
    if (event.target.closest('button')) return;
    if (zoomed && event.pointerType === 'mouse' && event.button === 0) {
      setDragOrigin({
        x: event.clientX,
        y: event.clientY,
        scrollLeft: viewportRef.current?.scrollLeft || 0,
        scrollTop: viewportRef.current?.scrollTop || 0,
      });
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } else if (!zoomed && event.pointerType === 'touch') {
      setSwipeStart({ x: event.clientX, y: event.clientY });
    }
  };

  const handlePointerMove = (event) => {
    if (!zoomed || !dragOrigin || !viewportRef.current) return;
    viewportRef.current.scrollLeft = dragOrigin.scrollLeft - (event.clientX - dragOrigin.x);
    viewportRef.current.scrollTop = dragOrigin.scrollTop - (event.clientY - dragOrigin.y);
  };

  const handlePointerUp = (event) => {
    if (dragOrigin) {
      setDragOrigin(null);
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      return;
    }

    if (!swipeStart || zoomed || !hasMultiple) {
      setSwipeStart(null);
      return;
    }

    const deltaX = event.clientX - swipeStart.x;
    const deltaY = event.clientY - swipeStart.y;
    if (Math.abs(deltaX) > 48 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0) showNext();
      else showPrevious();
    }
    setSwipeStart(null);
  };

  const handlePointerCancel = () => {
    setDragOrigin(null);
    setSwipeStart(null);
  };

  const currentSize = imageSize?.source === currentImage ? imageSize : null;
  const zoomStyle = zoomed && currentSize
    ? { width: `${currentSize.width * zoomScale}px`, height: `${currentSize.height * zoomScale}px` }
    : undefined;

  const modalContent = (
    <div
      ref={dialogRef}
      className="image-lightbox animate-modal-fade-in"
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
    >
      <header className="image-lightbox__header">
        <div className="image-lightbox__actions">
          <button
            type="button"
            className="image-lightbox__control image-lightbox__save"
            onClick={handleDownload}
            aria-label="保存图片"
            title="保存图片"
          >
            <Icon name="download" size={17} />
            <span className="image-lightbox__download-label">保存图片</span>
          </button>
          <button
            type="button"
            className="image-lightbox__control"
            onClick={toggleZoom}
            aria-label={zoomed ? '适合屏幕' : '放大图片'}
            title={zoomed ? '适合屏幕' : '放大图片'}
            disabled={isCurrentImageLoading || isCurrentImageFailed}
          >
            <Icon name={zoomed ? 'zoom_out' : 'zoom_in'} size={17} />
          </button>
        </div>

        <output className="image-lightbox__count" aria-live="polite" aria-atomic="true">
          {currentIndex + 1} / {safeImages.length}
        </output>

        <button
          type="button"
          className="image-lightbox__control image-lightbox__close"
          data-dialog-focus
          onClick={() => onClose?.()}
          aria-label="关闭预览"
          title="关闭预览"
        >
          <Icon name="close" size={18} />
        </button>
      </header>

      <main
        className={`image-lightbox__stage ${zoomed ? 'is-zoomed' : ''}`}
        onClick={(event) => {
          if (event.target === event.currentTarget || event.target === viewportRef.current) onClose?.();
        }}
      >
        <div
          ref={viewportRef}
          className={`image-lightbox__viewport ${zoomed ? 'is-zoomed' : ''} ${dragOrigin ? 'is-dragging' : ''}`}
          role="region"
          aria-label={zoomed ? '放大图片，可滚动或拖动查看' : '图片'}
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          <img
            key={`${currentImage}-${imageAttempt}`}
            src={currentImage}
            alt={`预览图片 ${currentIndex + 1}`}
            className={`image-lightbox__image ${zoomed ? 'is-zoomed' : ''}`}
            style={zoomStyle}
            onLoad={handleImageLoad}
            onError={handleImageError}
            onDoubleClick={toggleZoom}
            draggable="false"
          />
          {isCurrentImageLoading && (
            <div className="image-lightbox__message" role="status" aria-live="polite">
              <span className="image-lightbox__spinner" aria-hidden="true" />
              <span>图片加载中…</span>
            </div>
          )}
          {isCurrentImageFailed && (
            <div className="image-lightbox__message image-lightbox__message--error" role="alert">
              <span>图片加载失败</span>
              <button type="button" className="image-lightbox__retry" onClick={retryImage}>
                重新加载
              </button>
            </div>
          )}
        </div>

        {hasMultiple && (
          <button
            type="button"
            className="image-lightbox__arrow image-lightbox__previous"
            onClick={showPrevious}
            aria-label="上一张"
            title="上一张"
          >
            <Icon name="chevron_left" size={18} />
          </button>
        )}
        {hasMultiple && (
          <button
            type="button"
            className="image-lightbox__arrow image-lightbox__next"
            onClick={showNext}
            aria-label="下一张"
            title="下一张"
          >
            <Icon name="chevron_right" size={18} />
          </button>
        )}
      </main>

      <footer className="image-lightbox__footer">
        {hasMultiple && (
          <nav className="image-lightbox__thumbnails" aria-label="选择预览图片">
            {safeImages.map((image, index) => (
              <button
                key={`${image}-${index}`}
                type="button"
                className={`image-lightbox__thumbnail ${currentIndex === index ? 'is-active' : ''}`}
                onClick={() => showIndex(index)}
                aria-label={`查看第 ${index + 1} 张图片`}
                aria-current={currentIndex === index ? 'true' : undefined}
                title={`第 ${index + 1} 张图片`}
              >
                <img src={image} alt="" loading="lazy" />
              </button>
            ))}
          </nav>
        )}
        <p className="image-lightbox__hint">
          {zoomed ? '滚动或拖动查看 · 双击适合屏幕' : '双击或点击放大 · 移动端左右滑动切换'}
        </p>
      </footer>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}

export default ImageLightbox;
