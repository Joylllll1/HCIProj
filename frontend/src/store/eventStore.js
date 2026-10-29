import { create } from 'zustand';
import * as eventService from '../services/eventService';

let myEventsRequestId = 0;

const useEventStore = create((set, get) => ({
  // State
  publicEvents: [],
  myEvents: [],
  pendingEvents: [],
  approvedEvents: [],
  rejectedEvents: [],
    archivedEvents: [],
    deletedEvents: [],
    publicLoading: false,
    myEventsLoading: false,
    publicError: null,
    myEventsError: null,
  pendingLoading: false,
  approvedLoading: false,
  rejectedLoading: false,
  error: null,

  // Fetch public events (all users)
  fetchPublicEvents: async () => {
    set({ publicLoading: true, publicError: null, error: null });
    try {
      const events = await eventService.getPublicEvents();
      set({ publicEvents: events, publicLoading: false, publicError: null });
    } catch (err) {
      const message = err?.message || '活动加载失败，请重试。';
      set({ error: message, publicError: message, publicLoading: false });
    }
  },

  // Fetch my events (current user's submissions)
  fetchMyEvents: async () => {
    const requestId = ++myEventsRequestId;
    set({ myEventsLoading: true, myEventsError: null, error: null });
    try {
      const events = await eventService.getMyEvents();
      if (requestId !== myEventsRequestId) return;
      set({ myEvents: events, myEventsLoading: false, myEventsError: null });
    } catch (err) {
      if (requestId !== myEventsRequestId) return;
      const message = err?.message || '申请记录加载失败，请重试。';
      set({ error: message, myEventsError: message, myEventsLoading: false });
    }
  },

  resetForAccountChange: () => {
    myEventsRequestId += 1;
    set({ myEvents: [], myEventsLoading: false, myEventsError: null });
  },

  // Fetch pending events (admin)
  fetchPendingEvents: async () => {
    set({ pendingLoading: true, error: null });
    try {
      const events = await eventService.getPendingEvents();
      set({ pendingEvents: events, pendingLoading: false });
    } catch (err) {
      set({ error: err.message, pendingLoading: false });
    }
  },

  // Fetch approved events (admin)
  fetchApprovedEvents: async () => {
    set({ approvedLoading: true, error: null });
    try {
      const events = await eventService.getApprovedEvents();
      set({ approvedEvents: events, approvedLoading: false });
    } catch (err) {
      set({ error: err.message, approvedLoading: false });
    }
  },

  // Fetch rejected events (admin)
  fetchRejectedEvents: async () => {
    set({ rejectedLoading: true, error: null });
    try {
      const events = await eventService.getRejectedEvents();
      set({ rejectedEvents: events, rejectedLoading: false });
    } catch (err) {
      set({ error: err.message, rejectedLoading: false });
    }
  },

  // Fetch all event lists (admin convenience)
  fetchAllEvents: async () => {
    const { fetchPendingEvents, fetchApprovedEvents, fetchRejectedEvents } = get();
    await Promise.all([
      fetchPendingEvents(),
      fetchApprovedEvents(),
      fetchRejectedEvents(),
    ]);
  },

  // Submit new event (user)
  submitEvent: async (eventData) => {
    set({ error: null });
    try {
      const event = await eventService.createEvent(eventData);
      // Add to pending list if admin is viewing
      const { pendingEvents } = get();
      set({ pendingEvents: [event, ...pendingEvents] });
      return event;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  // Approve event (admin)
  approveEvent: async (eventId) => {
    set({ error: null });
    try {
      await eventService.approveEvent(eventId);
      // Move from pending to approved
      const { pendingEvents, approvedEvents } = get();
      const event = pendingEvents.find((e) => e._id === eventId);
      if (event) {
        const approvedEvent = {
          ...event,
          status: 'approved',
          reviewedAt: new Date().toISOString(),
        };
        set({
          pendingEvents: pendingEvents.filter((e) => e._id !== eventId),
          approvedEvents: [approvedEvent, ...approvedEvents],
        });
      }
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  // Reject event (admin)
  rejectEvent: async (eventId, reason) => {
    set({ error: null });
    try {
      await eventService.rejectEvent(eventId, reason);
      // Move from pending to rejected
      const { pendingEvents, rejectedEvents } = get();
      const event = pendingEvents.find((e) => e._id === eventId);
      if (event) {
        const rejectedEvent = {
          ...event,
          status: 'rejected',
          rejectionReason: reason,
          reviewedAt: new Date().toISOString(),
        };
        set({
          pendingEvents: pendingEvents.filter((e) => e._id !== eventId),
          rejectedEvents: [rejectedEvent, ...rejectedEvents],
        });
      }
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  // Archive event (admin)
  archiveEvent: async (eventId) => {
    set({ error: null });
    try {
      await eventService.archiveEvent(eventId);
      // Move from approved to archived
      const { approvedEvents, archivedEvents } = get();
      const event = approvedEvents.find((e) => e._id === eventId);
      if (event) {
        const archivedEvent = {
          ...event,
          status: 'archived',
        };
        set({
          approvedEvents: approvedEvents.filter((e) => e._id !== eventId),
          archivedEvents: [archivedEvent, ...archivedEvents],
        });
      }
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  // Delete approved event (admin takedown)
  deleteEvent: async (eventId) => {
    set({ error: null });
    try {
      await eventService.deleteEvent(eventId);
      const { approvedEvents, deletedEvents, myEvents } = get();
      const event = approvedEvents.find((e) => e._id === eventId);
      if (event) {
        const deletedEvent = {
          ...event,
          status: 'deleted',
        };
        set({
          approvedEvents: approvedEvents.filter((e) => e._id !== eventId),
          deletedEvents: [deletedEvent, ...deletedEvents],
          myEvents: myEvents.map((item) => (item._id === eventId ? { ...item, status: 'deleted' } : item)),
        });
      }
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  // Clear error
  clearError: () => set({ error: null }),
}));

export default useEventStore;
