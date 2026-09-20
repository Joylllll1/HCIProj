import React, { useState } from 'react';
import Icon from '../common/Icon';
import StatCard from '../common/StatCard';
import Progress from '../common/Progress';
import EmptyState from '../common/EmptyState';
import PlainTextContent from '../common/PlainTextContent';
import { getImageGridLayout } from '../../utils/image';

const SEED_REPORTS = [
  { id: '#R10283', type: '辱骂/攻击', source: '举报人: 用户1922', time: '3分钟前', risk: 'high', postId: 'P-4921', content: '这学期的期末考也太离谱了吧，出题完全不考虑学生实际复习节奏。' },
  { id: '#R10279', type: '敏感内容', source: '系统自动拦截', time: '12分钟前', risk: 'high', postId: 'P-8820', content: '[该内容包含高敏词，已由 AI 初筛隐藏，请管理员人工复核。]' },
  { id: '#R10275', type: '垃圾广告', source: '举报人: 用户0032', time: '45分钟前', risk: 'low', postId: 'P-2105', content: '诚招打字员，时间自由，日入过百，加群了解。' },
];

const REJECTION_REASONS = [
  '内容不符合社区规范',
  '活动信息不完整或有误',
  '时间或地点安排冲突',
  '非校园官方或认证社团活动',
];

// 活动详情弹窗组件
function EventDetailModal({ event, onClose }) {
  if (!event) return null;

  return (
    <div className="modal-overlay fixed inset-0 z-[150] grid place-items-center bg-black/40 animate-modal-fade-in" onClick={onClose}>
      <div className="modal-content w-[min(600px,90vw)] max-h-[85vh] overflow-y-auto rounded-lg bg-white shadow-md animate-modal-scale-in" onClick={(e) => e.stopPropagation()}>
        {event.poster && (
          <img src={event.poster} alt={event.title} className="w-full h-[260px] object-cover rounded-t-lg" />
        )}
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <span className="pill blue inline-flex items-center gap-[5px] w-fit rounded-full px-3 py-2 text-xs font-semibold text-white bg-blue">{event.type}</span>
              <h2 className="mt-[14px] mb-[10px] text-2xl tracking-tight">{event.title}</h2>
              <div className="flex items-center gap-4 my-2 text-text-2 text-[15px]">
                <span className="flex items-center gap-2"><Icon name="schedule" /> {event.time}</span>
                <span className="flex items-center gap-2"><Icon name="location_on" /> {event.place}</span>
              </div>
            </div>
          </div>
          {event.description && (
            <div className="my-4 p-4 bg-surface-soft rounded-md">
              <PlainTextContent className="m-0 text-text-2 text-sm leading-relaxed" content={event.description} />
            </div>
          )}
          <div className="flex items-center justify-between gap-4 pt-4 border-t border-line-soft">
            <span className="text-text-3 text-xs">提交时间：{event.submittedAt || '刚刚'}</span>
            <button className="primary-button inline-flex items-center justify-center gap-[7px] border-0 rounded-full px-[18px] py-[10px] text-white bg-blue font-bold shadow-sm transition-all duration-150 hover:-translate-y-px hover:bg-blue-2" onClick={onClose} type="button">关闭</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 拒绝理由弹窗组件
function RejectionModal({ onClose, onSubmit }) {
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  const handleSubmit = () => {
    const reason = selectedReason === 'other' ? customReason : selectedReason;
    if (reason.trim()) {
      onSubmit(reason);
    }
  };

  const canSubmit = selectedReason && (selectedReason !== 'other' || customReason.trim());

  return (
    <div className="modal-overlay fixed inset-0 z-[150] grid place-items-center bg-black/40 animate-modal-fade-in" onClick={onClose}>
      <div className="modal-content w-[min(500px,90vw)] rounded-lg bg-white shadow-md animate-modal-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <h2 className="text-2xl tracking-tight mb-2">拒绝活动</h2>
          <p className="text-text-2 text-sm mb-6">请选择拒绝理由，该反馈将发送给申请人。</p>

          <div className="space-y-2 mb-4">
            {REJECTION_REASONS.map((reason) => (
              <button
                key={reason}
                className={`w-full text-left px-4 py-3 border rounded-md text-sm transition-colors duration-150 ${
                  selectedReason === reason
                    ? 'border-blue bg-blue-soft text-blue font-semibold'
                    : 'border-line-soft bg-white text-text-2 hover:bg-surface-soft'
                }`}
                onClick={() => { setSelectedReason(reason); setCustomReason(''); }}
                type="button"
              >
                {reason}
              </button>
            ))}
            <button
              className={`w-full text-left px-4 py-3 border rounded-md text-sm transition-colors duration-150 ${
                selectedReason === 'other'
                  ? 'border-blue bg-blue-soft text-blue font-semibold'
                  : 'border-line-soft bg-white text-text-2 hover:bg-surface-soft'
              }`}
              onClick={() => setSelectedReason('other')}
              type="button"
            >
              其他（请说明）
            </button>
          </div>

          {selectedReason === 'other' && (
            <textarea
              autoFocus
              className="w-full min-h-[80px] p-3 border border-line rounded-md bg-white text-text text-sm resize-y mb-4"
              placeholder="请输入拒绝理由..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
            />
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-line-soft">
            <button className="secondary-button inline-flex items-center justify-center gap-[7px] border border-line rounded-full px-4 py-[10px] bg-white text-text-2 text-sm font-semibold transition-all duration-150" onClick={onClose} type="button">取消</button>
            <button className="primary-button inline-flex items-center justify-center gap-[7px] border-0 rounded-full px-[18px] py-[10px] text-white bg-blue font-bold shadow-sm transition-all duration-150 hover:-translate-y-px hover:bg-blue-2 disabled:opacity-50 disabled:cursor-not-allowed" onClick={handleSubmit} disabled={!canSubmit} type="button">确认拒绝</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 帖子详情弹窗组件（用于举报详情查看）
function PostDetailModal({ post, onClose }) {
  if (!post) return null;
  const images = Array.isArray(post.images) && post.images.length > 0
    ? post.images
    : post.image
      ? [post.image]
      : [];
  const imageLayout = getImageGridLayout(images.length);

  return (
    <div className="modal-overlay fixed inset-0 z-[150] grid place-items-center bg-black/30 backdrop-blur-sm animate-modal-fade-in" onClick={onClose}>
      <div className="modal-content w-[min(640px,90vw)] max-h-[85vh] overflow-y-auto rounded-2xl bg-surface backdrop-blur-md shadow-glass animate-modal-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          {/* Header with mood and title */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <span className={`mood mood-${post.moodType} inline-flex items-center gap-[5px] w-fit rounded-full px-3 py-2 text-xs font-semibold leading-none border border-transparent`}>{post.mood}</span>
              <h2 className="mt-[14px] mb-[10px] text-2xl tracking-tight">{post.title}</h2>
              <div className="flex items-center gap-3 my-2 text-text-2 text-[15px]">
                <span>{post.time}</span>
                <span>·</span>
                <span>{post.campus}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="text-text-3 text-xs font-mono">{post.id}</span>
              <span className="text-text-3 text-xs">匿名用户</span>
            </div>
          </div>

          {/* Content */}
          <div className="mb-4 p-4 bg-surface-soft rounded-xl">
            <PlainTextContent className="m-0 text-[15px] leading-relaxed text-text" content={post.content} />
          </div>

          {/* Image */}
          {images.length > 0 && (
            <div className={`mb-4 grid gap-2 ${imageLayout.gridClass}`}>
              {images.map((src, index) => (
                <div key={`${src}-${index}`} className={`overflow-hidden rounded-xl border border-line bg-surface-soft ${imageLayout.itemClass} ${images.length === 1 ? 'justify-self-start w-fit max-w-full' : ''}`}>
                  <img className={images.length === 1 ? 'block h-auto max-h-[400px] max-w-full object-contain' : 'h-full w-full object-cover'} alt={`${post.title} 图片 ${index + 1}`} src={src} />
                </div>
              ))}
            </div>
          )}

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2.5 mb-4 text-text-3 text-xs font-semibold">
              {post.tags.map((tag) => (
                <span key={tag} className="text-blue">#{tag}</span>
              ))}
            </div>
          )}

          {/* Footer with stats and close button */}
          <div className="flex items-center justify-between gap-4 pt-4 mt-4 border-t border-line-soft">
            <div className="flex gap-4 text-text-3 text-xs font-semibold">
              <span className="flex items-center gap-1"><Icon name="favorite" /> {post.likes || 0}</span>
              <span className="flex items-center gap-1"><Icon name="chat_bubble" /> {post.comments || 0}</span>
              <span className="flex items-center gap-1"><Icon name="bookmark" /> {post.saves || 0}</span>
            </div>
            <button className="primary-button inline-flex items-center justify-center gap-[7px] border-0 rounded-full px-[18px] py-[10px] text-white bg-blue font-bold shadow-sm transition-all duration-150 hover:-translate-y-px hover:bg-blue-2" onClick={onClose} type="button">关闭</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminPage({ reports, onDismiss, pendingEvents, onApproveEvent, onRejectEvent, carouselItems = [], onUpdateCarousel, approvedEvents = [], posts = [] }) {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [rejectionEvent, setRejectionEvent] = useState(null);
  const [activeTab, setActiveTab] = useState('reports');
  const [carouselSelectorOpen, setCarouselSelectorOpen] = useState(false);
  const [selectedReportPost, setSelectedReportPost] = useState(null);

  const handleRejectWithReason = (reason) => {
    onRejectEvent(rejectionEvent.id, reason);
    setRejectionEvent(null);
  };

  const handleAddToCarousel = (event) => {
    if (!carouselItems.find((item) => item.id === event.id)) {
      onUpdateCarousel([...carouselItems, event]);
    }
    setCarouselSelectorOpen(false);
  };

  const handleRemoveFromCarousel = (eventId) => {
    onUpdateCarousel(carouselItems.filter((item) => item.id !== eventId));
  };

  const getPostFromReport = (report) => {
    // First try to use postId field directly (for new reports)
    if (report.postId) {
      return posts.find((p) => p.id === report.postId);
    }
    // Fallback to extracting from content (for old reports)
    const match = report.content.match(/帖子\s+([P-]\w+)/);
    if (match) {
      return posts.find((p) => p.id === match[1]);
    }
    return null;
  };

  const handleViewReportDetail = (report) => {
    const post = getPostFromReport(report);
    if (post) {
      setSelectedReportPost(post);
    }
  };

  const highRiskReports = reports.filter((r) => r.risk === 'high').length;

  return (
    <div className="admin-page max-w-[1400px] mx-auto">
      {/* Header */}
      <header className="mb-8">
        <p className="eyebrow mb-3 text-blue text-xs font-bold tracking-widest uppercase">Governance Console</p>
        <h1 className="m-0 text-[clamp(32px,4vw,48px)] leading-[1.1] tracking-tight">管理后台</h1>
        <p className="mt-[9px] mb-0 text-text-2 leading-relaxed">内容审核、活动管理和系统监控中心</p>
      </header>

      {/* Stats Grid */}
      <section className="stats-grid grid grid-cols-4 gap-4 mb-8 max-lg:grid-cols-2 max-sm:grid-cols-1">
        <StatCard icon="sensors" label="实时在线" value="1,248" trend="+12%" tone="success" />
        <StatCard icon="history_edu" label="今日发帖" value="4,892" trend="预计 8k+" tone="blue" />
        <StatCard icon="report_problem" label="待处理举报" value={String(reports.length)} trend={`${highRiskReports} 条高优先级`} tone={highRiskReports > 0 ? "warning" : "success"} />
        <StatCard icon="campaign" label="待审活动" value={String(pendingEvents.length)} trend={pendingEvents.length > 0 ? "待处理" : "队列清空"} tone={pendingEvents.length > 0 ? "purple" : "success"} />
      </section>

      {/* Main Content Grid */}
      <div className="grid grid-cols-[1fr_380px] gap-6 max-lg:grid-cols-1">
        {/* Left: Primary Queue */}
        <main>
          {/* Tab Navigation */}
          <div className="flex gap-2 mb-4 border-b border-line-soft">
            <button
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors duration-150 ${
                activeTab === 'reports'
                  ? 'border-blue text-blue'
                  : 'border-transparent text-text-2 hover:text-text'
              }`}
              onClick={() => setActiveTab('reports')}
              type="button"
            >
              举报队列 ({reports.length})
            </button>
            <button
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors duration-150 ${
                activeTab === 'events'
                  ? 'border-blue text-blue'
                  : 'border-transparent text-text-2 hover:text-text'
              }`}
              onClick={() => setActiveTab('events')}
              type="button"
            >
              活动审核 ({pendingEvents.length})
            </button>
            <button
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors duration-150 ${
                activeTab === 'carousel'
                  ? 'border-blue text-blue'
                  : 'border-transparent text-text-2 hover:text-text'
              }`}
              onClick={() => setActiveTab('carousel')}
              type="button"
            >
              轮播管理 ({carouselItems.length})
            </button>
          </div>

          {/* Report Queue */}
          {activeTab === 'reports' && (
            <div className="queue-panel space-y-4">
              {reports.length === 0 ? (
                <EmptyState title="举报队列已清空" description="暂无待处理的举报内容" />
              ) : (
                <>
                  {reports.map((report) => (
                    <article key={report.id} className={`report-card p-5 border rounded-xl bg-surface backdrop-blur-sm shadow-sm ${report.risk === 'high' ? 'border-l-4 border-l-red' : 'border-line-soft'}`}>
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-text-3 text-xs font-mono">{report.id}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${report.risk === 'high' ? 'bg-red-soft text-red' : 'bg-orange-soft text-orange'}`}>
                            {report.type}
                          </span>
                          {report.risk === 'high' && <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red text-white">高优先级</span>}
                        </div>
                        <span className="text-text-3 text-xs">{report.time}</span>
                      </div>
                      <PlainTextContent className="m-0 mb-4 p-3 bg-surface-soft rounded text-text leading-relaxed" content={report.content} />
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-text-3 text-xs">{report.source}</span>
                        <div className="flex gap-2">
                          {getPostFromReport(report) && (
                            <button className="px-3 py-2 text-xs font-semibold border border-line rounded-full bg-white text-blue hover:bg-blue-soft transition-colors duration-150" onClick={() => handleViewReportDetail(report)} type="button">查看详情</button>
                          )}
                          <button className="px-3 py-2 text-xs font-semibold border border-line rounded-full bg-white text-text-2 hover:bg-surface-soft transition-colors duration-150" onClick={() => onDismiss(report.id)} type="button">驳回举报</button>
                          <button className="px-3 py-2 text-xs font-semibold border-0 rounded-full bg-red text-white hover:bg-red-2 transition-colors duration-150" onClick={() => onDismiss(report.id)} type="button">删除内容</button>
                        </div>
                      </div>
                    </article>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Events Review Queue */}
          {activeTab === 'events' && (
            <div className="queue-panel">
              {pendingEvents.length === 0 ? (
                <EmptyState title="活动审核队列已清空" description="暂无待审核的活动申请" />
              ) : (
                <div className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
                  {pendingEvents.map((event) => (
                    <article key={event.id} className="event-card border border-line-soft rounded-lg bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-150">
                      {event.poster && (
                        <div className="aspect-video overflow-hidden bg-surface-soft">
                          <img src={event.poster} alt={event.title} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="p-4">
                        <span className="pill blue text-[10px]">{event.type}</span>
                        <h3 className="mt-2 mb-2 text-base font-bold tracking-tight line-clamp-2">{event.title}</h3>
                        <div className="flex items-center gap-3 mb-3 text-text-3 text-xs">
                          <span className="flex items-center gap-1"><Icon name="schedule" /> {event.time}</span>
                          <span className="flex items-center gap-1"><Icon name="location_on" /> {event.place}</span>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-line-soft">
                          <button className="text-blue text-xs font-semibold hover:underline" onClick={() => setSelectedEvent(event)} type="button">查看详情</button>
                          <div className="flex gap-2">
                            <button className="px-3 py-1.5 text-xs font-semibold border border-line rounded-full text-text-2 hover:bg-surface-soft transition-colors duration-150" onClick={() => setRejectionEvent(event)} type="button">拒绝</button>
                            <button className="px-3 py-1.5 text-xs font-semibold border-0 rounded-full bg-blue text-white hover:bg-blue-2 transition-colors duration-150" onClick={() => onApproveEvent(event)} type="button">通过</button>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Carousel Management */}
          {activeTab === 'carousel' && (
            <div className="carousel-panel">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold tracking-tight">首页轮播配置</h2>
                  <p className="text-text-2 text-sm mt-1">管理首页轮播图展示的活动</p>
                </div>
                <button
                  className="inline-flex items-center justify-center gap-[7px] border-0 rounded-full px-[18px] py-[10px] text-white bg-blue font-bold shadow-sm transition-all duration-150 hover:-translate-y-px hover:bg-blue-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => setCarouselSelectorOpen(true)}
                  disabled={approvedEvents.length === 0}
                  type="button"
                >
                  <Icon name="add_circle" /> 添加活动
                </button>
              </div>

              {carouselItems.length === 0 ? (
                <EmptyState title="暂无轮播活动" description="从已通过审核的活动中选择添加到首页轮播" />
              ) : (
                <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
                  {carouselItems.map((item) => (
                    <article key={item.id} className="carousel-item-card border border-line-soft rounded-lg bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-150">
                      <div className="relative aspect-video overflow-hidden bg-surface-soft">
                        <img src={item.image || item.poster} alt={item.title} className="w-full h-full object-cover" />
                        <span className="absolute top-2 left-2 px-2 py-1 rounded-full text-[10px] font-semibold bg-black/60 text-white backdrop-blur-sm">轮播 {carouselItems.indexOf(item) + 1}</span>
                      </div>
                      <div className="p-4">
                        <span className="pill blue text-[10px]">{item.type}</span>
                        <h3 className="mt-2 mb-2 text-sm font-bold tracking-tight line-clamp-2">{item.title}</h3>
                        <div className="flex items-center gap-2 mb-3 text-text-3 text-xs">
                          <span className="flex items-center gap-1"><Icon name="schedule" /> {item.time}</span>
                          <span className="flex items-center gap-1"><Icon name="location_on" /> {item.place}</span>
                        </div>
                        <button
                          className="w-full px-3 py-2 text-xs font-semibold border border-line rounded-full text-text-2 hover:bg-red-soft hover:text-red hover:border-red transition-colors duration-150"
                          onClick={() => handleRemoveFromCarousel(item.id)}
                          type="button"
                        >
                          移除轮播
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>

        {/* Right Sidebar */}
        <aside className="space-y-4">
          {/* Identity Lookup */}
          <section className="sidebar-card p-5 border border-line-soft rounded-lg bg-white shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold">实名映射查询</h3>
              <Icon name="fingerprint" className="text-text-3" />
            </div>
            <p className="text-text-2 text-xs leading-relaxed mb-4">仅用于处理安全或法律等紧急事务。所有查询均记录审计日志。</p>
            <div className="flex gap-2 mb-4">
              <input className="flex-1 h-9 px-3 text-sm border border-line rounded-md bg-white" placeholder="匿名 ID..." />
              <button className="h-9 px-4 text-sm font-semibold border-0 rounded-md bg-blue text-white hover:bg-blue-2 transition-colors duration-150" type="button">检索</button>
            </div>
            <div className="pt-4 border-t border-line-soft grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
              <span className="text-text-3">映射学号</span>
              <span className="font-mono text-text text-right">**********</span>
              <span className="text-text-3">真实姓名</span>
              <span className="font-mono text-text text-right">***</span>
              <span className="text-text-3">注册邮箱</span>
              <span className="font-mono text-text text-right">***@smail.nju.edu.cn</span>
            </div>
          </section>

          {/* Server Status */}
          <section className="sidebar-card p-5 border border-line-soft rounded-lg bg-gradient-to-br from-[#1e3a5f] to-[#2a4a7f] text-white shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold">服务器状态</h3>
              <span className="flex items-center gap-1.5 text-[#9df2bd] text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-[#24c26a] shadow-[0_0_0_3px_rgba(36,194,106,0.2)]" />
                运行正常
              </span>
            </div>
            <div className="space-y-4">
              <Progress label="CPU 使用率" value={14} />
              <Progress label="活跃连接" value={65} />
            </div>
          </section>
        </aside>
      </div>

      {/* Modals */}
      {selectedEvent && <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
      {rejectionEvent && <RejectionModal event={rejectionEvent} onClose={() => setRejectionEvent(null)} onSubmit={handleRejectWithReason} />}
      {selectedReportPost && <PostDetailModal post={selectedReportPost} onClose={() => setSelectedReportPost(null)} />}

      {/* Carousel Selector Modal */}
      {carouselSelectorOpen && (
        <div className="modal-overlay fixed inset-0 z-[150] grid place-items-center bg-black/40 animate-modal-fade-in" onClick={() => setCarouselSelectorOpen(false)}>
          <div className="modal-content w-[min(900px,90vw)] max-h-[85vh] overflow-y-auto rounded-lg bg-white shadow-md animate-modal-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-2xl tracking-tight mb-2">添加轮播活动</h2>
              <p className="text-text-2 text-sm mb-6">从已通过审核的活动中选择添加到首页轮播</p>

              {approvedEvents.length === 0 ? (
                <EmptyState title="暂无可选活动" description="需要先通过活动审核才能添加到轮播" />
              ) : (
                <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                  {approvedEvents
                    .filter((event) => !carouselItems.find((item) => item.id === event.id))
                    .map((event) => (
                      <article key={event.id} className="border border-line-soft rounded-lg bg-white shadow-sm overflow-hidden hover:shadow-md hover:border-blue transition-all duration-150 cursor-pointer" onClick={() => handleAddToCarousel(event)}>
                        <div className="aspect-video overflow-hidden bg-surface-soft">
                          <img src={event.image || event.poster} alt={event.title} className="w-full h-full object-cover" />
                        </div>
                        <div className="p-4">
                          <span className="pill blue text-[10px]">{event.type}</span>
                          <h3 className="mt-2 mb-2 text-sm font-bold tracking-tight line-clamp-2">{event.title}</h3>
                          <div className="flex items-center gap-2 text-text-3 text-xs">
                            <span className="flex items-center gap-1"><Icon name="schedule" /> {event.time}</span>
                            <span className="flex items-center gap-1"><Icon name="location_on" /> {event.place}</span>
                          </div>
                        </div>
                      </article>
                    ))}
                </div>
              )}

              <div className="flex justify-end pt-4 mt-4 border-t border-line-soft">
                <button className="secondary-button inline-flex items-center justify-center gap-[7px] border border-line rounded-full px-4 py-[10px] bg-white text-text-2 text-sm font-semibold transition-all duration-150" onClick={() => setCarouselSelectorOpen(false)} type="button">关闭</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPage;
export { SEED_REPORTS };
