import Post from '../models/Post.js';
import Draft from '../models/Draft.js';
import Comment from '../models/Comment.js';
import Event from '../models/Event.js';
import { storeInlineImage, storeTrustedImages } from './imageStorage.js';

const isInlineImage = (value) => typeof value === 'string' && /^\s*data:image\//i.test(value);
const inlinePattern = /^\s*data:image\//i;

// Conditional writes protect image edits made after a document was inspected.
// Raw collections also allow removal of the historical Post.image field.
export async function migrateInlineImages({ dryRun = true, models = { Post, Draft, Comment, Event } } = {}) {
  const result = {};
  for (const [name, model] of Object.entries(models)) {
    const imagePaths = name === 'Comment' ? ['image', 'replies.image'] : ['image', 'images'];
    const cursor = model.collection.find({ $or: imagePaths.map((field) => ({ [field]: inlinePattern })) }, {
      projection: { image: 1, images: 1, replies: 1 },
    });
    const stats = { found: 0, migrated: 0, skipped: 0 };
    for await (const document of cursor) {
      stats.found += 1;
      if (dryRun) continue;

      const filter = { _id: document._id };
      const set = {};
      const unset = {};
      if (name === 'Post' || name === 'Draft') {
        const images = document.images?.length ? document.images : document.image ? [document.image] : [];
        set.images = await storeTrustedImages(images, { label: '迁移图片' });
        filter.images = Object.hasOwn(document, 'images') ? document.images : { $exists: false };
        filter.image = Object.hasOwn(document, 'image') ? document.image : { $exists: false };
        unset.image = '';
      } else {
        if (isInlineImage(document.image)) {
          set.image = await storeInlineImage(document.image, '迁移图片');
          filter.image = document.image;
        }
        if (name === 'Comment' && document.replies?.some((reply) => isInlineImage(reply.image))) {
          filter.replies = document.replies;
          for (const [index, reply] of document.replies.entries()) {
            if (isInlineImage(reply.image)) {
              set[`replies.${index}.image`] = await storeInlineImage(reply.image, '迁移回复图片');
            }
          }
        }
      }
      const update = { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) };
      const applied = await model.collection.updateOne(filter, update);
      if (applied.matchedCount) stats.migrated += 1;
      else stats.skipped += 1;
    }
    result[name] = stats;
  }
  return result;
}
