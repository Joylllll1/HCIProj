import React, { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../common/Icon';
import PageHeader from '../common/PageHeader';
import TimeAgo from '../common/TimeAgo';
import EmptyState from '../common/EmptyState';
import ConfirmLeaveDialog from '../common/ConfirmLeaveDialog';
import useAuthStore from '../../store/authStore';
import useUiStore from '../../store/uiStore';
import * as draftService from '../../services/draftService';

export default function DraftsPage({ onNavigate }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [drafts, setDrafts] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const deletingRef = useRef(false);
  const pageRef = useRef(null);
  const loadDrafts = useCallback(async () => {
    setLoading(true); setError('');
    try { setDrafts(await draftService.fetchDrafts()); }
    catch (err) { setError(err.message || '草稿加载失败，请重试。'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    if (!isAuthenticated) { onNavigate('login'); return; }
    loadDrafts();
  }, [isAuthenticated, onNavigate, loadDrafts]);
  const toggle = (id) => setSelectedIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const requestDelete = (items, batch = false) => {
    setDeleteError('');
    setDeleteTarget({ items, batch });
  };
  const deleteDrafts = async () => {
    if (deletingRef.current || !deleteTarget?.items.length) return;
    deletingRef.current = true;
    setDeleting(true); setDeleteError('');
    const ids = deleteTarget.items.map((draft) => draft.id);
    try {
      if (deleteTarget.batch) await draftService.deleteDrafts(ids);
      else await draftService.deleteDraft(ids[0]);
      setDrafts((items) => items.filter((item) => !ids.includes(item.id)));
      setSelectedIds(new Set()); setSelectMode(false); setDeleteTarget(null);
      useUiStore.getState().showToast(ids.length === 1 ? '草稿已删除' : `已删除 ${ids.length} 篇草稿`);
      requestAnimationFrame(() => {
        const next = pageRef.current?.querySelector('.draft-item .row-title, .page-empty button');
        next?.focus({ preventScroll: true });
      });
    } catch (err) { setDeleteError(err.message || '删除失败，请重试。'); }
    finally { deletingRef.current = false; setDeleting(false); }
  };
  const singleTarget = deleteTarget && !deleteTarget.batch ? deleteTarget.items[0] : null;
  return (
    <div className="drafts-page" ref={pageRef}>
      <PageHeader title="草稿箱" description={loading ? '正在加载草稿…' : error ? '暂时无法加载草稿，请重试。' : `${drafts.length} 篇未发布，随时继续编辑。`} actions={<>
        {drafts.length > 0 && <button className="secondary-button" type="button" aria-pressed={selectMode} onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}>{selectMode ? '退出批量管理' : '批量管理'}</button>}
        <button className="primary-button" type="button" onClick={() => onNavigate('compose')}><Icon name="add" />写树洞</button>
      </>} />
      {error && <div className="feed-error" role="alert"><span>{error}</span><button type="button" onClick={loadDrafts}>重新加载</button></div>}
      {loading ? <p className="page-loading" role="status">正在加载草稿…</p> : drafts.length ? <>
        {selectMode && <div className="selection-toolbar"><span role="status">已选 {selectedIds.size} 篇</span><button type="button" onClick={() => setSelectedIds(selectedIds.size === drafts.length ? new Set() : new Set(drafts.map((draft) => draft.id)))}>{selectedIds.size === drafts.length ? '取消全选' : '全选'}</button><button type="button" className="danger-text" disabled={!selectedIds.size} onClick={() => requestDelete(drafts.filter((draft) => selectedIds.has(draft.id)), true)}>删除选中</button></div>}
        <section className="drafts-list" aria-label="草稿列表">
          {drafts.map((draft) => <article key={draft.id} className="draft-item">
            {selectMode && <label className="draft-select"><input type="checkbox" aria-label={`选择草稿：${draft.title || '无标题'}`} checked={selectedIds.has(draft.id)} onChange={() => toggle(draft.id)} /></label>}
            <div className="draft-copy"><button className="row-title" type="button" onClick={() => selectMode ? toggle(draft.id) : onNavigate('compose', { draftId: draft.id })}>{draft.title || '无标题'}</button><p>{draft.content || '图片草稿'}</p><div className="draft-meta"><TimeAgo compact timeString={draft.updatedAt} className="row-time" />{draft.tags?.length > 0 && <span className="draft-topics">{draft.tags.map((tag) => `#${tag}`).join(' ')}</span>}</div></div>
            {!selectMode && <div className="draft-actions"><button type="button" className="row-edit" aria-label={`继续编辑：${draft.title || '无标题'}`} onClick={() => onNavigate('compose', { draftId: draft.id })}><Icon name="edit_square" /><span>继续编辑</span></button><button type="button" className="row-delete" aria-label={`删除草稿：${draft.title || '无标题'}`} onClick={() => requestDelete([draft])}><Icon name="delete" /><span>删除</span></button></div>}
          </article>)}
        </section>
      </> : !error && <div className="page-empty"><EmptyState title="还没有草稿" description="在完整编辑器中保存，之后可以接着写。" /><button className="secondary-button" type="button" onClick={() => onNavigate('compose')}>开始写树洞</button></div>}
      <ConfirmLeaveDialog open={!!deleteTarget} title={singleTarget ? '删除这篇草稿？' : `删除 ${deleteTarget?.items.length || 0} 篇草稿？`} description={singleTarget ? `“${singleTarget.title || '无标题'}”删除后无法恢复。` : '选中的草稿删除后无法恢复，请确认不再需要这些内容。'} error={deleteError} confirmText={deleting ? '删除中…' : '确认删除'} cancelText="保留草稿" mode="discard" pending={deleting} onConfirm={deleteDrafts} onCancel={() => { if (!deletingRef.current) setDeleteTarget(null); }} />
    </div>
  );
}
