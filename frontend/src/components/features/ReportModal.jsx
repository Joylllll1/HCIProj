import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import Icon from '../common/Icon';

function ReportModal({ targetId, targetType, onClose, onSubmit }) {
  const [selectedReason, setSelectedReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const reasons = ['辱骂/攻击', '敏感内容', '垃圾广告', '虚假信息', '其他'];

  const handleSubmit = () => {
    if (!selectedReason) return;
    if (selectedReason === '其他' && !otherReason.trim()) return;

    const finalReason = selectedReason === '其他' ? otherReason : selectedReason;
    onSubmit(targetId, finalReason);
  };

  if (!mounted) return null;

  const modalContent = (
    <div className="modal-overlay fixed inset-0 z-[150] grid place-items-center bg-black/40 backdrop-blur-sm animate-modal-fade-in" onClick={onClose}>
      <div className="modal-content w-[min(480px,90vw)] rounded-2xl bg-white/90 backdrop-blur-md shadow-glass animate-modal-scale-in p-6 max-sm:p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl tracking-tight">举报{targetType === 'post' ? '帖子' : '评论'}</h2>
          <button
            className="grid w-8 h-8 place-items-center border-0 rounded-full bg-transparent text-text-3 hover:bg-surface-soft transition-colors duration-150"
            onClick={onClose}
            type="button"
            aria-label="关闭"
          >
            <Icon name="close" />
          </button>
        </div>

        <p className="text-text-2 text-sm mb-4">请选择举报原因：</p>

        <div className="reason-options grid gap-2 mb-4">
          {reasons.map((reason) => (
            <label
              key={reason}
              className={`reason-option flex items-center gap-3 px-4 py-3 border border-line rounded-lg cursor-pointer transition-all duration-150 ${
                selectedReason === reason
                  ? 'border-blue bg-blue-soft/50'
                  : 'hover:border-blue-soft hover:bg-surface-soft'
              }`}
            >
              <input
                type="radio"
                name="reason"
                value={reason}
                checked={selectedReason === reason}
                onChange={(e) => setSelectedReason(e.target.value)}
                className="w-4 h-4 accent-blue"
              />
              <span className="text-sm font-medium">{reason}</span>
            </label>
          ))}
        </div>

        {selectedReason === '其他' && (
          <div className="other-reason mb-4 animate-modal-fade-in">
            <label className="block text-sm font-semibold text-text-2 mb-2">请详细说明原因：</label>
            <textarea
              className="w-full px-4 py-3 border border-line rounded-lg bg-white text-text text-sm min-h-[100px] resize-y focus:outline-none focus:border-blue"
              placeholder="请输入具体的举报内容..."
              value={otherReason}
              onChange={(e) => setOtherReason(e.target.value)}
            />
          </div>
        )}

        <div className="modal-actions flex justify-end gap-2.5 mt-6 max-sm:flex-col max-sm:gap-2">
          <button
            className="secondary-button inline-flex items-center justify-center gap-[7px] border border-line rounded-full px-5 py-[10px] bg-white text-text-2 text-sm font-semibold transition-all duration-150 hover:bg-surface-soft"
            onClick={onClose}
            type="button"
          >
            取消
          </button>
          <button
            className="primary-button inline-flex items-center justify-center gap-[7px] border-0 rounded-full px-5 py-[10px] text-white bg-blue font-bold shadow-sm transition-all duration-150 hover:-translate-y-px hover:bg-blue-2 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSubmit}
            disabled={!selectedReason || (selectedReason === '其他' && !otherReason.trim())}
            type="button"
          >
            提交举报
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}

export default ReportModal;
