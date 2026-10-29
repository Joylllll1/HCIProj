import React, { useEffect, useId, useRef, useState } from 'react';
import Icon from '../common/Icon';
import Select from '../common/Select';

export const landingTopics = ['校园生活', '学习交流', '求助'];
const initialPosts = [
  { id: 'walk', topic: '校园生活', title: '今天的校园，也太适合散步了', body: '从图书馆出来的时候，刚好赶上夕阳。绕远了一点，心情却轻松了很多。', likes: 24, comments: [{ author: '同学 1', body: '我也喜欢这个时间出门，路上慢慢走就很舒服。' }], author: '晚风', time: '刚刚' },
  { id: 'study', topic: '学习交流', title: '给同样在赶作业的你，递一杯热茶', body: '终于把卡了三天的题做出来了。想提醒也在赶进度的同学：先休息一下，再回来看看。', likes: 36, comments: [{ author: '同学 1', body: '收到！正好站起来接杯水。' }], author: '热茶', time: '5 分钟前' },
  { id: 'help', topic: '求助', title: '第一次去图书馆，有什么小建议？', body: '想找一个能安静读书的地方，也想知道大家最喜欢坐在哪一层。', likes: 12, comments: [{ author: '同学 1', body: '可以先走一圈，找一个光线舒服的位置。' }], author: '小纸条', time: '10 分钟前' },
];

export default function LandingPlayground({ topic, onTopicChange, onRegister }) {
  const [posts, setPosts] = useState(initialPosts);
  const [sort, setSort] = useState('latest');
  const [savedOnly, setSavedOnly] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState('');
  const [reply, setReply] = useState('');
  const [status, setStatus] = useState('点开一条树洞，试试回应。');
  const nextId = useRef(0);
  const composeId = useId();
  const topicId = useId();
  useEffect(() => { setSavedOnly(false); setExpanded(null); setReply(''); }, [topic]);
  const updatePost = (id, transform) => setPosts(items => items.map(post => post.id === id ? transform(post) : post));
  const visible = posts.filter(post => (!topic || post.topic === topic) && (!savedOnly || post.saved));
  const shown = (sort === 'hot' ? [...visible].sort((a, b) => (b.likes + !!b.liked) - (a.likes + !!a.liked)) : visible).slice(0, 2);
  const toggleDiscussion = (id) => { setExpanded(current => current === id ? null : id); setReply(''); };
  const publish = (event) => {
    event.preventDefault();
    if (!draft.trim()) return;
    const id = `local-${++nextId.current}`;
    setPosts(items => [{ id, topic: topic || '校园生活', title: '', body: draft.trim(), likes: 0, comments: [], author: '你', time: '刚刚' }, ...items]);
    setDraft(''); setComposing(false); setSort('latest'); setSavedOnly(false); setExpanded(id);
    setStatus('你的这句话已出现在体验区，仅在当前页面保留。');
  };
  const reset = () => {
    setPosts(initialPosts); setExpanded(null); setComposing(false); setDraft(''); setReply(''); setSort('latest'); setSavedOnly(false); onTopicChange(''); setStatus('体验已重置，可以重新试试。');
  };

  return (
    <section className="welcome-preview landing-playground" aria-label="树洞互动体验">
      <div className="welcome-preview-header"><span><Icon name="park" /> 校园里的声音</span><small><i /> 可交互体验</small></div>
      <div className="playground-toolbar">
        <div className="playground-tabs" aria-label="示例排序">
          <button type="button" aria-pressed={!savedOnly && sort === 'latest'} onClick={() => { setSort('latest'); setSavedOnly(false); }}>最新</button>
          <button type="button" aria-pressed={!savedOnly && sort === 'hot'} onClick={() => { setSort('hot'); setSavedOnly(false); }}>热门</button>
          <button type="button" aria-pressed={savedOnly} onClick={() => setSavedOnly(!savedOnly)}>收藏</button>
        </div>
        <label className="playground-topic" htmlFor={topicId}><span className="sr-only">体验话题</span><Select id={topicId} aria-label="体验话题" value={topic} onChange={onTopicChange} options={[{ value: '', label: '全部话题' }, ...landingTopics.map(value => ({ value, label: value }))]} /></label>
      </div>
      {composing ? (
        <form className="playground-compose" onSubmit={publish}>
          <label htmlFor={composeId}>写下你的第一句</label>
          <textarea id={composeId} autoFocus maxLength={300} value={draft} onChange={e => setDraft(e.target.value)} placeholder="今天，有什么值得记下来？" />
          <div><small>{draft.length}/300 · 仅在本页体验</small><button type="button" className="playground-quiet" onClick={() => setComposing(false)}>收起</button><button className="primary-button" type="submit" disabled={!draft.trim()}>试发一句</button></div>
        </form>
      ) : <button type="button" className="welcome-preview-compose" onClick={() => setComposing(true)}><Icon name="edit_square" /><span>此刻，有什么想说的？</span><span className="playground-compose-hint">试写 <Icon name="arrow_forward" /></span></button>}
      <div className="playground-posts">
        {shown.length === 0 && <div className="playground-empty"><Icon name="bookmark_border" /><p>这里还没有收藏</p><span>点一次帖子右下角的书签，再回来看看。</span><button type="button" className="welcome-text-button" onClick={() => { setSavedOnly(false); onTopicChange(''); }}>去看看树洞 <Icon name="arrow_forward" /></button></div>}
        {shown.map(post => (
          <article className="welcome-example" key={post.id}>
            <p className="playground-byline"><span>{post.author}<small>{post.time}</small></span><span>#{post.topic}</span></p>
            <button type="button" className="playground-post-open" aria-label={`阅读树洞：${post.title || post.body}`} aria-expanded={expanded === post.id} onClick={() => toggleDiscussion(post.id)}>
              {post.title && <h2>{post.title}</h2>}<p>{post.body}</p>
            </button>
            <footer>
              <button type="button" aria-expanded={expanded === post.id} aria-label={`查看讨论：${post.title || post.body}`} onClick={() => toggleDiscussion(post.id)}><Icon name="chat_bubble" />{post.comments.length} 条回应</button>
              <button type="button" aria-label={`${post.liked ? '取消点赞' : '点赞'}：${post.title || post.body}`} aria-pressed={!!post.liked} onClick={() => updatePost(post.id, p => ({ ...p, liked: !p.liked }))}><Icon name={post.liked ? 'favorite' : 'favorite_border'} />{post.likes + !!post.liked}</button>
              <button type="button" aria-label={`${post.saved ? '取消收藏' : '收藏'}：${post.title || post.body}`} aria-pressed={!!post.saved} onClick={() => { updatePost(post.id, p => ({ ...p, saved: !p.saved })); setStatus(post.saved ? '已取消收藏。' : '已收藏，可以在上方“收藏”里找到。'); }}><Icon name={post.saved ? 'bookmark' : 'bookmark_border'} /></button>
            </footer>
            {expanded === post.id && <div className="playground-discussion">
              <p className="playground-discussion-label">这条树洞下的回应</p>
              {post.comments.map((comment, index) => <p className="playground-comment" key={index}><span>{comment.author}</span>{comment.body}</p>)}
              {!post.comments.length && <p className="playground-no-replies">还没有回应，可以先写一句。</p>}
              <form onSubmit={e => { e.preventDefault(); if (!reply.trim()) return; updatePost(post.id, p => ({ ...p, comments: [...p.comments, { author: '你', body: reply.trim() }] })); setReply(''); setStatus('回应已添加到体验区，仅在当前页面保留。'); }}>
                <label className="sr-only" htmlFor={`reply-${post.id}`}>写一句回应</label><input id={`reply-${post.id}`} maxLength={200} value={reply} onChange={e => setReply(e.target.value)} placeholder="写一句回应…" /><button type="submit" aria-label="发送体验回应" disabled={!reply.trim()}><Icon name="arrow_forward" /></button>
              </form>
            </div>}
          </article>
        ))}
      </div>
      <div className="playground-status"><p role="status">{status}</p><button type="button" onClick={reset}>重置体验</button></div>
      <div className="welcome-preview-note"><span>示例内容 · 刷新重置</span><button type="button" onClick={onRegister}>注册后参与真实讨论 <Icon name="arrow_forward" /></button></div>
    </section>
  );
}
