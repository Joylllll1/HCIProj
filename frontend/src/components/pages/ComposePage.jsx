import React, { useState, useRef, useEffect, useCallback } from 'react';
import PageHeader from '../common/PageHeader';
import Icon from '../common/Icon';
import useUiStore from '../../store/uiStore';
import * as draftService from '../../services/draftService';
import { fileToOptimizedDataUrl, getImageGridLayout, MAX_POST_IMAGES } from '../../utils/image';

const selectShowToast = (s) => s.showToast;
const selectSetUnsavedChangesHandler = (s) => s.setUnsavedChangesHandler;
const selectClearUnsavedChangesHandler = (s) => s.clearUnsavedChangesHandler;
const MAX_INLINE_IMAGES_TOTAL_BYTES = 8 * 1024 * 1024;

const EMPTY_DRAFT = {
  title: '',
  content: '',
  moodType: null,
  tags: [],
  images: [],
};

const MOOD_OPTIONS = [
  ['平静', 'sentiment_satisfied', 'calm'],
  ['喜悦', 'sentiment_very_satisfied', 'happy'],
  ['焦虑', 'sentiment_neutral', 'anxious'],
  ['忧伤', 'sentiment_dissatisfied', 'sad'],
];

const normalizeDraftForm = (draft = {}) => {
  const images = Array.isArray(draft.images) && draft.images.length > 0
    ? draft.images
    : draft.image
      ? [draft.image]
      : [];

  return {
    title: draft.title || '',
    content: draft.content || '',
    moodType: draft.moodType || null,
    tags: Array.isArray(draft.tags) ? [...draft.tags] : [],
    images: [...images],
  };
};

const hasDraftChanges = (form, baseline) => {
  if (!baseline) return true;
  return form.title !== baseline.title
    || form.content !== baseline.content
    || form.moodType !== baseline.moodType
    || JSON.stringify(form.tags || []) !== JSON.stringify(baseline.tags || [])
    || JSON.stringify(form.images || []) !== JSON.stringify(baseline.images || []);
};

function ComposePage({ onPublish, draftId: initialDraftId }) {
  const [seed] = useState(() => useUiStore.getState().composeSeed);
  const [draftId, setDraftId] = useState(initialDraftId || null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [moodType, setMoodType] = useState(null);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [processingImages, setProcessingImages] = useState(false);
  const [draftLoad, setDraftLoad] = useState(() => ({
    status: initialDraftId ? 'loading' : 'idle',
    requestedId: initialDraftId || null,
    error: '',
  }));
  const [draftLoadAttempt, setDraftLoadAttempt] = useState(0);
  const [retainPublishGuard, setRetainPublishGuard] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [originalData, setOriginalData] = useState(null);
  const showToast = useUiStore(selectShowToast);
  const navigate = useUiStore((s) => s.navigate);
  const setUnsavedChangesHandler = useUiStore(selectSetUnsavedChangesHandler);
  const clearUnsavedChangesHandler = useUiStore(selectClearUnsavedChangesHandler);
  const fileInputRef = useRef(null);
  const saveDraftRef = useRef(null);
  const editorMountedRef = useRef(false);
  const mutationInFlightRef = useRef(false);
  const pendingImageFilesRef = useRef(0);
  const formValuesRef = useRef({ ...EMPTY_DRAFT });
  const imageBytesRef = useRef(new Map());
  const draftsCreatedHereRef = useRef(new Set());
  const draftUnavailable = Boolean(initialDraftId)
    && !(draftLoad.status === 'loaded' && draftLoad.requestedId === initialDraftId);
  const draftLoading = draftUnavailable
    && !(draftLoad.status === 'error' && draftLoad.requestedId === initialDraftId);
  const draftLoadFailed = draftUnavailable && !draftLoading;
  const editorDisabled = draftUnavailable || loading || processingImages;

  useEffect(() => {
    editorMountedRef.current = true;
    return () => {
      editorMountedRef.current = false;
    };
  }, []);

  const updateFormField = useCallback((field, nextValue, allowWhileProcessing = false) => {
    if (!editorMountedRef.current || draftUnavailable || loading || (processingImages && !allowWhileProcessing)) return;
    const current = formValuesRef.current;
    const value = typeof nextValue === 'function' ? nextValue(current[field]) : nextValue;
    formValuesRef.current = { ...current, [field]: value };
    const setters = {
      title: setTitle,
      content: setContent,
      moodType: setMoodType,
      tags: setTags,
      images: setImages,
    };
    setters[field](value);
  }, [draftUnavailable, loading, processingImages]);

  const applyDraftToForm = useCallback((draft) => {
    const next = normalizeDraftForm(draft);
    imageBytesRef.current = new Map(next.images.map((image, index) => [
      image, draft.imageBytes?.[index] ?? image.length,
    ]));
    formValuesRef.current = next;
    setTitle(next.title);
    setContent(next.content);
    setMoodType(next.moodType);
    setTags(next.tags);
    setImages(next.images);
    setOriginalData(next);
    setIsDirty(false);
  }, []);

  const buildDraftPayload = useCallback((form) => ({
    title: form.title.trim() || undefined,
    content: form.content.trim(),
    moodType: form.moodType,
    mood: MOOD_OPTIONS.find(([, , type]) => type === form.moodType)?.[0] || '平静',
    tags: form.tags.length > 0 ? form.tags : undefined,
    images: form.images.length > 0 ? form.images : undefined,
  }), []);

  // Sync draftId when initialDraftId changes
  useEffect(() => {
    if (initialDraftId) {
      setDraftId(initialDraftId);
      return;
    }
    setDraftId(null);
    setLastSavedAt(null);
    applyDraftToForm(seed || EMPTY_DRAFT);
    if (seed) {
      setOriginalData(EMPTY_DRAFT);
      useUiStore.setState({ composeSeed: null });
      useUiStore.getState().resetQuickDraft();
    }
  }, [applyDraftToForm, initialDraftId, seed]);

  // Load draft when editing
  useEffect(() => {
    if (!initialDraftId) return undefined;
    if (draftsCreatedHereRef.current.has(initialDraftId)) {
      setDraftLoad((current) => (
        current.status === 'loaded' && current.requestedId === initialDraftId
          ? current
          : { status: 'loaded', requestedId: initialDraftId, error: '' }
      ));
      return undefined;
    }
    let cancelled = false;
    setDraftLoad({ status: 'loading', requestedId: initialDraftId, error: '' });

    const loadDraft = async () => {
      try {
        const draft = await draftService.fetchDraftById(initialDraftId);
        if (cancelled) return;
        setDraftId(draft.id);
        setLastSavedAt(draft.updatedAt);
        applyDraftToForm(draft);
        setDraftLoad({ status: 'loaded', requestedId: initialDraftId, error: '' });
      } catch (err) {
        console.error('加载草稿失败:', err);
        if (!cancelled) {
          setDraftLoad({
            status: 'error',
            requestedId: initialDraftId,
            error: err.message || '加载草稿失败',
          });
        }
      }
    };

    loadDraft();
    return () => {
      cancelled = true;
    };
  }, [applyDraftToForm, draftLoadAttempt, initialDraftId]);

  // Track dirty state
  useEffect(() => {
    if (!originalData) return;
    const changed = hasDraftChanges({ title, content, moodType, tags, images }, originalData);
    setIsDirty(changed);
  }, [title, content, moodType, tags, images, originalData]);

  const addTag = (t) => {
    const cleaned = t.trim().replace(/^#/, '');
    if (cleaned && !formValuesRef.current.tags.includes(cleaned)) {
      updateFormField('tags', [...formValuesRef.current.tags, cleaned]);
    }
    setTagInput('');
  };

  const removeTag = (t) => {
    updateFormField('tags', (current) => current.filter((tag) => tag !== t));
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (mutationInFlightRef.current || draftUnavailable || loading) {
      e.target.value = '';
      return;
    }

    const remaining = MAX_POST_IMAGES - formValuesRef.current.images.length - pendingImageFilesRef.current;
    if (remaining <= 0) {
      showToast(`最多上传 ${MAX_POST_IMAGES} 张图片`);
      e.target.value = '';
      return;
    }

    const selectedFiles = files.slice(0, remaining);
    pendingImageFilesRef.current += selectedFiles.length;
    setProcessingImages(true);
    Promise.all(selectedFiles.map((file) => fileToOptimizedDataUrl(file)))
      .then((urls) => {
        updateFormField('images', (current) => {
          const next = [...current, ...urls].slice(0, MAX_POST_IMAGES);
          const totalBytes = next.reduce((sum, image) => sum + (imageBytesRef.current.get(image) ?? image.length), 0);
          if (totalBytes > MAX_INLINE_IMAGES_TOTAL_BYTES) {
            showToast('图片总大小不能超过 8MB，请移除部分图片后重试。');
            return current;
          }
          return next;
        }, true);
      })
      .catch((err) => {
        if (editorMountedRef.current) showToast(err.message || '读取图片失败');
      })
      .finally(() => {
        pendingImageFilesRef.current = Math.max(0, pendingImageFilesRef.current - selectedFiles.length);
        if (editorMountedRef.current) setProcessingImages(pendingImageFilesRef.current > 0);
      });

    e.target.value = '';
  };

  const canPublish = content.trim().length > 0 || images.length > 0;
  const canSaveDraft = content.trim().length > 0 || images.length > 0;
  const persistDraftSnapshot = useCallback(async (form, targetDraftId) => {
    if (!editorMountedRef.current) return null;
    if (!form.content.trim() && form.images.length === 0) {
      showToast('请先填写正文或上传图片');
      return null;
    }
    const data = buildDraftPayload(form);
    let savedDraft;
    if (targetDraftId) {
      savedDraft = await draftService.updateDraft(targetDraftId, data);
    } else {
      savedDraft = await draftService.createDraft(data);
    }
    if (!editorMountedRef.current) return savedDraft;

    if (!targetDraftId) {
      draftsCreatedHereRef.current.add(savedDraft.id);
      setDraftId(savedDraft.id);
      setDraftLoad({ status: 'loaded', requestedId: savedDraft.id, error: '' });
      window.history.replaceState(window.history.state, '', `/compose?draftId=${savedDraft.id}`);
      useUiStore.setState({ draftId: savedDraft.id });
    }

    setDraftId(savedDraft.id);
    setLastSavedAt(savedDraft.updatedAt);
    const savedForm = normalizeDraftForm(savedDraft);
    // The server replaces uploaded data with media URLs; map only the submitted
    // images, preserving any edits made while the save request was pending.
    const savedImageUrls = new Map();
    form.images.forEach((image, index) => {
      const occurrences = savedImageUrls.get(image) || [];
      occurrences.push(savedForm.images[index] ?? image);
      savedImageUrls.set(image, occurrences);
    });
    savedForm.images.forEach((image, index) => {
      imageBytesRef.current.set(image, savedDraft.imageBytes?.[index] ?? form.images[index]?.length ?? image.length);
    });
    const currentForm = formValuesRef.current;
    const currentImages = currentForm.images.map((image) => savedImageUrls.get(image)?.shift() ?? image);
    formValuesRef.current = { ...currentForm, images: currentImages };
    setImages(currentImages);
    setOriginalData(savedForm);
    const hasFurtherChanges = hasDraftChanges(formValuesRef.current, savedForm);
    setIsDirty(hasFurtherChanges);
    showToast(hasFurtherChanges ? '已保存，之后的修改尚未保存' : '已保存');
    return savedDraft;
  }, [buildDraftPayload, showToast]);

  const handleSaveDraft = useCallback(async () => {
    if (!editorMountedRef.current || mutationInFlightRef.current || draftUnavailable) return null;
    if (pendingImageFilesRef.current > 0) {
      showToast('请等待图片处理完成');
      return null;
    }

    const snapshot = normalizeDraftForm(formValuesRef.current);
    if (!snapshot.content.trim() && snapshot.images.length === 0) {
      showToast('请先填写正文或上传图片');
      return null;
    }

    mutationInFlightRef.current = true;
    setSaving(true);
    try {
      return await persistDraftSnapshot(snapshot, draftId);
    } catch (err) {
      if (editorMountedRef.current) showToast(err.message || '保存失败');
      return null;
    } finally {
      mutationInFlightRef.current = false;
      if (editorMountedRef.current) setSaving(false);
    }
  }, [draftId, draftUnavailable, persistDraftSnapshot, showToast]);

  useEffect(() => {
    saveDraftRef.current = handleSaveDraft;
  }, [handleSaveDraft]);

  const handlePublish = async () => {
    if (!editorMountedRef.current || mutationInFlightRef.current || draftUnavailable) return;
    if (pendingImageFilesRef.current > 0) {
      showToast('请等待图片处理完成');
      return;
    }
    const snapshot = normalizeDraftForm(formValuesRef.current);
    if (!snapshot.content.trim() && snapshot.images.length === 0) return;

    mutationInFlightRef.current = true;
    setLoading(true);
    setRetainPublishGuard(true);
    try {
      if (draftId) {
        let publishTargetId = draftId;
        if (hasDraftChanges(snapshot, originalData)) {
          const savedDraft = await persistDraftSnapshot(snapshot, draftId);
          if (!savedDraft?.id) {
            return;
          }
          if (!editorMountedRef.current) return;
          publishTargetId = savedDraft.id;
        }
        await draftService.publishDraft(publishTargetId);
        if (!editorMountedRef.current) return;
        draftsCreatedHereRef.current.delete(publishTargetId);
        showToast('发布成功');
        window.history.replaceState(window.history.state, '', '/compose');
        useUiStore.setState({ draftId: null });
      } else {
        await onPublish({
          title: snapshot.title.trim() || '无标题',
          content: snapshot.content.trim(),
          mood: MOOD_OPTIONS.find(([, , type]) => type === snapshot.moodType)?.[0] || '平静',
          moodType: snapshot.moodType || 'calm',
          tags: snapshot.tags.length > 0 ? snapshot.tags : ['树洞'],
          images: snapshot.images,
        });
      }
      if (!editorMountedRef.current) return;
      setDraftId(null);
      setLastSavedAt(null);
      applyDraftToForm(EMPTY_DRAFT);
      setRetainPublishGuard(false);
      clearUnsavedChangesHandler();
      navigate('home', undefined, { force: true });
    } catch (err) {
      if (editorMountedRef.current) showToast(err.message || '发布失败');
    } finally {
      mutationInFlightRef.current = false;
      if (editorMountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (!isDirty && !retainPublishGuard) {
      clearUnsavedChangesHandler();
      return undefined;
    }

    const leaveHandler = async () => {
      if (!editorMountedRef.current) return false;
      if (mutationInFlightRef.current) {
        showToast('操作进行中，请稍后再离开');
        return false;
      }
      if (pendingImageFilesRef.current > 0) {
        showToast('图片处理中，请稍后再离开');
        return false;
      }
      const current = normalizeDraftForm(formValuesRef.current);
      if (!hasDraftChanges(current, originalData) && draftId) return true;
      const savedDraft = await saveDraftRef.current?.();
      return Boolean(savedDraft?.id);
    };

    setUnsavedChangesHandler(leaveHandler);
    return () => {
      clearUnsavedChangesHandler();
    };
  }, [draftId, isDirty, originalData, retainPublishGuard, clearUnsavedChangesHandler, setUnsavedChangesHandler, showToast]);

  useEffect(() => {
    const onBeforeUnload = (event) => {
      if (!isDirty && !retainPublishGuard) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty, retainPublishGuard]);

  const handleGoToDrafts = () => {
    navigate('drafts');
  };

  const formatSavedTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${date.getFullYear()}/${month}/${day} ${hours}:${minutes}`;
  };

  return (
    <div className="compose-page max-w-[1180px] mx-auto">
      <PageHeader title={draftId ? '编辑草稿' : '写一条树洞'} description={lastSavedAt ? `保存于 ${formatSavedTime(lastSavedAt)}` : '匿名分享你的想法，也可以先保存为草稿。'} actions={<button className="secondary-button" onClick={handleGoToDrafts} type="button">草稿箱</button>} />
      <section className="editor-card overflow-hidden rounded-lg border border-line-soft bg-surface shadow-sm">
        {draftLoading && <p className="m-0 border-b border-line-soft px-5 py-3 text-sm text-text-2" role="status">正在加载草稿…</p>}
        {draftLoadFailed && (
          <div className="flex items-center justify-between gap-3 border-b border-line-soft px-5 py-3 text-sm text-text-2" role="alert">
            <span>{draftLoad.error || '加载草稿失败'}</span>
            <button type="button" className="secondary-button shrink-0" onClick={() => setDraftLoadAttempt((attempt) => attempt + 1)}>重新加载</button>
          </div>
        )}
        {processingImages && <p className="m-0 border-b border-line-soft px-5 py-2 text-sm text-text-2" role="status">图片处理中…</p>}
        <fieldset disabled={editorDisabled} className="m-0 min-w-0 border-0 p-0">
        <input
          className="w-full p-[18px_20px] max-sm:p-[14px] border-b border-line-soft bg-transparent text-xl max-sm:text-lg font-bold"
          aria-label="树洞标题（选填）"
          placeholder="给这条树洞起个标题（选填）"
          value={title}
          onChange={(e) => updateFormField('title', e.target.value)}
        />
        <textarea
          className="w-full min-h-[240px] max-sm:min-h-[180px] p-5 max-sm:p-3 border-0 bg-transparent text-base leading-relaxed resize-y"
          maxLength={1000}
          onChange={(e) => updateFormField('content', e.target.value)}
          aria-label="树洞内容"
          placeholder="从一句话开始，慢慢说就好…"
          value={content}
        />
        <div className="editor-tools flex flex-wrap items-center gap-3 max-sm:gap-1.5 p-[14px_20px] max-sm:p-3 border-t border-line-soft bg-surface-soft">
          <button type="button" className="inline-flex items-center gap-1.5 px-[10px] py-2 border border-dashed border-[#ccc] rounded-sm bg-surface text-text-2 font-semibold cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <Icon name="image" /> {images.length > 0 ? '继续添加图片' : '添加图片'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleImageSelect} />
          <button type="button" className="inline-flex items-center gap-1.5 px-[10px] py-2 border border-dashed border-[#ccc] rounded-sm bg-surface text-text-2 font-semibold cursor-pointer" onClick={() => setShowTagInput(!showTagInput)}>
            <Icon name="tag" /> 添加话题
          </button>
          <span className="ml-auto text-text-3 text-[13px] font-bold">{content.length}/1000</span>
        </div>
        {images.length > 0 && (
          <div className="editor-image-preview border-t border-line-soft bg-surface-soft p-3 max-sm:p-2">
            <div className={`editor-image-grid grid gap-2 ${getImageGridLayout(images.length).gridClass}`}>
              {images.map((src, index) => (
                <div key={`${src}-${index}`} className={`editor-image-cell relative overflow-hidden rounded-md bg-surface-soft ${getImageGridLayout(images.length).itemClass}`}>
                  <img
                    src={src}
                    alt={`待发布图片 ${index + 1}`}
                    className={images.length === 1 ? 'editor-single-image' : 'h-full w-full object-cover'}
                  />
                  <button
                    onClick={() => updateFormField('images', (current) => current.filter((_, i) => i !== index))}
                    type="button"
                    className="editor-image-remove absolute top-2 right-2 grid w-7 h-7 place-items-center px-0 py-0 border-0 rounded-full bg-black/55 text-white text-lg cursor-pointer"
                    aria-label={`删除第 ${index + 1} 张图片`}
                  >
                    &times;
                  </button>
                </div>
              ))}
              {images.length < MAX_POST_IMAGES && (
                <button
                  type="button"
                  className={`grid min-h-[100px] place-items-center rounded-md border border-dashed border-line-soft bg-surface text-text-2 transition-colors duration-150 hover:border-blue hover:text-blue ${getImageGridLayout(images.length + 1).itemClass}`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span className="flex flex-col items-center gap-1 text-sm font-semibold">
                    <Icon name="add" />
                    <span>继续添加</span>
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
        {(tags.length > 0 || showTagInput) && (
          <div className="editor-tag-area p-3 border-t border-line-soft bg-surface-soft">
            {tags.length > 0 && (
              <div className="editor-tags flex flex-wrap gap-2">
                {tags.map((t) => (
                  <span className="editor-tag inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-soft text-blue text-sm font-semibold" key={t}>
                    #{t}
                    <button onClick={() => removeTag(t)} type="button" className="editor-tag-close grid w-6 h-6 place-items-center px-0 py-0 border-0 rounded-full bg-transparent text-blue text-base cursor-pointer opacity-60 transition-opacity duration-150 hover:opacity-100" aria-label={`移除话题 ${t}`}>&times;</button>
                  </span>
                ))}
              </div>
            )}
            {showTagInput && (
              <>
                <div className="tag-input-inline flex items-center mt-2">
                  <span className="tag-input-inline-htag flex items-center justify-center w-9 h-9 border border-line border-r-0 rounded-l-sm bg-blue-soft text-blue text-base font-bold">#</span>
                  <input
                    autoFocus
                    className="h-9 min-w-0 flex-1 px-2.5 border border-line bg-surface text-sm"
                    placeholder="输入话题"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); } }}
                  />
                  <button type="button" className="h-9 px-[14px] border border-l-0 border-line rounded-r-sm bg-blue text-white text-sm font-bold cursor-pointer disabled:bg-surface-soft disabled:text-text-3 disabled:cursor-not-allowed" onClick={() => addTag(tagInput)} disabled={!tagInput.trim()}>添加</button>
                </div>
              </>
            )}
          </div>
        )}
        <div className="emotion-picker flex flex-wrap items-center gap-3 max-sm:gap-1.5 p-[14px_20px] max-sm:p-3 border-t border-line-soft bg-surface-soft">
          {MOOD_OPTIONS.map(([label, icon, type]) => (
            <button
              className={`mood mood-${type} inline-flex items-center gap-[5px] px-[10px] py-2 border border-transparent rounded-full text-xs font-semibold leading-none cursor-pointer ${moodType === type ? 'selected' : ''}`}
              key={label}
              aria-pressed={moodType === type}
              onClick={() => updateFormField('moodType', type)}
              type="button"
            >
              <Icon name={icon} /> {label}
            </button>
          ))}
        </div>
        <div className="publish-row flex flex-wrap items-center justify-between gap-3 p-[14px_20px] max-sm:p-3 border-t border-line-soft bg-surface-soft">
          <p className="publish-hint m-0 text-text-3 text-sm font-medium">
            {title.trim() && !canSaveDraft
              ? '标题不能单独保存；请补充正文或上传图片。'
              : '将以匿名身份发布，身份在帖子内保持一致'}
          </p>
          <div className="flex flex-wrap gap-2.5">
            <button
              className="secondary-button inline-flex items-center justify-center gap-[7px] border border-line rounded-full px-4 py-[10px] bg-surface text-text-2 font-semibold transition-all duration-150"
              type="button"
              onClick={handleSaveDraft}
              disabled={!canSaveDraft || saving || loading || processingImages || draftUnavailable}
            >
              {saving ? '保存中...' : '保存草稿'}
            </button>
            <button
              className="primary-button inline-flex items-center justify-center gap-[7px] border-0 rounded-full px-[18px] py-[10px] text-white bg-blue font-bold shadow-sm transition-all duration-150 hover:-translate-y-px hover:bg-blue-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!canPublish || loading || saving || processingImages || draftUnavailable}
              onClick={handlePublish}
              type="button"
            >
              {loading ? '发布中...' : '发布动态'}
            </button>
          </div>
        </div>
        </fieldset>
      </section>
      <aside className="compose-guidance">
        <Icon name="verified_user" />
        <p>友善表达，保护彼此的隐私。<span>暂时没想好也没关系，可以先保存为草稿。</span></p>
      </aside>
    </div>
  );
}

export default ComposePage;
