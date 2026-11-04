import React, { useEffect, useId, useRef, useState } from 'react';
import Icon from '../common/Icon';
import TopicInput, { addQuickTopic } from '../common/TopicInput';
import usePostStore from '../../store/postStore';
import useUiStore, { normalizeQuickDraft } from '../../store/uiStore';
import useAuthStore from '../../store/authStore';
import { fileToOptimizedDataUrl, MAX_POST_IMAGES } from '../../utils/image';
import '../../styles/composer.css';

// Curated shortcuts shared by the composer and feed, not a registry of every user tag.
export const FEED_TOPICS = ['校园生活', '学习交流', '求助', '随手记录', '闲置交易'];

const MAX_INLINE_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_INLINE_IMAGES_TOTAL_BYTES = 8 * 1024 * 1024;

const getAccountId = () => {
  const id = useAuthStore.getState().user?._id;
  return id == null ? null : String(id);
};

const getEncodedBytes = (value) => new Blob([value]).size;

function QuickCompose() {
  const draft = useUiStore((state) => state.quickDraft);
  const submitting = useUiStore((state) => state.quickSubmitting);
  const publishError = useUiStore((state) => state.quickPublishError);
  const quickImageProcessingCount = useUiStore((state) => state.quickImageProcessingCount);
  const accountValue = useAuthStore((state) => state.user?._id);
  const accountId = accountValue == null ? null : String(accountValue);
  const [tagInput, setTagInput] = useState('');
  const [topicExpanded, setTopicExpanded] = useState(false);
  const topicTriggerRef = useRef(null);
  const topicEditorId = useId();
  const [error, setError] = useState('');
  const [showImageHint, setShowImageHint] = useState(false);
  const fileRef = useRef(null);
  const tagAccountRef = useRef(getAccountId());
  const quickDraft = normalizeQuickDraft(draft);
  const processing = quickImageProcessingCount > 0;
  const canPublish = Boolean(quickDraft.content.trim() || quickDraft.images.length);

  useEffect(() => {
    if (tagAccountRef.current === accountId) return;
    tagAccountRef.current = accountId;
    setTagInput('');
    setTopicExpanded(false);
    setError('');
  }, [accountId]);

  const updateDraft = (patch) => useUiStore.getState().updateQuickDraft(patch);

  const commitPendingTopic = () => {
    const latest = normalizeQuickDraft(useUiStore.getState().quickDraft);
    if (tagAccountRef.current !== getAccountId()) {
      setTagInput('');
      return latest;
    }
    const tags = addQuickTopic(latest.tags, tagInput);
    if (tags !== latest.tags) updateDraft({ tags });
    setTagInput('');
    return { ...latest, tags };
  };

  const submit = async (event) => {
    event.preventDefault();
    const currentUi = useUiStore.getState();
    if (currentUi.quickSubmitting || currentUi.quickImageProcessingCount > 0 || !canPublish) return;

    const latest = commitPendingTopic();
    if (!latest.content.trim() && !latest.images.length) return;
    const ownerAccountId = getAccountId();
    const owner = useUiStore.getState().beginQuickPublish();
    if (!owner) return;

    setError('');
    const payload = {
      title: latest.title.trim(),
      content: latest.content.trim(),
      tags: latest.tags.length ? latest.tags : ['树洞'],
      images: [...latest.images],
    };

    try {
      await usePostStore.getState().addPost(payload);

      if (getAccountId() === ownerAccountId) {
        useUiStore.getState().clearQuickDraftIfOwned(owner);
        useUiStore.getState().setQuery('');
        useUiStore.getState().setFeedTag('');
        useUiStore.getState().showToast('树洞已发布');
        useUiStore.getState().finishQuickPublish(owner);

        try {
          await usePostStore.getState().fetchPosts(1, '', { sort: 'latest', tag: '' });
        } catch {
          // The post was created. The feed keeps its own refresh error and retry state.
        }
      }
    } catch (submitError) {
      const current = useUiStore.getState();
      if (getAccountId() === ownerAccountId
        && current.quickActivity === owner.activity
        && current.quickDraftGeneration === owner.generation) {
        useUiStore.getState().setQuickPublishError(owner, submitError.message || '发布失败，内容已保留，请重试。');
      }
    } finally {
      useUiStore.getState().finishQuickPublish(owner);
    }
  };

  const addImageFiles = async (files) => {
    if (!files.length || submitting) return;
    setShowImageHint(false);

    const latest = normalizeQuickDraft(useUiStore.getState().quickDraft);
    const currentUi = useUiStore.getState();
    const available = Math.max(0, MAX_POST_IMAGES - latest.images.length - currentUi.quickImageProcessingCount);
    if (!available) {
      setError(`最多上传 ${MAX_POST_IMAGES} 张图片。`);
      return;
    }

    const selectedFiles = files.slice(0, available);
    if (files.length > selectedFiles.length) {
      setError(`最多上传 ${MAX_POST_IMAGES} 张图片，本次已忽略超出数量的图片。`);
    } else {
      setError('');
    }

    const { quickDraftGeneration } = useUiStore.getState();
    const ownerAccountId = getAccountId();
    const imageJobId = useUiStore.getState().beginQuickImageProcessing(selectedFiles.length);

    try {
      const imageResults = await Promise.allSettled(selectedFiles.map((file) => fileToOptimizedDataUrl(file)));
      const failedImage = imageResults.find((result) => result.status === 'rejected');
      if (failedImage) throw failedImage.reason;
      const images = imageResults.map((result) => result.value);
      if (getAccountId() !== ownerAccountId
        || useUiStore.getState().quickDraftGeneration !== quickDraftGeneration) return;

      if (images.some((image) => !/^data:image\/[a-z0-9.+-]+;base64,/i.test(image))) {
        throw new Error('图片格式无效，请重新选择图片。');
      }
      if (images.some((image) => getEncodedBytes(image) > MAX_INLINE_IMAGE_BYTES)) {
        throw new Error('单张图片不能超过 3MB，请重新选择图片。');
      }

      const currentDraft = normalizeQuickDraft(useUiStore.getState().quickDraft);
      const totalBytes = [...currentDraft.images, ...images]
        .reduce((sum, image) => sum + getEncodedBytes(image), 0);
      if (totalBytes > MAX_INLINE_IMAGES_TOTAL_BYTES) {
        throw new Error('图片总大小不能超过 8MB，请移除部分图片后重试。');
      }
      updateDraft({ images: [...currentDraft.images, ...images] });
    } catch (imageError) {
      if (getAccountId() === ownerAccountId
        && useUiStore.getState().quickDraftGeneration === quickDraftGeneration) {
        setError(imageError.message || '图片处理失败，请重试。');
      }
    } finally {
      useUiStore.getState().finishQuickImageProcessing(imageJobId);
    }
  };

  const handleImageSelect = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    void addImageFiles(files);
  };

  const handleImagePaste = (event) => {
    const files = Array.from(event.clipboardData?.files || []).filter((file) => file.type.startsWith('image/'));
    if (!files.length) return;
    event.preventDefault();
    void addImageFiles(files);
  };

  const handleImageDrop = (event) => {
    if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return;
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files || []);
    if (!files.length) return;
    void addImageFiles(files);
  };

  const openFullEditor = () => {
    const currentUi = useUiStore.getState();
    if (currentUi.quickSubmitting || currentUi.quickImageProcessingCount > 0) return;
    const seed = commitPendingTopic();
    useUiStore.getState().navigate('compose', { composeSeed: seed });
  };

  return (
    <form
      className="quick-compose"
      onSubmit={submit}
      onPaste={handleImagePaste}
      onDragOver={(event) => {
        if (Array.from(event.dataTransfer?.types || []).includes('Files')) {
          event.preventDefault();
          event.dataTransfer.dropEffect = submitting ? 'none' : 'copy';
        }
      }}
      onDrop={handleImageDrop}
      aria-label="发布树洞"
    >
      <div className="quick-compose-heading">
        <h1>发一条树洞</h1>
        <span><Icon name="person" /> 匿名发布</span>
      </div>
      <input
        maxLength={100}
        aria-label="树洞标题（选填）"
        placeholder="标题（选填）"
        value={quickDraft.title}
        onChange={(event) => updateDraft({ title: event.target.value })}
        disabled={submitting}
      />
      <textarea
        maxLength={1000}
        aria-label="树洞内容"
        placeholder="此刻，有什么想说的？"
        value={quickDraft.content}
        onChange={(event) => updateDraft({ content: event.target.value })}
        disabled={submitting}
      />

      <TopicInput
        tags={quickDraft.tags}
        value={tagInput}
        suggestions={FEED_TOPICS}
        onValueChange={setTagInput}
        onChange={(tags) => updateDraft({ tags })}
        disabled={submitting}
        expanded={topicExpanded}
        onClose={() => setTopicExpanded(false)}
        triggerRef={topicTriggerRef}
        editorId={topicEditorId}
      />

      {quickDraft.images.length > 0 && (
        <div className="quick-image-previews" aria-label="待发布图片">
          {quickDraft.images.map((image, index) => (
            <div className="quick-image-preview" key={`${index}-${image.slice(0, 32)}`}>
              <img src={image} alt={`待发布图片 ${index + 1}`} />
              <button
                type="button"
                aria-label={`移除第 ${index + 1} 张图片`}
                title="移除图片"
                disabled={submitting}
                onClick={() => updateDraft({ images: useUiStore.getState().quickDraft.images.filter((_, imageIndex) => imageIndex !== index) })}
              >
                <Icon name="close" />
              </button>
            </div>
          ))}
        </div>
      )}

      {(error || publishError) && (
        <p className="inline-error quick-compose-error" role="alert">{error || publishError}</p>
      )}

      {showImageHint && (
        <p className="quick-image-hint" id="quick-image-hint">
          没有弹出选择框？可在正文中粘贴截图，或将图片拖入发布框。
        </p>
      )}

      <div className="quick-compose-actions">
        <div className="quick-compose-tools">
          <button
            ref={topicTriggerRef}
            className="quick-compose-control quick-topic-toggle"
            type="button"
            aria-expanded={topicExpanded}
            aria-controls={topicExpanded ? topicEditorId : undefined}
            disabled={submitting}
            onClick={() => setTopicExpanded((current) => !current)}
          >
            <Icon name="tag" />
            <span>话题</span>
          </button>
          <button
            type="button"
            className="quick-compose-control"
            aria-label="图片"
            aria-describedby={showImageHint ? 'quick-image-hint' : undefined}
            disabled={submitting || quickDraft.images.length + quickImageProcessingCount >= MAX_POST_IMAGES}
            onClick={() => {
              setShowImageHint(true);
              fileRef.current?.click();
            }}
          >
            <Icon name="image" />
            <span>图片</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={handleImageSelect}
          />
          <span className="quick-image-count" aria-live="polite">
            {quickDraft.images.length}/{MAX_POST_IMAGES} 张
            {processing && ` · 处理中 ${quickImageProcessingCount}`}
          </span>
        </div>
        <div className="quick-compose-publish">
          <button
            className="text-button quick-drafts"
            type="button"
            disabled={submitting || processing}
            onClick={openFullEditor}
          >
            完整编辑器
          </button>
          <button
            className="primary-button"
            type="submit"
            disabled={submitting || processing || !canPublish}
          >
            {submitting ? '发布中…' : processing ? '处理图片…' : '发布'}
          </button>
        </div>
      </div>
    </form>
  );
}

export default QuickCompose;
