import React, { useState } from 'react';
import Icon from './Icon';
import PlainTextContent from './PlainTextContent';

const REJECTION_REASONS = [
  '内容不符合社区规范',
  '活动信息不完整或有误',
  '时间或地点安排冲突',
  '非校园官方或认证社团活动',
];

export function EventDetailModal({ event, onClose }) {
  if (!event) return null;

  const formatTime = (time) => {
    if (!time) return '未指定';
    const date = new Date(time);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Check if applicant info exists (for admin view)
  const hasApplicantInfo = event.applicantName || event.applicantStudentId || event.applicantPhone || event.applicantQQ;

  return (
    <div className="modal-overlay fixed inset-0 z-[150] grid place-items-center bg-black/40 animate-modal-fade-in" onClick={onClose}>
      <div className="modal-content w-[min(600px,90vw)] max-h-[85vh] overflow-y-auto rounded-lg bg-white shadow-md animate-modal-scale-in" onClick={(e) => e.stopPropagation()}>
        {event.image && (
          <img src={event.image} alt={event.title} className="w-full h-[260px] object-cover rounded-t-lg" />
        )}
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <span className="pill blue inline-flex items-center gap-[5px] w-fit rounded-full px-3 py-2 text-xs font-semibold text-white bg-blue">{event.type}</span>
              <h2 className="mt-[14px] mb-[10px] text-2xl tracking-tight">{event.title}</h2>
              <div className="flex items-center gap-4 my-2 text-text-2 text-[15px]">
                <span className="flex items-center gap-2"><Icon name="schedule" /> {formatTime(event.time)}</span>
                <span className="flex items-center gap-2"><Icon name="location_on" /> {event.place}</span>
              </div>
            </div>
          </div>
          {event.description && (
            <div className="my-4 p-4 bg-surface-soft rounded-md">
              <PlainTextContent className="m-0 text-text-2 text-sm leading-relaxed" content={event.description} />
            </div>
          )}
          {hasApplicantInfo && (
            <div className="my-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-blue-700 text-sm font-semibold mb-2">申请人信息</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {event.applicantName && <p><span className="text-text-3">姓名：</span>{event.applicantName}</p>}
                {event.applicantStudentId && <p><span className="text-text-3">学号：</span>{event.applicantStudentId}</p>}
                {event.applicantPhone && <p><span className="text-text-3">手机：</span>{event.applicantPhone}</p>}
                {event.applicantQQ && <p><span className="text-text-3">QQ：</span>{event.applicantQQ}</p>}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-4 pt-4 border-t border-line-soft">
            <span className="text-text-3 text-xs">提交时间：{event.createdAt ? new Date(event.createdAt).toLocaleString('zh-CN') : '刚刚'}</span>
            <button className="primary-button inline-flex items-center justify-center gap-[7px] border-0 rounded-full px-[18px] py-[10px] text-white bg-blue font-bold shadow-sm transition-all duration-150 hover:-translate-y-px hover:bg-blue-2" onClick={onClose} type="button">关闭</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RejectionModal({ onClose, onSubmit }) {
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  const handleSubmit = () => {
    const reason = selectedReason === 'other' ? customReason : selectedReason;
    if (reason.trim()) {
      onSubmit(reason);
    }
  };

  const canSubmit = selectedReason && (selectedReason !== 'other' || customReason.trim());

  return (
    <div className="modal-overlay fixed inset-0 z-[150] grid place-items-center bg-black/40 animate-modal-fade-in" onClick={onClose}>
      <div className="modal-content w-[min(500px,90vw)] rounded-lg bg-white shadow-md animate-modal-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <h2 className="text-2xl tracking-tight mb-2">拒绝活动</h2>
          <p className="text-text-2 text-sm mb-6">请选择拒绝理由，该反馈将发送给申请人。</p>

          <div className="space-y-2 mb-4">
            {REJECTION_REASONS.map((reason) => (
              <button
                key={reason}
                className={`w-full text-left px-4 py-3 border rounded-md text-sm transition-colors duration-150 ${
                  selectedReason === reason
                    ? 'border-blue bg-blue-soft text-blue font-semibold'
                    : 'border-line-soft bg-white text-text-2 hover:bg-surface-soft'
                }`}
                onClick={() => { setSelectedReason(reason); setCustomReason(''); }}
                type="button"
              >
                {reason}
              </button>
            ))}
            <button
              className={`w-full text-left px-4 py-3 border rounded-md text-sm transition-colors duration-150 ${
                selectedReason === 'other'
                  ? 'border-blue bg-blue-soft text-blue font-semibold'
                  : 'border-line-soft bg-white text-text-2 hover:bg-surface-soft'
              }`}
              onClick={() => setSelectedReason('other')}
              type="button"
            >
              其他（请说明）
            </button>
          </div>

          {selectedReason === 'other' && (
            <textarea
              autoFocus
              className="w-full min-h-[80px] p-3 border border-line rounded-md bg-white text-text text-sm resize-y mb-4"
              placeholder="请输入拒绝理由..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
            />
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-line-soft">
            <button className="secondary-button inline-flex items-center justify-center gap-[7px] border border-line rounded-full px-4 py-[10px] bg-white text-text-2 text-sm font-semibold transition-all duration-150" onClick={onClose} type="button">取消</button>
            <button className="primary-button inline-flex items-center justify-center gap-[7px] border-0 rounded-full px-[18px] py-[10px] text-white bg-blue font-bold shadow-sm transition-all duration-150 hover:-translate-y-px hover:bg-blue-2 disabled:opacity-50 disabled:cursor-not-allowed" onClick={handleSubmit} disabled={!canSubmit} type="button">确认拒绝</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default { EventDetailModal, RejectionModal };
