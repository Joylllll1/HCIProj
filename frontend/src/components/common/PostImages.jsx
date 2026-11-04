import React, { useMemo, useState } from 'react';
import ClickableImage from './ClickableImage';

// Stable previews keep an image-heavy post readable; the viewer retains full content.
export default function PostImages({ images = [], title = '帖子' }) {
  const sources = useMemo(() => (Array.isArray(images) ? images : []).filter((src) => typeof src === 'string' && src.trim()), [images]);
  const [ratios, setRatios] = useState({});
  if (!sources.length) return null;
  return (
    <figure className="post-media" aria-label={`${sources.length} 张帖子图片`}>
      <div className="post-media-grid" data-count={sources.length}>
        {sources.map((src, index) => {
          const isLong = ratios[src] > 0 && ratios[src] < 0.45;
          return (
            <div key={`${src}-${index}`} className={`post-media-cell ${isLong ? 'is-long-image' : ''}`}>
              <ClickableImage
                src={src}
                alt={`${title || '帖子'}，图片 ${index + 1}`}
                className="post-media-image"
                wrapperClassName="post-media-open"
                images={sources}
                imageIndex={index}
                onImageLoad={(event) => {
                  const { naturalWidth, naturalHeight } = event.currentTarget;
                  if (naturalWidth && naturalHeight) setRatios((current) => ({ ...current, [src]: naturalWidth / naturalHeight }));
                }}
              />
              {isLong && <span className="post-media-badge" aria-hidden="true">{sources.length === 1 ? '长图 · 点击查看' : '长图'}</span>}
            </div>
          );
        })}
      </div>
      <figcaption>{sources.length > 1 ? `${sources.length} 张图片 · 点击查看大图` : '点击查看大图'}</figcaption>
    </figure>
  );
}
