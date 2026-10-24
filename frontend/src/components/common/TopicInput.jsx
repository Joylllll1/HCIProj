import React, { useRef, useState } from 'react';
import Icon from './Icon';

export function normalizeQuickTopic(value) {
  return String(value ?? '').normalize('NFKC').replace(/^\s*#+/, '').trim();
}

const getTopicKey = (topic) => normalizeQuickTopic(topic).toLocaleLowerCase();

export function addQuickTopic(topics, value) {
  const topic = normalizeQuickTopic(value);
  if (!topic) return topics;

  const result = [];
  const seen = new Set();
  for (const current of Array.isArray(topics) ? topics : []) {
    const cleaned = normalizeQuickTopic(current);
    const key = getTopicKey(cleaned);
    if (cleaned && !seen.has(key)) {
      result.push(cleaned);
      seen.add(key);
    }
  }

  const key = getTopicKey(topic);
  if (!seen.has(key)) result.push(topic);
  return result;
}

export default function TopicInput({
  tags = [],
  value = '',
  suggestions = [],
  onValueChange,
  onChange,
  disabled = false,
  expanded = false,
  onClose,
  triggerRef,
  editorId,
}) {
  const [composing, setComposing] = useState(false);
  const composingRef = useRef(false);
  const inputRef = useRef(null);

  React.useEffect(() => {
    if (expanded && !disabled) inputRef.current?.focus();
  }, [expanded, disabled]);

  const selectedTopics = [];
  const selectedKeys = new Set();
  for (const rawTopic of tags) {
    const topic = normalizeQuickTopic(rawTopic);
    const key = getTopicKey(topic);
    if (topic && !selectedKeys.has(key)) {
      selectedTopics.push(topic);
      selectedKeys.add(key);
    }
  }

  const commitTopic = (rawTopic = value) => {
    if (composingRef.current) return;
    const next = addQuickTopic(tags, rawTopic);
    if (next !== tags) onChange(next);
    onValueChange('');
  };

  const removeTopic = (topic) => {
    const key = getTopicKey(topic);
    onChange(tags.filter((current) => getTopicKey(current) !== key));
  };

  if (!selectedTopics.length && !expanded) return null;

  return (
    <section className="quick-topic-area" aria-label="发布话题">
      {selectedTopics.length > 0 && (
        <div className="quick-topic-chips" aria-label="已选话题">
          {selectedTopics.map((topic) => (
            <span className="quick-topic-chip" key={getTopicKey(topic)}>
              <span className="quick-topic-chip-label" title={`#${topic}`}>#{topic}</span>
              <button
                type="button"
                aria-label={`移除话题 ${topic}`}
                disabled={disabled}
                onClick={() => removeTopic(topic)}
              >
                <Icon name="close" />
              </button>
            </span>
          ))}
        </div>
      )}

      {expanded && (
        <div className="quick-topic-editor" id={editorId}>
          <div className="quick-topic-entry">
            <span aria-hidden="true">#</span>
            <input
              ref={inputRef}
              aria-label="输入自定义话题"
              placeholder="输入话题，按回车添加"
              value={value}
              disabled={disabled}
              onChange={(event) => onValueChange(event.target.value)}
              onCompositionStart={() => {
                composingRef.current = true;
                setComposing(true);
              }}
              onCompositionEnd={() => {
                composingRef.current = false;
                setComposing(false);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  if (!composingRef.current
                    && !event.nativeEvent.isComposing
                    && event.nativeEvent.keyCode !== 229) commitTopic();
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  onClose?.();
                  triggerRef?.current?.focus();
                }
              }}
            />
            <button
              className="quick-topic-add"
              type="button"
              disabled={disabled || composing || !normalizeQuickTopic(value)}
              onClick={() => commitTopic()}
            >
              添加
            </button>
          </div>
          {suggestions.length > 0 && (
            <div className="quick-topic-suggestions" aria-label="常用话题">
              <span>常用</span>
              {suggestions.map((topic) => {
                const key = getTopicKey(topic);
                const selected = selectedKeys.has(key);
                return (
                  <button
                    className={selected ? 'is-selected' : ''}
                    type="button"
                    key={key}
                    aria-pressed={selected}
                    disabled={disabled}
                    onClick={() => (selected ? removeTopic(topic) : onChange(addQuickTopic(tags, topic)))}
                  >
                    #{normalizeQuickTopic(topic)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
