import React, { useRef, useState } from 'react';
import Icon from './Icon';
import useUiStore from '../../store/uiStore';
import { fileToOptimizedDataUrl } from '../../utils/image';

// Drafts and in-flight operations follow the discussion across page remounts.
export default function ResponseInput({ label = '评论内容', placeholder = '写下回应，或给洞主一点支持…', submitLabel = '发送评论', onSubmit, onCancel, autoFocus = false, draftKey }) {
  const sharedDraft = useUiStore((s) => draftKey ? s.responseDrafts[draftKey] : undefined);
  const sharedActivity = useUiStore((s) => draftKey ? s.responseActivities[draftKey] : undefined);
  const [localText, setLocalText] = useState('');
  const [localImage, setLocalImage] = useState('');
  const [localActivity, setLocalActivity] = useState(null);
  const activityRef = useRef(null);
  const text = draftKey ? sharedDraft?.text || '' : localText;
  const image = draftKey ? sharedDraft?.image || '' : localImage;
  const textRef = useRef(text);
  textRef.current = text;
  const activity = draftKey ? sharedActivity : localActivity;
  const pending = activity?.kind === 'send';
  const processingImage = activity?.kind === 'image';
  const error = activity?.error || '';
  const fileRef = useRef(null);
  const saveDraft = (nextText, nextImage) => {
    if (draftKey) useUiStore.setState((s) => ({ responseDrafts: { ...s.responseDrafts, [draftKey]: { text: nextText, image: nextImage } } }));
    else { setLocalText(nextText); setLocalImage(nextImage); }
    textRef.current = nextText;
  };
  const currentActivity = () => draftKey ? useUiStore.getState().responseActivities[draftKey] : activityRef.current;
  const setActivity = (next) => {
    if (draftKey) useUiStore.setState((s) => ({ responseActivities: { ...s.responseActivities, [draftKey]: next } }));
    else { activityRef.current = next; setLocalActivity(next); }
  };
  const begin = (kind) => {
    if (currentActivity()?.kind) return null;
    const token = {};
    setActivity({ kind, token, error: '' });
    return token;
  };
  const owns = (token) => currentActivity()?.token === token;
  const finish = (token, message = '') => {
    if (owns(token)) setActivity({ kind: '', error: message });
  };
  const submit = async (event) => {
    event.preventDefault();
    if (!text.trim() && !image) return;
    const token = begin('send');
    if (!token) return;
    const sentDraft = draftKey ? useUiStore.getState().responseDrafts[draftKey] : null;
    try {
      await onSubmit(text.trim(), image);
      if (!owns(token)) return;
      if (!draftKey || useUiStore.getState().responseDrafts[draftKey] === sentDraft) saveDraft('', '');
      finish(token);
    } catch (err) { finish(token, err.message || '发送失败，内容已保留，请重试。'); }
  };
  const attachImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const token = begin('image');
    if (!token) return;
    try {
      const url = await fileToOptimizedDataUrl(file);
      if (!owns(token)) return;
      const latestText = draftKey ? useUiStore.getState().responseDrafts[draftKey]?.text || '' : textRef.current;
      saveDraft(latestText, url);
      finish(token);
    } catch (err) { finish(token, err.message || '图片处理失败，请重新选择。'); }
  };
  return (
    <form className="response-input" onSubmit={submit} aria-label={label}>
      <textarea aria-label={label} placeholder={placeholder} value={text} onChange={(e) => saveDraft(e.target.value, image)} disabled={pending} autoFocus={autoFocus} />
      {image && <div className="response-image"><img src={image} alt="待发送的图片" /><button type="button" disabled={pending || processingImage} onClick={() => saveDraft(text, '')}>移除图片</button></div>}
      {error && <p className="inline-error" role="alert">{error}</p>}
      <div className="response-actions">
        <button className="icon-button" type="button" disabled={pending || processingImage} aria-label="添加图片" onClick={() => fileRef.current?.click()}><Icon name="image" /></button>
        <input hidden ref={fileRef} type="file" accept="image/*" onChange={attachImage} />
        <span className="response-hint" role="status">{processingImage ? '正在处理图片…' : '友善交流，认真回应'}</span>
        {onCancel && <button type="button" className="text-button" disabled={pending} onClick={onCancel}>取消</button>}
        <button className="primary-button" type="submit" disabled={pending || processingImage || (!text.trim() && !image)}>{pending ? '发送中…' : submitLabel}</button>
      </div>
    </form>
  );
}
