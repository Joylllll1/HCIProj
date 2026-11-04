import { afterEach, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import mongoose from 'mongoose';
import Event from '../models/Event.js';
import { readImage } from './imageStorage.js';
import { createEvent, getPublicEvents } from './eventService.js';

afterEach(() => mock.restoreAll());

async function useTempImageStorage(t) {
  const previousDirectory = process.env.IMAGE_STORAGE_DIR;
  const directory = await mkdtemp(join(tmpdir(), 'treehole-event-images-'));
  process.env.IMAGE_STORAGE_DIR = directory;
  t.after(async () => {
    if (previousDirectory === undefined) delete process.env.IMAGE_STORAGE_DIR;
    else process.env.IMAGE_STORAGE_DIR = previousDirectory;
    await rm(directory, { recursive: true, force: true });
  });
}

test('event creation stores the poster and event reads return same-origin media URLs', async (t) => {
  await useTempImageStorage(t);
  const image = 'data:image/png;base64,AA==';
  const eventId = new mongoose.Types.ObjectId();
  let createdData;
  mock.method(Event, 'create', async (data) => {
    createdData = data;
    const event = { ...data, _id: eventId, createdAt: new Date() };
    return { ...event, toObject: () => event };
  });

  const created = await createEvent({
    title: '校园活动',
    type: '学术讲座',
    place: '仙林校区',
    time: '2026-11-01T10:00:00.000Z',
    image,
    applicantName: '同学',
    applicantStudentId: '123456',
    applicantPhone: '12345678901',
    applicantQQ: '123456789',
  }, 'user-1');

  assert.match(createdData.image, /^file:[a-f0-9]{64}\.png$/);
  assert.deepEqual((await readImage(createdData.image)).buffer, Buffer.from('AA==', 'base64'));
  assert.match(created.image, new RegExp(`^/api/media/events/${eventId}\\?v=`));
  assert.equal(JSON.stringify(created).includes('data:image/'), false);
  assert.equal(JSON.stringify(created).includes('file:'), false);

  const publicEvent = { ...createdData, _id: eventId, status: 'approved' };
  mock.method(Event, 'find', () => {
    const query = {
      select: () => query,
      sort: () => query,
      lean: async () => [publicEvent],
    };
    return query;
  });

  const [listed] = await getPublicEvents();

  assert.equal(listed.image, created.image);
  assert.equal(JSON.stringify(listed).includes('data:image/'), false);
  assert.equal(JSON.stringify(listed).includes('file:'), false);
});
