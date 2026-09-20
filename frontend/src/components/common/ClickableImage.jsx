import React, { lazy, Suspense, useState } from 'react';

const ImageLightbox = lazy(() => import('./ImageLightbox'));

function ClickableImage({
  src,
  alt,
  className = '',
  wrapperClassName = 'block w-full',
  images = null,
  imageIndex = 0,
  onClick,
}) {
  const [open, setOpen] = useState(false);
  const previewImages = Array.isArray(images) && images.length > 0 ? images : [src];

  const handleOpen = (event) => {
    event.stopPropagation();
    onClick?.(event);
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        className={`group cursor-zoom-in border-0 bg-transparent p-0 text-left ${wrapperClassName}`.trim()}
        onClick={handleOpen}
        aria-label="查看图片"
      >
        <img
          src={src}
          alt={alt}
          className={`${className} transition-transform duration-200 group-hover:scale-[1.02]`.trim()}
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
