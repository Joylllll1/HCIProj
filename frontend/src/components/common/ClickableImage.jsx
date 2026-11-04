import React, { lazy, Suspense, useState } from 'react';
import '../../styles/lightbox.css';

const ImageLightbox = lazy(() => import('./ImageLightbox'));

function ClickableImage({
  src,
  alt = '',
  className = '',
  wrapperClassName = 'block h-full w-full',
  images = null,
  imageIndex = 0,
  onClick,
  onImageLoad,
}) {
  const [open, setOpen] = useState(false);
  const [imageStatus, setImageStatus] = useState({ source: src, status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const previewImages = Array.isArray(images) && images.length > 0 ? images : [src];
  const imageNumber = Math.min(Math.max(imageIndex, 0), previewImages.length - 1) + 1;
  const description = alt.trim() || '图片';
  const loaded = imageStatus.source === src && imageStatus.status === 'loaded';
  const failed = imageStatus.source === src && imageStatus.status === 'error';
  const buttonLabel = failed
    ? `图片加载失败，点击重试：${description}`
    : `查看图片：${description}（第 ${imageNumber} 张，共 ${previewImages.length} 张）`;

  const handleOpen = (event) => {
    event.stopPropagation();

    if (failed) {
      setImageStatus({ source: src, status: 'loading' });
      setAttempt((current) => current + 1);
      return;
    }

    try {
      onClick?.(event);
    } catch (error) {
      console.error('ClickableImage onClick callback failed', error);
    }
    setOpen(true);
  };

  const handleLoad = (event) => {
    setImageStatus({ source: src, status: 'loaded' });
    try {
      onImageLoad?.(event);
    } catch (error) {
      console.error('ClickableImage onImageLoad callback failed', error);
    }
  };

  const handleError = () => {
    setImageStatus({ source: src, status: 'error' });
  };

  return (
    <>
      <button
        type="button"
        className={`clickable-image group relative block h-full w-full cursor-zoom-in overflow-hidden border-0 bg-transparent p-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue ${failed ? 'is-error' : ''} ${wrapperClassName}`.trim()}
        onClick={handleOpen}
        aria-label={buttonLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {!loaded && (
          <span
            className={`clickable-image__status ${failed ? 'is-error' : 'is-loading'}`}
            role="status"
            aria-live="polite"
          >
            {failed ? '图片加载失败，点击重试' : '图片加载中…'}
          </span>
        )}
        <img
          key={`${src}-${attempt}`}
          src={src}
          alt={alt}
          className={`clickable-image__image ${loaded ? 'is-loaded' : ''} ${className} transition-opacity duration-150`.trim()}
          onLoad={handleLoad}
          onError={handleError}
        />
      </button>

      {open && (
        <Suspense fallback={null}>
          <ImageLightbox
            images={previewImages}
            initialIndex={imageIndex}
            onClose={() => setOpen(false)}
          />
        </Suspense>
      )}
    </>
  );
}

export default ClickableImage;
