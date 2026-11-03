import { useEffect, useRef, useState } from 'react';

export default function useBookmarkSelection({ scope, visibleIds, onMove, onRemove, onRefresh }) {
  const [managing, setManaging] = useState(false);
  const [selected, setSelected] = useState([]);
  const [target, setTarget] = useState('');
  const [choosingTarget, setChoosingTarget] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const requestRef = useRef(false);
  const scopeRef = useRef({ key: scope });
  const mounted = useRef(true);
  const resultRef = useRef(null);
  const manageRef = useRef(null);
  const moveRef = useRef(null);
  if (scopeRef.current.key !== scope) scopeRef.current = { key: scope };

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    setSelected([]);
    setTarget('');
    setChoosingTarget(false);
    setConfirming(false);
    setMessage('');
  }, [scope]);

  const visibleKey = visibleIds.join(',');
  useEffect(() => {
    const valid = new Set(visibleKey.split(','));
    setSelected((ids) => ids.filter((id) => valid.has(id)));
  }, [visibleKey]);

  const toggle = (id) => {
    if (requestRef.current) return;
    setSelected((ids) => ids.includes(id) ? ids.filter((value) => value !== id)
      : ids.length < 100 ? [...ids, id] : ids);
    setMessage('');
  };

  const execute = async (kind) => {
    if (requestRef.current || !selected.length || (kind === 'move' && !target)) return;
    requestRef.current = true;
    setPending(true);
    setMessage('');
    const submittedScope = scopeRef.current;
    const ids = [...selected];
    try {
      const data = await (kind === 'move' ? onMove(ids, target) : onRemove(ids));
      if (!mounted.current || scopeRef.current !== submittedScope) return;
      const results = data.results || [];
      const count = (statuses) => results.filter((item) => statuses.includes(item.status)).length;
      const failed = results.filter((item) => item.status === 'failed').map((item) => item.postId);
      setSelected(failed);
      setConfirming(false);
      setChoosingTarget(kind === 'move' && failed.length > 0);
      const parts = [
        count(['moved', 'removed']) && `已${kind === 'move' ? '移动' : '取消收藏'} ${count(['moved', 'removed'])} 篇`,
        count(['unchanged']) && `${count(['unchanged'])} 篇${kind === 'move' ? '已在目标收藏夹' : '已取消收藏'}`,
        count(['not_found', 'not_saved']) && `${count(['not_found', 'not_saved'])} 篇已失效或已取消收藏`,
        failed.length && `${failed.length} 篇失败，请重试`,
        data.reconciling && '分类同步待恢复，请刷新核对',
      ].filter(Boolean);
      setMessage(parts.join('，'));
      if (!failed.length) setTarget('');
    } catch (error) {
      if (!mounted.current || scopeRef.current !== submittedScope) return;
      setConfirming(false);
      setMessage(error.status === 409 ? '收藏已更新，请核对列表后重试。' : error.message || '操作失败，请重试');
      if (error.status === 404) await onRefresh?.().catch(() => {});
      if (!mounted.current || scopeRef.current !== submittedScope) return;
    } finally {
      requestRef.current = false;
      if (mounted.current) setPending(false);
    }
  };

  useEffect(() => {
    if (message && !choosingTarget) resultRef.current?.focus();
  }, [message, choosingTarget]);

  const openTarget = () => { setMessage(''); setChoosingTarget(true); };

  const finish = () => {
    setManaging(false);
    setSelected([]);
    setTarget('');
    setChoosingTarget(false);
    setMessage('');
    requestAnimationFrame(() => manageRef.current?.focus());
  };

  const selectAll = () => {
    const candidates = visibleIds.slice(0, 100);
    setSelected(candidates.every((id) => selected.includes(id)) ? [] : candidates);
  };

  return { managing, setManaging, selected, toggle, selectAll, target, setTarget,
    choosingTarget, setChoosingTarget, openTarget, confirming, setConfirming, pending, message,
    execute, finish, resultRef, manageRef, moveRef };
}
