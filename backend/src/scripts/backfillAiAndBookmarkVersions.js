import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

// Use the raw collection: Mongoose defaults hide missing fields in old documents.
export async function backfillBookmarkVersions(collection, apply = false) {
  const filter = { bookmarkVersion: { $exists: false } };
  const count = await collection.countDocuments(filter);
  if (apply) await collection.updateMany(filter, { $set: { bookmarkVersion: 0 } });
  return { mode: apply ? 'apply' : 'dry-run', missingBookmarkVersions: count };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/treehole');
    console.log(JSON.stringify(await backfillBookmarkVersions(mongoose.connection.collection('users'), process.argv.includes('--apply'))));
  } finally {
    await mongoose.disconnect();
  }
}
