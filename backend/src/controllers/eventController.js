import * as eventService from '../services/eventService.js';

// ─── Public Routes ───

export async function getPublicEvents(_req, res) {
  const events = await eventService.getPublicEvents();
  res.json({ events });
}

// ─── Authenticated Routes ───

export async function createEvent(req, res) {
  const userId = req.user._id;
  const event = await eventService.createEvent(req.body, userId);
  res.status(201).json({ event });
}

export async function getMyEvents(req, res) {
  const userId = req.user._id;
  const events = await eventService.getMyEvents(userId);
  res.json({ events });
}

// ─── Admin Routes ───

export async function getPendingEvents(_req, res) {
  const events = await eventService.getPendingEvents();
  res.json({ events });
}

export async function getApprovedEvents(_req, res) {
  const events = await eventService.getApprovedEvents();
  res.json({ events });
}

export async function getRejectedEvents(_req, res) {
  const events = await eventService.getRejectedEvents();
  res.json({ events });
}

export async function approveEvent(req, res) {
  const { id: eventId } = req.params;
  const adminId = req.user._id;

  const event = await eventService.approveEvent(eventId, adminId);
  res.json({ message: '活动已通过审核', event });
}

export async function rejectEvent(req, res) {
  const { id: eventId } = req.params;
  const { reason } = req.body;
  const adminId = req.user._id;

  const event = await eventService.rejectEvent(eventId, adminId, reason);
  res.json({ message: '活动已拒绝', event });
}

export async function archiveEvent(req, res) {
  const { id: eventId } = req.params;
  const adminId = req.user._id;

  const event = await eventService.archiveEvent(eventId, adminId);
  res.json({ message: '活动已归档', event });
}

export async function deleteEvent(req, res) {
  const { id: eventId } = req.params;
  const adminId = req.user._id;

  const event = await eventService.deleteEvent(eventId, adminId);
  res.json({ message: '活动已删除', event });
}
