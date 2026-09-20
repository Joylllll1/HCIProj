import React, { useState, useEffect } from 'react';
import Icon from '../common/Icon';
import TimeAgo from '../common/TimeAgo';
import useAuthStore from '../../store/authStore';
import * as draftService from '../../services/draftService';

const selectIsAuthenticated = (s) => s.isAuthenticated;

function DraftsPage({ onNavigate }) {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const [drafts, setDrafts] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      onNavigate('login');
      return;
    }
    loadDrafts();
  }, [isAuthenticated, onNavigate]);

  const loadDrafts = async () => {
    try {
      const data = await draftService.fetchDrafts();
      setDrafts(data);
    } catch (err) {
      console.error('加载草稿失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectToggle = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    try {
      const { deleteDrafts } = await import('../../services/draftService');
      await deleteDrafts([...selectedIds]);
      setDrafts((prev) => prev.filter((d) => !selectedIds.has(d.id)));
      setSelectedIds(new Set());
      setSelectMode(false);
    } catch (err) {
      console.error('删除草稿失败:', err);
    }
  };

  const handleEditDraft = (draftId) => {
    onNavigate('compose', { draftId });
  };

  const getContentPreview = (draft) => {
    const text = draft.content || '';
    return text.length > 80 ? text.slice(0, 80) + '...' : text;
  };

  const getTitle = (draft) => {
    return draft.title || '（无标题）';
  };

  if (loading) {
    return (
      <div className="drafts-page max-w-[1180px] mx-auto p-6">
        <div className="text-center text-text-3 py-12">加载中...</div>
      </div>
    );
  }

  return (
    <div className="drafts-page max-w-[1180px] mx-auto">
      <section className="drafts-header flex items-center justify-between mb-6">
        <div>
          <p className="eyebrow mb-6 text-blue text-xs font-bold tracking-widest uppercase">Draft Box</p>
          <h1 className="m-0 text-[clamp(30px,4.2vw,44px)] leading-[1.1] tracking-tight">我的草稿箱</h1>
          <p className="mt-[9px] mb-0 text-text-2">
            您有 {drafts.length} 篇草稿
          </p>
        </div>
        <div className="flex gap-2">
          {drafts.length > 0 && (
            <button
              className="inline-flex items-center justify-center gap-[7px] border border-line rounded-full px-4 py-[10px] bg-white text-text-2 font-semibold transition-all duration-150 hover:bg-surface-soft"
              onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
              type="button"
            >
              {selectMode ? '取消选择' : '选择'}
            </button>
          )}
          <button
            className="primary-button inline-flex items-center justify-center gap-[7px] border-0 rounded-full px-[18px] py-[10px] text-white bg-blue font-bold shadow-sm transition-all duration-150 hover:-translate-y-px hover:bg-blue-2"
            onClick={() => onNavigate('compose')}
            type="button"
          >
            发布新动态
          </button>
        </div>
      </section>

      {drafts.length === 0 ? (
        <section className="empty-state text-center py-[60px]">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-surface-soft mb-4">
            <Icon name="edit_note" className="text-text-3" style={{ fontSize: 40 }} />
          </div>
          <h2 className="text-xl font-bold text-text mb-2">暂无草稿</h2>
          <p className="text-text-3 mb-6">保存您未发布的内容，随时继续编辑</p>
          <button
            className="primary-button inline-flex items-center justify-center gap-[7px] border-0 rounded-full px-[18px] py-[10px] text-white bg-blue font-bold shadow-sm"
            onClick={() => onNavigate('compose')}
            type="button"
          >
            发布新动态
          </button>
        </section>
      ) : (
        <section className="drafts-list grid gap-3">
          {drafts.map((draft) => (
            <article
              key={draft.id}
              className={`draft-item flex gap-3 p-4 rounded-lg border border-line-soft bg-surface transition-all duration-150 hover:border-line ${selectMode ? 'cursor-default pl-2' : 'cursor-pointer'}`}
              onClick={() => { if (selectMode) { handleSelectToggle(draft.id); } else { handleEditDraft(draft.id); } }}
            >
              {selectMode && (
                <div className="flex items-center justify-center w-6 flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(draft.id)}
                    onChange={() => handleSelectToggle(draft.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded border-line text-blue focus:ring-blue"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-text truncate">{getTitle(draft)}</h3>
                <TimeAgo timeString={draft.updatedAt} className="block mt-0.5 text-text-3 text-xs" />
                <p className="mt-2 text-sm text-text-2 line-clamp-2">{getContentPreview(draft)}</p>
              </div>
            </article>
          ))}
        </section>
      )}

      {selectMode && selectedIds.size > 0 && (
        <section className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3 rounded-full bg-surface border border-line shadow-lg">
          <span className="text-sm font-semibold text-text">已选中 {selectedIds.size} 篇</span>
          <button
            className="inline-flex items-center justify-center gap-[7px] border-0 rounded-full px-4 py-2 bg-red-500 text-white text-sm font-semibold"
            onClick={handleDeleteSelected}
            type="button"
          >
            删除选中
          </button>
        </section>
      )}
    </div>
  );
}

export default DraftsPage;
