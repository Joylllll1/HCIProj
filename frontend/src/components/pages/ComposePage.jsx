import React, { useState, useRef, useEffect, useCallback } from 'react';
import Icon from '../common/Icon';
import useUiStore from '../../store/uiStore';
import * as draftService from '../../services/draftService';
import { fileToOptimizedDataUrl, getImageGridLayout, MAX_POST_IMAGES } from '../../utils/image';

const selectShowToast = (s) => s.showToast;
const selectSetUnsavedChangesHandler = (s) => s.setUnsavedChangesHandler;
const selectClearUnsavedChangesHandler = (s) => s.clearUnsavedChangesHandler;

const EMPTY_DRAFT = {
  title: '',
  content: '',
  moodType: null,
  tags: [],
  images: [],
};

function ComposePage({ onPublish, draftId: initialDraftId }) {
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
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [originalData, setOriginalData] = useState(null);
  const showToast = useUiStore(selectShowToast);
  const navigate = useUiStore((s) => s.navigate);
  const setUnsavedChangesHandler = useUiStore(selectSetUnsavedChangesHandler);
  const clearUnsavedChangesHandler = useUiStore(selectClearUnsavedChangesHandler);
  const fileInputRef = useRef(null);
  const saveDraftRef = useRef(null);

  const moodOptions = [
    ['平静', 'sentiment_satisfied', 'calm'],
    ['喜悦', 'sentiment_very_satisfied', 'happy'],
    ['焦虑', 'sentiment_neutral', 'anxious'],
    ['忧伤', 'sentiment_dissatisfied', 'sad'],
  ];

  const moodLabel = moodOptions.find(([, , t]) => t === moodType)?.[0] || '';

  const applyDraftToForm = useCallback((draft) => {
    setTitle(draft.title || '');
    setContent(draft.content || '');
    setMoodType(draft.moodType || null);
    setTags(draft.tags || []);
    const nextImages = Array.isArray(draft.images) && draft.images.length > 0
      ? draft.images
      : draft.image
        ? [draft.image]
        : [];
    setImages(nextImages);
    setOriginalData({
      title: draft.title || '',
      content: draft.content || '',
      moodType: draft.moodType || null,
      tags: draft.tags || [],
      images: nextImages,
    });
    setIsDirty(false);
  }, []);

  const buildDraftPayload = useCallback(() => ({
    title: title.trim() || undefined,
    content: content.trim(),
    moodType,
    mood: moodLabel || '平静',
    tags: tags.length > 0 ? tags : undefined,
    images: images.length > 0 ? images : undefined,
  }), [content, images, moodLabel, moodType, tags, title]);

  // Sync draftId when initialDraftId changes
  useEffect(() => {
    if (initialDraftId) {
      setDraftId(initialDraftId);
      return;
    }
    setDraftId(null);
    setLastSavedAt(null);
    applyDraftToForm(EMPTY_DRAFT);
  }, [applyDraftToForm, initialDraftId]);

  // Load draft when editing
  useEffect(() => {
    if (!initialDraftId) return undefined;
    let cancelled = false;

    const loadDraft = async () => {
      try {
        const draft = await draftService.fetchDraftById(initialDraftId);
        if (cancelled) return;
        setDraftId(draft.id);
        setLastSavedAt(draft.updatedAt);
        applyDraftToForm(draft);
      } catch (err) {
        console.error('加载草稿失败:', err);
        if (!cancelled) {
          showToast(err.message || '加载草稿失败');
          navigate('drafts');
        }
      }
    };

    loadDraft();
    return () => {
      cancelled = true;
    };
  }, [applyDraftToForm, initialDraftId, navigate, showToast]);

  // Track dirty state
  useEffect(() => {
    if (!originalData) return;
    const changed =
      title !== originalData.title ||
      content !== originalData.content ||
      moodType !== originalData.moodType ||
      JSON.stringify(tags) !== JSON.stringify(originalData.tags) ||
      JSON.stringify(images) !== JSON.stringify(originalData.images || []);
    setIsDirty(changed);
  }, [title, content, moodType, tags, images, originalData]);

  const addTag = (t) => {
    const cleaned = t.trim().replace(/^#/, '');
    if (cleaned && !tags.includes(cleaned)) {
      setTags([...tags, cleaned]);
    }
    setTagInput('');
  };

  const removeTag = (t) => {
    setTags(tags.filter((tag) => tag !== t));
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remaining = MAX_POST_IMAGES - images.length;
    if (remaining <= 0) {
      showToast(`最多上传 ${MAX_POST_IMAGES} 张图片`);
      e.target.value = '';
      return;
    }

    const selectedFiles = files.slice(0, remaining);
    Promise.all(selectedFiles.map((file) => fileToOptimizedDataUrl(file)))
      .then((urls) => {
        setImages((prev) => [...prev, ...urls]);
      })
      .catch((err) => {
        showToast(err.message || '读取图片失败');
      });

    e.target.value = '';
  };

  const canPublish = content.trim().length > 0 || images.length > 0;

  const handleSaveDraft = useCallback(async () => {
    if (!content.trim() && !title.trim() && images.length === 0) {
      showToast('请先填写内容或上传图片');
      return;
    }
    setSaving(true);
    try {
      const data = buildDraftPayload();
      let savedDraft;
      if (draftId) {
        savedDraft = await draftService.updateDraft(draftId, data);
      } else {
        savedDraft = await draftService.createDraft(data);
        setDraftId(savedDraft.id);
        window.history.replaceState(null, '', `/compose?draftId=${savedDraft.id}`);
        useUiStore.setState({ draftId: savedDraft.id });
      }
      applyDraftToForm(savedDraft);
      setDraftId(savedDraft.id);
      setLastSavedAt(savedDraft.updatedAt);
      setIsDirty(false);
      showToast('已保存');
      return savedDraft;
    } catch (err) {
      showToast(err.message || '保存失败');
      return null;
    } finally {
      setSaving(false);
    }
  }, [applyDraftToForm, buildDraftPayload, content, draftId, images.length, showToast, title]);

  useEffect(() => {
    saveDraftRef.current = handleSaveDraft;
  }, [handleSaveDraft]);

  const handlePublish = async () => {
    setLoading(true);
    try {
      clearUnsavedChangesHandler();
      if (draftId) {
        let publishTargetId = draftId;
        if (isDirty) {
          const savedDraft = await handleSaveDraft();
          if (!savedDraft?.id) {
            return;
          }
          publishTargetId = savedDraft.id;
        }
        await draftService.publishDraft(publishTargetId);
        showToast('发布成功');
        window.history.replaceState(null, '', '/compose');
        useUiStore.setState({ draftId: null });
      } else {
        await onPublish({
          title: title.trim() || '无标题',
          content: content.trim(),
          mood: moodLabel || '平静',
          moodType: moodType || 'calm',
          tags: tags.length > 0 ? tags : ['树洞'],
          images,
        });
      }
      setDraftId(null);
      setLastSavedAt(null);
      clearUnsavedChangesHandler();
      applyDraftToForm(EMPTY_DRAFT);
      navigate('home', undefined, { force: true });
    } catch (err) {
      showToast(err.message || '发布失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isDirty) {
      clearUnsavedChangesHandler();
      return undefined;
    }

    const leaveHandler = async () => {
      const savedDraft = await saveDraftRef.current?.();
      return Boolean(savedDraft?.id);
    };

    setUnsavedChangesHandler(leaveHandler);
    return () => {
      clearUnsavedChangesHandler();
    };
  }, [isDirty, clearUnsavedChangesHandler, setUnsavedChangesHandler]);

  useEffect(() => {
    const onBeforeUnload = (event) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

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
      <div className="flex items-center justify-between mb-6 max-sm:flex-col max-sm:items-stretch max-sm:gap-3">
        <section className="compose-heading max-w-[760px] mb-0 max-sm:mb-4">
          <p className="eyebrow mb-6 text-blue text-xs font-bold tracking-widest uppercase">Create Treehole</p>
          <h1 className="m-0 text-[clamp(30px,4.2vw,44px)] leading-[1.1] tracking-tight">发布新动态</h1>
          {lastSavedAt ? (
            <p className="mt-[9px] mb-0 text-text-2">保存于 {formatSavedTime(lastSavedAt)}</p>
          ) : (
            <p className="mt-[9px] mb-0 text-text-2 leading-relaxed">分享你此刻的想法，或记录一段校园回忆。前台匿名展示，后台仅在合规审计中可追责。</p>
          )}
        </section>
        <button
          className="inline-flex items-center justify-center gap-[7px] border border-line rounded-full px-4 py-[10px] bg-white text-text-2 font-semibold transition-all duration-150 hover:bg-surface-soft"
          onClick={handleGoToDrafts}
          type="button"
        >
          草稿箱
        </button>
      </div>
      <section className="editor-card overflow-hidden rounded-lg border border-line-soft bg-surface shadow-sm">
        <input
          className="w-full p-[18px_20px] max-sm:p-[14px] border-b border-line-soft bg-transparent text-xl max-sm:text-lg font-bold"
          placeholder="在此输入标题（选填）"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="w-full min-h-[240px] max-sm:min-h-[180px] p-5 max-sm:p-3 border-0 bg-transparent text-base leading-relaxed resize-y"
          maxLength={1000}
          onChange={(e) => setContent(e.target.value)}
          placeholder="在这里写下你的内容..."
          value={content}
        />
        <div className="editor-tools flex flex-wrap items-center gap-3 max-sm:gap-1.5 p-[14px_20px] max-sm:p-3 border-t border-line-soft bg-[#fafbfc]">
          <button type="button" className="inline-flex items-center gap-1.5 px-[10px] py-2 border border-dashed border-[#ccc] rounded-sm bg-white text-text-2 font-semibold cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <Icon name="image" /> {images.length > 0 ? '继续添加图片' : '添加图片'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleImageSelect} />
          <button type="button" className="inline-flex items-center gap-1.5 px-[10px] py-2 border border-dashed border-[#ccc] rounded-sm bg-white text-text-2 font-semibold cursor-pointer" onClick={() => setShowTagInput(!showTagInput)}>
            <Icon name="tag" /> 添加话题
          </button>
          <span className="ml-auto text-text-3 text-[13px] font-bold">{content.length}/1000</span>
        </div>
        {images.length > 0 && (
          <div className="editor-image-preview border-t border-line-soft bg-[#fafbfc] p-3 max-sm:p-2">
            <div className={`grid gap-2 max-sm:grid-cols-1 ${getImageGridLayout(images.length).gridClass}`}>
              {images.map((src, index) => (
                <div key={`${src}-${index}`} className={`relative overflow-hidden rounded-md bg-surface-soft ${getImageGridLayout(images.length).itemClass} ${images.length === 1 ? 'justify-self-start w-fit max-w-full' : ''}`}>
                  <img
                    src={src}
                    alt={`preview-${index + 1}`}
                    className={images.length === 1 ? 'block h-auto max-h-[300px] max-w-full object-contain' : 'h-full w-full object-cover'}
                  />
                  <button
                    onClick={() => setImages((prev) => prev.filter((_, i) => i !== index))}
                    type="button"
                    className="editor-image-remove absolute top-2 right-2 grid w-7 h-7 place-items-center px-0 py-0 border-0 rounded-full bg-black/55 text-white text-lg cursor-pointer"
                  >
                    &times;
                  </button>
                </div>
              ))}
              {images.length < MAX_POST_IMAGES && (
                <button
                  type="button"
                  className={`grid min-h-[100px] place-items-center rounded-md border border-dashed border-line-soft bg-white text-text-2 transition-colors duration-150 hover:border-blue hover:text-blue ${getImageGridLayout(images.length + 1).itemClass}`}
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
          <div className="editor-tag-area p-3 border-t border-line-soft bg-[#fafbfc]">
            {tags.length > 0 && (
              <div className="editor-tags flex flex-wrap gap-2">
                {tags.map((t) => (
                  <span className="editor-tag inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-soft text-blue text-sm font-semibold" key={t}>
                    #{t}
                    <button onClick={() => removeTag(t)} type="button" className="editor-tag-close grid w-4 h-4 place-items-center px-0 py-0 border-0 rounded-full bg-transparent text-blue text-base cursor-pointer opacity-60 transition-opacity duration-150 hover:opacity-100">&times;</button>
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
                    className="h-9 min-w-0 flex-1 px-2.5 border border-line bg-white text-sm"
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
        <div className="emotion-picker flex flex-wrap items-center gap-3 max-sm:gap-1.5 p-[14px_20px] max-sm:p-3 border-t border-line-soft bg-[#fafbfc]">
          {moodOptions.map(([label, icon, type]) => (
            <button
              className={`mood mood-${type} inline-flex items-center gap-[5px] px-[10px] py-2 border border-transparent rounded-full text-xs font-semibold leading-none cursor-pointer ${moodType === type ? 'selected' : ''}`}
              key={label}
              onClick={() => setMoodType(type)}
              type="button"
            >
              <Icon name={icon} /> {label}
            </button>
          ))}
        </div>
        <div className="publish-row flex flex-wrap items-center justify-between gap-3 p-[14px_20px] max-sm:p-3 border-t border-line-soft bg-[#fafbfc]">
          <p className="publish-hint m-0 text-text-3 text-sm font-medium">将以匿名身份发布，身份在帖子内保持一致</p>
          <div className="flex flex-wrap gap-2.5">
            <button
              className="secondary-button inline-flex items-center justify-center gap-[7px] border border-line rounded-full px-4 py-[10px] bg-white text-text-2 font-semibold transition-all duration-150"
              type="button"
              onClick={handleSaveDraft}
              disabled={saving}
            >
              {saving ? '保存中...' : '保存草稿'}
            </button>
            <button
              className="primary-button inline-flex items-center justify-center gap-[7px] border-0 rounded-full px-[18px] py-[10px] text-white bg-blue font-bold shadow-sm transition-all duration-150 hover:-translate-y-px hover:bg-blue-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!canPublish || loading}
              onClick={handlePublish}
              type="button"
            >
              {loading ? '发布中...' : '发布动态'}
            </button>
          </div>
        </div>
      </section>
      <div className="guidance-grid grid grid-cols-2 gap-[18px] mt-[22px] max-sm:grid-cols-1">
        <section className="dark-callout overflow-hidden p-5 rounded-md text-white shadow-sm bg-[#1e3a5f]">
          <h3 className="m-0 mb-2 text-xl tracking-tight">发布贴士</h3>
          <p className="m-0 text-white/76 leading-relaxed">友善发言是树洞的基石。请遵守社区公约，避免泄露自己或他人的真实身份。</p>
        </section>
        <section className="blue-callout overflow-hidden p-5 rounded-md text-white shadow-sm bg-gradient-to-br from-[#0e4a8a] to-blue">
          <h3 className="m-0 mb-2 text-xl tracking-tight">话题推荐</h3>
          <p className="m-0 text-white/76 leading-relaxed">#期末周碎碎念 #食堂新品测评 #南大星空 #科研日常</p>
        </section>
      </div>
    </div>
  );
}

export default ComposePage;
