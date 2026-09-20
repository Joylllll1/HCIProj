import { create } from 'zustand';
import * as adminService from '../services/adminService';

const useAdminStore = create((set, get) => ({
  // Reports
  reports: [],
  reportsLoading: false,
  reportsError: null,

  // Bans
  bans: [],
  bansLoading: false,
  bansError: null,

  // Tracing
  traceResult: null,
  traceLoading: false,
  traceError: null,

  // Audit Logs
  auditLogs: [],
  auditLogsLoading: false,
  auditLogsError: null,

  clearErrors: () => set({
    reportsError: null,
    bansError: null,
    traceError: null,
    auditLogsError: null,
  }),

  // Reports
  fetchReports: async () => {
    set({ reportsLoading: true, reportsError: null });
    try {
      const data = await adminService.getReports();
      set({ reports: data.reports, reportsLoading: false });
    } catch (err) {
      set({ reportsError: err.message, reportsLoading: false });
      throw err;
    }
  },

  dismissReport: async (reportId) => {
    try {
      await adminService.dismissReport(reportId);
      set((state) => ({
        reports: state.reports.filter((r) => r._id !== reportId),
      }));
    } catch (err) {
      set({ reportsError: err.message });
      throw err;
    }
  },

  // Tracing
  tracePost: async (targetId, targetType, reason) => {
    set({ traceLoading: true, traceError: null, traceResult: null });
    try {
      const result = await adminService.tracePost(targetId, targetType, reason);
      set({ traceResult: result, traceLoading: false });
      return result;
    } catch (err) {
      set({ traceError: err.message, traceLoading: false });
      throw err;
    }
  },

  clearTraceResult: () => set({ traceResult: null, traceError: null }),

  // Bans
  fetchBans: async (includeInactive = false) => {
    set({ bansLoading: true, bansError: null });
    try {
      const data = await adminService.getBans(includeInactive);
      set({ bans: data.bans, bansLoading: false });
    } catch (err) {
      set({ bansError: err.message, bansLoading: false });
      throw err;
    }
  },

  banUser: async (userId, { days, reason, relatedPostId }) => {
    try {
      const data = await adminService.banUser(userId, { days, reason, relatedPostId });
      // Refresh bans list
      get().fetchBans();
      return data;
    } catch (err) {
      set({ bansError: err.message });
      throw err;
    }
  },

  unbanUser: async (banId, reason) => {
    try {
      await adminService.unbanUser(banId, reason);
      // Refresh bans list
      get().fetchBans();
    } catch (err) {
      set({ bansError: err.message });
      throw err;
    }
  },

  // Posts
  deletePost: async (postId, reason) => {
    try {
      await adminService.deletePost(postId, reason);
      // Remove related report from list
      set((state) => ({
        reports: state.reports.filter((r) => r.postId?._id !== postId && r.targetId !== postId),
      }));
    } catch (err) {
      set({ reportsError: err.message });
      throw err;
    }
  },

  // Comments
  deleteComment: async (commentId, reason) => {
    try {
      await adminService.deleteComment(commentId, reason);
      // Remove related report from list
      set((state) => ({
        reports: state.reports.filter((r) => r.targetId !== commentId),
      }));
    } catch (err) {
      set({ reportsError: err.message });
      throw err;
    }
  },

  // Audit Logs
  fetchAuditLogs: async (action, limit) => {
    set({ auditLogsLoading: true, auditLogsError: null });
    try {
      const data = await adminService.getAuditLogs(action, limit);
      set({ auditLogs: data.logs, auditLogsLoading: false });
    } catch (err) {
      set({ auditLogsError: err.message, auditLogsLoading: false });
      throw err;
    }
  },
}));

export default useAdminStore;
