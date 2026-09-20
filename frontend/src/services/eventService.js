import request from './apiClient';

// ─── Public API ───

export async function getPublicEvents() {
  const data = await request('/api/events');
  return data?.events || [];
}

// ─── User API ───

export async function createEvent(eventData) {
  const data = await request('/api/events', {
    method: 'POST',
    body: JSON.stringify(eventData),
  });
  return data?.event;
}

export async function getMyEvents() {
  const data = await request('/api/events/my');
  return data?.events || [];
}

// ─── Admin API ───

export async function getPendingEvents() {
  const data = await request('/api/events/pending');
  return data?.events || [];
}

export async function getApprovedEvents() {
  const data = await request('/api/events/approved');
  return data?.events || [];
}

export async function getRejectedEvents() {
  const data = await request('/api/events/rejected');
  return data?.events || [];
}

export async function approveEvent(eventId) {
  const data = await request(`/api/events/${eventId}/approve`, {
    method: 'POST',
  });
  return data;
}

export async function rejectEvent(eventId, reason) {
  const data = await request(`/api/events/${eventId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  return data;
}

export async function archiveEvent(eventId) {
  const data = await request(`/api/events/${eventId}/archive`, {
    method: 'POST',
  });
  return data;
}

export async function deleteEvent(eventId) {
  const data = await request(`/api/events/${eventId}`, {
    method: 'DELETE',
  });
  return data;
}
