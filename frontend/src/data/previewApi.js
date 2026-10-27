import useAuthStore from '../store/authStore';

const demoUser = { _id: 'demo-user', nickname: '南大同学', email: 'demo@smail.nju.edu.cn', role: 'user', createdAt: '2026-09-01T00:00:00Z' };
const ago = (minutes) => new Date(Date.now() - minutes * 60000).toISOString();
const initialPosts = [
  { title: '今天的仙林，也太适合散步了', content: '从图书馆出来的时候，刚好赶上夕阳落在树梢上。\n绕着校园多走了一圈，才发现有些日子不需要发生什么特别的事，也会觉得很值得。', tags: ['校园生活', '随手记录'], mood: '平静', moodType: 'calm', likes: 42, comments: 2, saves: 6 },
  { title: '有没有同学一起去图书馆自习？', content: '最近在准备期中考试，一个人很容易摸鱼。想找个搭子，下午各自学习，休息的时候一起喝杯咖啡。\n不用有社交压力，安静坐在旁边就很好。', tags: ['学习交流', '求助'], mood: '喜悦', moodType: 'happy', likes: 18, comments: 1, saves: 3 },
  { title: '想收集一些食堂里的隐藏菜单', content: '今天试了室友推荐的窗口，意外地好吃！大家有什么私藏搭配吗？想在毕业前把没吃过的都尝一遍。', tags: ['校园生活'], mood: '喜悦', moodType: 'happy', likes: 67, comments: 0, saves: 15 },
  { title: '终于把卡了三天的作业做出来了', content: '关掉电脑的那一刻，整个人都轻了。给同样在赶作业的你递一杯热茶，我们慢慢来。', tags: ['学习交流', '随手记录'], mood: '平静', moodType: 'calm', likes: 29, comments: 0, saves: 2 },
  { title: '出一本几乎全新的交互设计入门书', content: '上学期课程用书，只有少量铅笔标记，可以在仙林校区当面交接。有需要的同学在评论里留言就好。', tags: ['闲置交易'], mood: '平静', moodType: 'calm', likes: 5, comments: 0, saves: 1 },
];

/** Installs an isolated in-memory API for preview.html. No API request reaches a server. */
export function installPreviewApi() {
  const previewUser = { ...demoUser };
  for (const method of ['pushState', 'replaceState']) {
    const original = window.history[method].bind(window.history);
    window.history[method] = (state, unused, href) => {
      const url = new URL(href || window.location.href, window.location.href);
      url.searchParams.set('preview', '1');
      original(state, unused, url);
    };
  }
  const realFetch = window.fetch.bind(window);
  let posts = initialPosts.map((post, index) => ({ ...post, id: `demo-${index + 1}`, ownerUserId: index >= 3 ? demoUser._id : `student-${index}`, createdAt: ago(index * 17 + 4), isLiked: index === 1 || index === 4, isSaved: index === 2, images: [] }));
  let bookmarks = ['demo-3'];
  let folders = [{ id: 'all', name: '全部', isDefault: true }, { id: 'later', name: '校园生活' }];
  const bookmarkFolders = { later: ['demo-3'] };
  let drafts = [
    { id: 'sample-draft-1', title: '想记录一下这周的小事', content: '晚饭后去操场散步，想把这段轻松的时间记下来。', tags: ['随手记录'], images: [], updatedAt: ago(25) },
    { id: 'sample-draft-2', title: '周末一起去看展吗？', content: '正在整理时间和路线，等确认好再发出来。', tags: ['校园生活'], images: [], updatedAt: ago(150) },
  ];
  const future = (days) => new Date(Date.now() + days * 86400000).toISOString();
  const events = [
    { _id: 'event-sample-1', title: '设计如何回应真实的校园生活', type: '学术讲座', time: future(3), place: '仙林校区 · 逸夫楼报告厅', description: '从校园里的日常观察出发，讨论交互设计如何让生活更方便。\n欢迎带上你的课程问题参与交流。', status: 'approved', image: '' },
    { _id: 'event-sample-2', title: '周末校园慢跑计划', type: '体育赛事', time: future(5), place: '仙林校区 · 田径场', description: '按自己的节奏跑，结束后一起拉伸。', status: 'approved', image: '' },
    { _id: 'event-sample-3', title: '校园旧书交换日', type: '志愿公益', time: ago(3000), place: '仙林校区 · 大学生活动中心', description: '让读过的书遇见下一位读者。', status: 'archived', image: '' },
  ];
  const myEvents = [{ _id: 'application-sample-1', title: '交互设计课程作品分享', type: '学术讲座', time: future(8), place: '仙林校区 · 教学楼', description: '一起交流本学期的交互设计作业。', status: 'pending', image: '' }];
  let fortune = { checkedIn: false };
  const comments = {
    'demo-1': [
      { id: 'comment-1', ownerUserId: 'student-8', content: '今天的晚风也很舒服，散步真的能让心情变好。', createdAt: ago(2), likes: 3, replies: [] },
      { id: 'comment-2', ownerUserId: 'student-9', content: '谢谢你记录下来，明天也想放下手机去走走。', createdAt: ago(1), likes: 1, isLiked: true, replies: [] },
    ],
    'demo-2': [{ id: 'comment-3', ownerUserId: 'student-7', content: '我也在准备期中！一起加油。', createdAt: ago(10), likes: 2, replies: [] }],
  };
  const notifications = [{ _id: 'notification-1', type: 'reply', title: '有一条新的回应', content: '来看看校园里的新声音吧。', relatedType: 'post', relatedId: 'demo-1', read: false, createdAt: ago(2) }];
  const bookmarkState = () => ({ bookmarks, collectionFolders: folders, bookmarkFolders });
  const json = (data, status = 200) => Promise.resolve(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }));
  const notSupported = () => json({ error: '此操作请在连接后端的正式入口体验。' }, 501);

  // Preview authentication has no cookies or tokens and is confined to this document.
  useAuthStore.setState({ restoreSession: async () => useAuthStore.setState({ user: previewUser, initialized: true, isAuthenticated: true }) });
  window.EventSource = class PreviewEventSource extends EventTarget {
    close() {}
  };

  window.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, window.location.href);
    if (!url.pathname.startsWith('/api/')) return realFetch(input, options);
    const path = url.pathname;
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : {};

    if (path === '/api/auth/me' || path === '/api/auth/login' || path === '/api/auth/refresh') return json({ user: previewUser });
    if (path === '/api/auth/profile' && method === 'PUT') { Object.assign(previewUser, body); return json({ user: previewUser }); }
    if (path === '/api/auth/logout') return json({ success: true });
    if (path === '/api/notifications/unread-count') return json({ count: notifications.filter((n) => !n.read).length });
    if (path === '/api/notifications') return json({ notifications });
    if (path === '/api/notifications/read-all') { notifications.forEach((n) => { n.read = true; }); return json({ success: true }); }
    if (/^\/api\/notifications\/[^/]+\/read$/.test(path)) { const item = notifications.find((n) => path.includes(n._id)); if (item) item.read = true; return json({ success: true }); }
    if (path === '/api/fortune/status') return json(fortune);
    if (path === '/api/fortune/checkin') {
      fortune = { checkedIn: true, level: '小吉', streak: 1, date: new Date().toLocaleDateString('zh-CN'), dos: [{ activity: '出去走走', description: '把一小段时间留给校园。' }], donts: [{ activity: '熬夜', description: '今天早点休息。' }] };
      return json(fortune);
    }
    if (path === '/api/bookmarks' || path === '/api/bookmarks/migrate') return json(bookmarkState());
    if (path === '/api/bookmarks/folders' && method === 'POST') { folders.push({ id: `folder-${Date.now()}`, name: body.name }); return json(bookmarkState()); }
    if (path.startsWith('/api/bookmarks/folders/')) {
      const id = path.split('/').pop();
      if (method === 'DELETE') folders = folders.filter((f) => f.id !== id);
      if (method === 'PUT') folders = folders.map((f) => f.id === id ? { ...f, name: body.name } : f);
      return json(bookmarkState());
    }
    if (path.startsWith('/api/bookmarks/')) {
      const id = path.split('/').pop();
      const post = posts.find((p) => p.id === id);
      if (!post) return json({ error: '树洞不存在' }, 404);
      const wasSaved = bookmarks.includes(id);
      const saved = method !== 'DELETE';
      bookmarks = saved ? [...new Set([...bookmarks, id])] : bookmarks.filter((item) => item !== id);
      for (const folderId of Object.keys(bookmarkFolders)) bookmarkFolders[folderId] = bookmarkFolders[folderId].filter((item) => item !== id);
      if (saved && body.folderId && body.folderId !== 'all') bookmarkFolders[body.folderId] = [...(bookmarkFolders[body.folderId] || []), id];
      post.isSaved = saved;
      post.saves += Number(saved) - Number(wasSaved);
      return json({ ...bookmarkState(), postId: id, saved, saves: post.saves });
    }
    if (path === '/api/posts/saved') return json(posts.filter((p) => bookmarks.includes(p.id)));
    if (path === '/api/posts/mine') return json(posts.filter((p) => p.ownerUserId === demoUser._id));
    if (path === '/api/likes') return json({ posts: posts.filter((p) => p.isLiked), comments: Object.entries(comments).flatMap(([postId, items]) => items.filter((item) => item.isLiked).map((item) => ({ type: 'comment', item, postId, postTitle: posts.find((post) => post.id === postId)?.title }))) });
    if (path === '/api/posts' && method === 'POST') {
      const post = { ...body, tags: Array.isArray(body.tags) ? body.tags : [], id: `demo-${Date.now()}`, ownerUserId: demoUser._id, createdAt: ago(0), likes: 0, saves: 0, comments: 0, isLiked: false, isSaved: false };
      posts.unshift(post);
      return json(post);
    }
    if (path === '/api/posts') {
      const query = (url.searchParams.get('query') || '').toLowerCase();
      const found = posts.filter((p) => `${p.title} ${p.content} ${p.tags.join(' ')}`.toLowerCase().includes(query) && (!url.searchParams.get('tag') || p.tags.includes(url.searchParams.get('tag'))));
      if (url.searchParams.get('sort') === 'hot') found.sort((a, b) => b.likes - a.likes);
      const limit = Number(url.searchParams.get('limit')) || 20;
      const page = Number(url.searchParams.get('page')) || 1;
      return json({ posts: found.slice((page - 1) * limit, page * limit), total: found.length });
    }
    const postMatch = path.match(/^\/api\/posts\/([^/]+)(\/like)?$/);
    if (postMatch) {
      const post = posts.find((p) => p.id === postMatch[1]);
      if (!post) return json({ error: '树洞不存在' }, 404);
      if (postMatch[2]) { post.isLiked = !post.isLiked; post.likes += post.isLiked ? 1 : -1; return json({ liked: post.isLiked, likes: post.likes }); }
      if (method === 'DELETE') posts = posts.filter((p) => p.id !== post.id);
      return json(post);
    }
    if (path === '/api/comments' && method === 'POST') {
      const comment = { ...body, id: `comment-${Date.now()}`, ownerUserId: demoUser._id, createdAt: ago(0), likes: 0, replies: [] };
      comments[body.postId] = [...(comments[body.postId] || []), comment];
      const post = posts.find((p) => p.id === body.postId);
      if (post) post.comments += 1;
      return json(comment);
    }
    const commentMatch = path.match(/^\/api\/comments\/([^/]+)(?:\/reply(?:\/([^/]+))?)?(\/like)?$/);
    if (commentMatch && method !== 'GET') {
      const [, commentId, replyId, like] = commentMatch;
      const entry = Object.entries(comments).find(([, list]) => list.some((item) => item.id === commentId));
      if (!entry) return json({ error: '评论不存在' }, 404);
      const [postId, list] = entry;
      const comment = list.find((item) => item.id === commentId);
      const post = posts.find((item) => item.id === postId);
      const isReplyRoute = path.includes('/reply');
      if (like && method === 'POST') {
        const item = replyId ? comment.replies.find((item) => item.id === replyId) : comment;
        if (!item) return json({ error: '回复不存在' }, 404);
        item.isLiked = !item.isLiked; item.likes += item.isLiked ? 1 : -1;
        return json({ liked: item.isLiked, likes: item.likes });
      }
      if (isReplyRoute && !replyId && method === 'POST') {
        const reply = { ...body, id: `reply-${Date.now()}`, ownerUserId: demoUser._id, createdAt: ago(0), likes: 0 };
        comment.replies.push(reply);
        if (post) post.comments += 1;
        return json(reply);
      }
      if (method === 'DELETE') {
        if (replyId) comment.replies = comment.replies.filter((item) => item.id !== replyId);
        else comments[postId] = list.filter((item) => item.id !== commentId);
        if (post) post.comments = Math.max(0, post.comments - (replyId ? 1 : 1 + comment.replies.length));
        return json({ postId, commentId, replyId, deletedReplyCount: comment.replies.length });
      }
    }
    if (/^\/api\/comments\/[^/]+$/.test(path) && method === 'GET') return json(comments[path.split('/').pop()] || []);
    if (path === '/api/drafts/delete-many' && method === 'POST') { drafts = drafts.filter((draft) => !body.ids?.includes(draft.id)); return json({ success: true }); }
    if (path === '/api/drafts' && method === 'POST') { const draft = { ...body, id: `draft-${Date.now()}`, updatedAt: ago(0) }; drafts.unshift(draft); return json(draft); }
    if (path === '/api/drafts') return json(drafts.map(({ id, title, content, tags, updatedAt }) => ({ id, title, content, tags, updatedAt })));
    const publishMatch = path.match(/^\/api\/drafts\/([^/]+)\/publish$/);
    if (publishMatch && method === 'POST') {
      const draft = drafts.find((d) => d.id === publishMatch[1]);
      if (!draft) return json({ error: '草稿不存在' }, 404);
      const post = { ...draft, id: `demo-${Date.now()}`, ownerUserId: demoUser._id, createdAt: ago(0), title: draft.title || '无标题', tags: draft.tags || ['树洞'], likes: 0, saves: 0, comments: 0, isLiked: false, isSaved: false };
      posts.unshift(post);
      drafts = drafts.filter((d) => d.id !== draft.id);
      return json(post);
    }
    if (path.startsWith('/api/drafts/')) {
      const id = path.split('/').pop();
      const draft = drafts.find((d) => d.id === id);
      if (!draft) return json({ error: '草稿不存在' }, 404);
      if (method === 'DELETE') drafts = drafts.filter((d) => d.id !== id);
      if (method === 'PUT') Object.assign(draft, body, { updatedAt: ago(0) });
      return json(draft);
    }
    if (path === '/api/events' && method === 'GET') return json({ events });
    if (path === '/api/events/my' && method === 'GET') return json({ events: myEvents });
    if (path === '/api/events' && method === 'POST') { const event = { ...body, _id: `event-${Date.now()}`, status: 'pending' }; myEvents.unshift(event); return json({ event }); }
    return notSupported();
  };
}
