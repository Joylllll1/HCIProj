import { useCallback } from 'react';
import useEventStore from '../store/eventStore';
import useUiStore from '../store/uiStore';

// ─── Stable store selectors ───
const selectApproveEvent = (s) => s.approveEvent;
const selectRejectEvent = (s) => s.rejectEvent;
const selectArchiveEvent = (s) => s.archiveEvent;
const selectSubmitEvent = (s) => s.submitEvent;
const selectShowToast = (s) => s.showToast;
const selectAddNotif = (s) => s.addNotif;

export default function useEventActions() {
  const approveEvent = useEventStore(selectApproveEvent);
  const rejectEvent = useEventStore(selectRejectEvent);
  const archiveEvent = useEventStore(selectArchiveEvent);
  const submitEvent = useEventStore(selectSubmitEvent);
  const showToast = useUiStore(selectShowToast);
  const addNotif = useUiStore(selectAddNotif);

  const handleApproveEvent = useCallback((event) => {
    const approved = approveEvent(event);
    addNotif(`你的活动「${event.title}」已通过审核，已在校园公告展示`);
    showToast('活动已通过审核');
    return approved;
  }, [approveEvent, addNotif, showToast]);

  const handleRejectEvent = useCallback((eventId, reason) => {
    const rejected = rejectEvent(eventId, reason);
    if (rejected) {
      addNotif(`你的活动「${rejected.title}」审核未通过。拒绝理由：${reason}`);
      showToast('活动申请已拒绝');
    }
    return rejected;
  }, [rejectEvent, addNotif, showToast]);

  const handleArchiveEvent = useCallback((event) => {
    archiveEvent(event);
    showToast('活动已归档');
  }, [archiveEvent, showToast]);

  const handleSubmitEvent = useCallback((event, successMsg) => {
    submitEvent(event);
    showToast(successMsg || '活动申请已提交，等待管理员审核');
  }, [submitEvent, showToast]);

  return {
    approveEvent: handleApproveEvent,
    rejectEvent: handleRejectEvent,
    archiveEvent: handleArchiveEvent,
    submitEvent: handleSubmitEvent,
  };
}
