import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import { migrateInlineImages } from '../services/imageMigrationService.js';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });
const write = process.argv.includes('--write');
const invalidArgs = process.argv.slice(2).filter((argument) => !['--write', '--dry-run'].includes(argument));
if (invalidArgs.length || (write && process.argv.includes('--dry-run'))) {
  console.error('用法：npm run migrate:images -- [--dry-run | --write]');
  process.exitCode = 1;
} else {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/treehole', {
      autoIndex: false,
      autoCreate: false,
    });
    const result = await migrateInlineImages({ dryRun: !write });
    console.log(JSON.stringify({ mode: write ? 'write' : 'dry-run', result }, null, 2));
    if (!write) console.log('本次仅统计旧图片；使用 --write 转存文件并更新引用。');
  } catch (error) {
    console.error('图片迁移失败：', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
