import React, { useState, useEffect, useRef } from 'react';
import Icon from '../common/Icon';
import PlainTextContent from '../common/PlainTextContent';
import useEventStore from '../../store/eventStore';
import useAuthStore from '../../store/authStore';
import { formatEventTime } from '../../utils';
import useUiStore from '../../store/uiStore';
import { hasSearchQuery, matchEventQuery } from '../../utils/search';

const categories = ['全部活动', '官方活动', '学术讲座', '体育赛事', '科技竞赛', '志愿公益', '答辩', '校招'];
const MAX_POSTER_SIZE_BYTES = 3 * 1024 * 1024;

const statusMap = {
  pending: { label: '待审核', color: 'text-amber-600 bg-amber-100' },
  approved: { label: '已通过', color: 'text-green-600 bg-green-100' },
  rejected: { label: '已拒绝', color: 'text-red-600 bg-red-100' },
  archived: { label: '已归档', color: 'text-gray-600 bg-gray-100' },
  deleted: { label: '已下架', color: 'text-orange-700 bg-orange-100' },
};

function AnnouncementsPage({ showToast }) {
  // Tabs
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'my'

  // Category filter
  const [category, setCategory] = useState('全部活动');

  // Selected announcement modal
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);

  // Publish form
  const [showPublishForm, setShowPublishForm] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    place: '',
    time: '',
    type: '官方活动',
    description: '',
    poster: '',
    applicantName: '',
    applicantStudentId: '',
    applicantPhone: '',
    applicantQQ: '',
  });
  const [posterPreview, setPosterPreview] = useState('');
  const posterInputRef = useRef(null);
  const posterPreviewUrlRef = useRef('');

  // Past events fold
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [activeRailIndex, setActiveRailIndex] = useState(0);
  const [railPosition, setRailPosition] = useState(0);
  const activeRailIndexRef = useRef(0);
  const railPositionRef = useRef(0);
  const railTargetRef = useRef(0);
  const railAnimationFrameRef = useRef(null);
  const railSnapTimeoutRef = useRef(null);
  const railTouchStartRef = useRef(null);

  // Store
  const publicEvents = useEventStore((s) => s.publicEvents);
  const myEvents = useEventStore((s) => s.myEvents);
  const publicLoading = useEventStore((s) => s.publicLoading);
  const myEventsLoading = useEventStore((s) => s.myEventsLoading);
  const fetchPublicEvents = useEventStore((s) => s.fetchPublicEvents);
  const fetchMyEvents = useEventStore((s) => s.fetchMyEvents);
  const submitEvent = useEventStore((s) => s.submitEvent);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const query = useUiStore((s) => s.query);

  // Fetch events on mount
  useEffect(() => {
    fetchPublicEvents();
    if (isAuthenticated) {
      fetchMyEvents();
    }
  }, [fetchPublicEvents, fetchMyEvents, isAuthenticated]);

  useEffect(() => () => {
    if (posterPreviewUrlRef.current) {
      URL.revokeObjectURL(posterPreviewUrlRef.current);
    }
    if (railSnapTimeoutRef.current) {
      window.clearTimeout(railSnapTimeoutRef.current);
    }
    if (railAnimationFrameRef.current) {
      window.cancelAnimationFrame(railAnimationFrameRef.current);
    }
  }, []);

  // Separate current and past events
  const now = new Date();
  const currentEvents = publicEvents.filter((e) => e.status !== 'archived' && new Date(e.time) > now);
  const pastEvents = publicEvents.filter((e) => e.status === 'archived' || new Date(e.time) <= now);

  // Filter by category for current events
  const filteredCurrentEvents =
    category === '全部活动'
      ? currentEvents
      : currentEvents.filter((e) => e.type === category);
  const visibleCurrentEvents = filteredCurrentEvents.filter((event) => matchEventQuery(event, query));
  const visiblePastEvents = pastEvents.filter((event) => matchEventQuery(event, query));
  const visibleMyEvents = myEvents.filter((event) => matchEventQuery(event, query));
  const searching = hasSearchQuery(query);
  const railItems = [
    ...visibleCurrentEvents.map((event) => ({
      kind: 'event',
      key: event._id,
      event,
    })),
    {
      kind: 'proposal',
      key: 'proposal-card',
    },
  ];
  const railItemCount = railItems.length;
  const railLoopEnabled = railItemCount > 1;
  const wrapRailIndex = (index) => {
    if (railItemCount === 0) return 0;
    return ((index % railItemCount) + railItemCount) % railItemCount;
  };

  const wrapRailPosition = (position) => {
    if (railItemCount === 0) return 0;
    return ((position % railItemCount) + railItemCount) % railItemCount;
  };

  const getRailOffset = (index, position) => {
    if (railItemCount <= 1) return index - position;

    let offset = index - position;
    const half = railItemCount / 2;

    if (offset > half) {
      offset -= railItemCount;
    } else if (offset < -half) {
      offset += railItemCount;
    }

    return offset;
  };

  useEffect(() => {
    const nextPosition = railItemCount === 0
      ? 0
      : ((railTargetRef.current % railItemCount) + railItemCount) % railItemCount;
    const roundedIndex = Math.round(nextPosition);
    const nextIndex = railItemCount === 0
      ? 0
      : ((roundedIndex % railItemCount) + railItemCount) % railItemCount;
    railPositionRef.current = nextPosition;
    railTargetRef.current = nextPosition;
    setRailPosition(nextPosition);
    activeRailIndexRef.current = nextIndex;
    setActiveRailIndex(nextIndex);
  }, [railItemCount]);

  useEffect(() => {
    activeRailIndexRef.current = activeRailIndex;
  }, [activeRailIndex]);

  // Handle poster upload
  const handlePosterSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_POSTER_SIZE_BYTES) {
        showToast?.('活动海报过大，请上传 3MB 以内图片');
        e.target.value = '';
        return;
      }

      if (posterPreviewUrlRef.current) {
        URL.revokeObjectURL(posterPreviewUrlRef.current);
      }

      const url = URL.createObjectURL(file);
      posterPreviewUrlRef.current = url;
      setPosterPreview(url);
      // Convert to base64 for storage
      const reader = new FileReader();
      reader.onload = (event) => {
        setNewEvent((prev) => ({ ...prev, poster: event.target?.result || '' }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle publish event
  const handlePublishEvent = async () => {
    if (!newEvent.title.trim()) return;

    // Validate event time is in the future
    if (newEvent.time) {
      const eventTime = new Date(newEvent.time);
      const now = new Date();
      if (eventTime <= now) {
        showToast?.('活动时间必须在现在之后');
        return;
      }
    }

    try {
      await submitEvent({
        title: newEvent.title,
        place: newEvent.place,
        time: newEvent.time,
        type: newEvent.type,
        description: newEvent.description,
        image: newEvent.poster,
        applicantName: newEvent.applicantName,
        applicantStudentId: newEvent.applicantStudentId,
        applicantPhone: newEvent.applicantPhone,
        applicantQQ: newEvent.applicantQQ,
      });

      showToast?.('提交成功，等待审核');
      setShowPublishForm(false);
      resetPublishForm();

      // Refresh my events
      fetchMyEvents();
    } catch (err) {
      showToast?.(err.message || '提交失败');
    }
  };

  // Reset publish form
  const resetPublishForm = () => {
    if (posterPreviewUrlRef.current) {
      URL.revokeObjectURL(posterPreviewUrlRef.current);
      posterPreviewUrlRef.current = '';
    }
    setNewEvent({
      title: '',
      place: '',
      time: '',
      type: '官方活动',
      description: '',
      poster: '',
      applicantName: '',
      applicantStudentId: '',
      applicantPhone: '',
      applicantQQ: '',
    });
    setPosterPreview('');
    if (posterInputRef.current) {
      posterInputRef.current.value = '';
    }
  };

  // Format time for display
  const formatTimeForDisplay = (timeStr) => {
    if (!timeStr) return '未指定';
    return formatEventTime(timeStr);
  };

  // Get event status
  const getEventStatus = (event) => {
    const status = event.status || 'approved';
    return statusMap[status] || statusMap.approved;
  };

  const syncActiveRailIndex = (position) => {
    const nextIndex = wrapRailIndex(Math.round(position));
    if (nextIndex !== activeRailIndexRef.current) {
      activeRailIndexRef.current = nextIndex;
      setActiveRailIndex(nextIndex);
    }
  };

  const ensureRailAnimation = () => {
    if (railAnimationFrameRef.current || !railLoopEnabled) return;

    const tick = () => {
      const current = railPositionRef.current;
      const target = railTargetRef.current;
      const offset = getRailOffset(target, current);
      const next = Math.abs(offset) < 0.001
        ? target
        : wrapRailPosition(current + (offset * 0.18));

      railPositionRef.current = next;
      setRailPosition(next);
      syncActiveRailIndex(next);

      if (Math.abs(getRailOffset(target, next)) < 0.0015) {
        railPositionRef.current = target;
        setRailPosition(target);
        syncActiveRailIndex(target);
        railAnimationFrameRef.current = null;
        return;
      }

      railAnimationFrameRef.current = window.requestAnimationFrame(tick);
    };

    railAnimationFrameRef.current = window.requestAnimationFrame(tick);
  };

  const nudgeRailTarget = (delta) => {
    if (!railLoopEnabled || delta === 0) return;
    railTargetRef.current = wrapRailPosition(railTargetRef.current + delta);
    ensureRailAnimation();
  };

  const snapRailToNearest = () => {
    if (!railLoopEnabled) return;
    railTargetRef.current = wrapRailIndex(Math.round(railTargetRef.current));
    ensureRailAnimation();
  };

  const scheduleRailSnap = (delay = 110) => {
    if (railSnapTimeoutRef.current) {
      window.clearTimeout(railSnapTimeoutRef.current);
    }
    railSnapTimeoutRef.current = window.setTimeout(() => {
      railSnapTimeoutRef.current = null;
      snapRailToNearest();
    }, delay);
  };

  const moveRailBy = (step) => {
    if (!railLoopEnabled || step === 0) return;
    railTargetRef.current = wrapRailIndex(Math.round(railTargetRef.current) + step);
    ensureRailAnimation();
  };

  const handleRailArrow = (direction) => {
    moveRailBy(direction);
  };

  const handleRailWheel = (event) => {
    if (!railLoopEnabled) return;

    const absDeltaX = Math.abs(event.deltaX);
    const absDeltaY = Math.abs(event.deltaY);

    if (absDeltaX < 1.5 || absDeltaX <= absDeltaY * 1.08) return;

    if (event.cancelable) {
      event.preventDefault();
    }

    const normalizedDelta = Math.max(-0.45, Math.min(0.45, event.deltaX / 180));
    nudgeRailTarget(normalizedDelta);
    scheduleRailSnap(120);
  };

  const handleRailTouchStart = (event) => {
    const touch = event.touches?.[0];
    if (!touch) return;

    railTouchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
    };
  };

  const handleRailTouchEnd = (event) => {
    if (!railLoopEnabled || !railTouchStartRef.current) return;

    const touch = event.changedTouches?.[0];
    if (!touch) return;

    const deltaX = touch.clientX - railTouchStartRef.current.x;
    const deltaY = touch.clientY - railTouchStartRef.current.y;
    railTouchStartRef.current = null;

    if (Math.abs(deltaX) < 44 || Math.abs(deltaX) < Math.abs(deltaY)) return;

    moveRailBy(deltaX < 0 ? 1 : -1);
  };

  return (
    <div className="announcements-page max-w-[1180px] mx-auto">
      {/* Header */}
      <section className="section-head large flex items-center justify-between gap-[18px] max-sm:flex-col max-sm:items-stretch max-sm:gap-3">
        <div>
          <p className="eyebrow mb-6 text-blue text-xs font-bold tracking-widest uppercase">Campus Center</p>
          <h1 className="m-0 text-[clamp(30px,4.2vw,44px)] leading-[1.1] tracking-tight">校园公告</h1>
          <p className="mt-[9px] mb-0 text-text-2 leading-relaxed">探索南大校园最新资讯、讲座、比赛与活动。</p>
        </div>
        <button
          className="primary-button inline-flex items-center justify-center gap-[7px] border-0 rounded-full px-[18px] py-[10px] text-white bg-blue font-bold shadow-sm transition-all duration-150 hover:-translate-y-px hover:bg-blue-2"
          onClick={() => setShowPublishForm(true)}
          type="button"
        >
          <Icon name="add_circle" /> 发布活动
        </button>
      </section>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-line">
        <button
          className={`px-4 py-3 text-sm font-semibold transition-colors duration-150 ${
            activeTab === 'all' ? 'text-blue border-b-2 border-blue' : 'text-text-2 hover:text-text'
          }`}
          onClick={() => setActiveTab('all')}
          type="button"
        >
          校园活动
        </button>
        <button
          className={`px-4 py-3 text-sm font-semibold transition-colors duration-150 ${
            activeTab === 'my' ? 'text-blue border-b-2 border-blue' : 'text-text-2 hover:text-text'
          }`}
          onClick={() => setActiveTab('my')}
          type="button"
        >
          我的申请
        </button>
      </div>

      {/* All Events Tab */}
      {activeTab === 'all' && (
        <>
          {/* Category filter */}
          <div className="category-row flex flex-wrap gap-2 my-[22px]">
            {categories.map((cat) => (
              <button
                className={`rounded-full px-4 py-[10px] text-sm font-semibold shadow-xs transition-all duration-200 active:scale-95 ${
                  category === cat
                    ? 'bg-blue-soft text-blue border border-blue'
                    : 'bg-white text-text-2 border border-line hover:border-[#b0c4de] hover:text-blue'
                }`}
                key={cat}
                onClick={() => setCategory(cat)}
                type="button"
              >
                {cat}
              </button>
            ))}
          </div>

          {searching && (
            <p className="result-hint mb-[14px] text-text-2 text-sm">
              搜索 &quot;{query}&quot; 找到 {visibleCurrentEvents.length + visiblePastEvents.length} 条相关活动。
            </p>
          )}

          {/* Loading state */}
          {publicLoading && (
            <div className="py-12 text-center text-text-2">
              <Icon name="loop" /> 加载中...
            </div>
          )}

          {/* Current Events Rail */}
          {!publicLoading && (
            <section className="announcement-rail-shell mb-8">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.22em] text-text-3">Current Flow</p>
                  <h2 className="m-0 text-[22px] tracking-tight">正在发生的活动</h2>
                </div>
                <div className="announcement-rail-controls max-lg:hidden">
                  <p className="hidden text-sm text-text-3 md:block">轻扫、触控板或箭头切换。</p>
                </div>
              </div>

              <div className="announcement-rail-mask">
                <button
                  type="button"
                  className="announcement-rail-arrow announcement-rail-arrow-prev"
                  onClick={() => handleRailArrow(-1)}
                  aria-label="查看上一个活动"
                >
                  <Icon name="arrow_back" />
                </button>
                <button
                  type="button"
                  className="announcement-rail-arrow announcement-rail-arrow-next"
                  onClick={() => handleRailArrow(1)}
                  aria-label="查看下一个活动"
                >
                  <Icon name="arrow_forward" />
                </button>
                <div
                  className="announcement-rail"
                  onWheel={handleRailWheel}
                  onTouchStart={handleRailTouchStart}
                  onTouchEnd={handleRailTouchEnd}
                >
                  {railItems.map((item, index) => {
                    const visualOffset = getRailOffset(index, railPosition);
                    const absOffset = Math.abs(visualOffset);
                    const isInteractive = absOffset <= Math.min(1.9, railItemCount - 0.55);
                    const cardStyle = {
                      '--rail-offset': visualOffset,
                      '--rail-abs-offset': absOffset,
                      '--rail-focus': Math.max(0, 1 - Math.min(absOffset, 1)),
                      zIndex: Math.max(1, 400 - Math.round(absOffset * 100)),
                    };

                    if (item.kind === 'proposal') {
                      return (
                        <article
                          className={`announcement-rail-card new-event-card ${isInteractive ? '' : 'is-passive'}`}
                          key={item.key}
                          onClick={() => setShowPublishForm(true)}
                          role="button"
                          tabIndex={isInteractive ? 0 : -1}
                          aria-hidden={!isInteractive}
                          style={cardStyle}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setShowPublishForm(true);
                            }
                          }}
                        >
                          <Icon name="add" />
                          <p className="new-event-kicker">New Proposal</p>
                          <h3 className="mt-[14px] mb-[10px] text-[26px] leading-[1.05] tracking-tight">想发起新活动？</h3>
                          <p className="mb-4">把你的创意放进这条流动的公告带里，让更多同学看到。</p>
                          <button
                            type="button"
                            className="border-0 rounded-full px-[13px] py-[9px] text-blue bg-blue-soft font-bold"
                            tabIndex={isInteractive ? 0 : -1}
                            onClick={(event) => {
                              event.stopPropagation();
                              setShowPublishForm(true);
                            }}
                          >
                            前往申请流程
                          </button>
                        </article>
                      );
                    }

                    return (
                      <article
                        className={`announcement-rail-card announcement-card ${isInteractive ? '' : 'is-passive'}`}
                        key={item.key}
                        onClick={() => setSelectedAnnouncement(item.event)}
                        role="button"
                        tabIndex={isInteractive ? 0 : -1}
                        aria-hidden={!isInteractive}
                        style={cardStyle}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedAnnouncement(item.event);
                          }
                        }}
                      >
                        <img
                          alt={item.event.title}
                          src={item.event.image || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=80'}
                          className="announcement-rail-image"
                        />
                        <div className="announcement-rail-body">
                          <div className="announcement-rail-topline">
                            <span className="pill blue inline-flex items-center gap-[5px] w-fit rounded-full px-3 py-2 text-xs font-semibold text-white bg-blue">
                              {item.event.type}
                            </span>
                            <span className="announcement-rail-state">即将开始</span>
                          </div>
                          <h3>{item.event.title}</h3>
                          <p>
                            <Icon name="schedule" /> {formatTimeForDisplay(item.event.time)}
                          </p>
                          <p>
                            <Icon name="location_on" /> {item.event.place}
                          </p>
                          <footer>
                            <strong>点开查看完整信息</strong>
                            <button
                              type="button"
                              tabIndex={isInteractive ? 0 : -1}
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedAnnouncement(item.event);
                              }}
                            >
                              查看详情
                            </button>
                          </footer>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {!publicLoading && visibleCurrentEvents.length === 0 && visiblePastEvents.length === 0 && (
            <div className="py-12 text-center text-text-2">
              {searching ? '没有找到匹配的活动。' : '当前还没有可展示的活动。'}
            </div>
          )}

          {/* Past Events Section */}
          {visiblePastEvents.length > 0 && (
            <section className="archived-section border-t border-line-soft pt-8">
              <button
                className="flex items-center gap-2 text-text-2 text-sm font-semibold hover:text-text transition-colors duration-150"
                onClick={() => setShowPastEvents((prev) => !prev)}
                type="button"
              >
                <Icon name={showPastEvents ? 'expand_less' : 'expand_more'} />
                往期活动 ({visiblePastEvents.length})
              </button>
              {showPastEvents && (
                <div className="mt-4 grid grid-cols-3 gap-5 max-lg:grid-cols-2 max-sm:grid-cols-1">
                  {visiblePastEvents.map((item) => (
                    <article
                      key={item._id}
                      className="announcement-card overflow-hidden rounded-md border border-line-soft bg-surface opacity-70 hover:opacity-100 transition-all duration-150"
                    >
                      {item.image && (
                        <img
                          alt={item.title}
                          src={item.image}
                          className="w-full h-[180px] object-cover grayscale"
                        />
                      )}
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="pill text-text-3 inline-flex items-center gap-[5px] w-fit rounded-full px-2 py-1 text-[10px] font-semibold bg-surface-soft border border-line-soft">
                            {item.type}
                          </span>
                          <span className="text-text-3 text-[10px] uppercase tracking-wider font-semibold">已结束</span>
                        </div>
                        <h4 className="mb-2 text-base font-bold tracking-tight">{item.title}</h4>
                        <p className="flex items-center gap-2 mb-1 text-text-3 text-xs">
                          <Icon name="schedule" /> {formatTimeForDisplay(item.time)}
                        </p>
                        <p className="flex items-center gap-2 text-text-3 text-xs">
                          <Icon name="location_on" /> {item.place}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* My Applications Tab */}
      {activeTab === 'my' && (
        <div className="my-applications">
          {!isAuthenticated && (
            <div className="py-12 text-center text-text-2">
              <p>请先登录查看您的申请</p>
            </div>
          )}

          {isAuthenticated && myEventsLoading && (
            <div className="py-12 text-center text-text-2">
              <Icon name="loop" /> 加载中...
            </div>
          )}

          {isAuthenticated && !myEventsLoading && myEvents.length === 0 && (
            <div className="py-12 text-center text-text-2">
              <p>您还没有提交过活动申请</p>
              <button
                className="mt-4 text-blue font-semibold"
                onClick={() => setShowPublishForm(true)}
                type="button"
              >
                立即发布活动
              </button>
            </div>
          )}

          {isAuthenticated && !myEventsLoading && myEvents.length > 0 && searching && (
            <p className="result-hint mb-[14px] text-text-2 text-sm">
              搜索 &quot;{query}&quot; 找到 {visibleMyEvents.length} 条相关申请。
            </p>
          )}

          {isAuthenticated && !myEventsLoading && myEvents.length > 0 && visibleMyEvents.length > 0 && (
            <div className="space-y-4">
              {visibleMyEvents.map((event) => {
                const statusInfo = getEventStatus(event);
                return (
                  <div
                    key={event._id}
                    className="flex items-center gap-4 max-sm:flex-col max-sm:items-start p-4 border border-line-soft rounded-lg bg-white"
                  >
                    {event.image && (
                      <img
                        src={event.image}
                        alt={event.title}
                        className="w-20 h-20 object-cover rounded-md flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-text truncate">{event.title}</h4>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <p className="text-text-2 text-sm">{event.type}</p>
                      <p className="text-text-3 text-xs mt-1">
                        <Icon name="schedule" className="inline mr-1" />
                        {formatTimeForDisplay(event.time)}
                        <span className="mx-2">|</span>
                        <Icon name="location_on" className="inline mr-1" />
                        {event.place}
                      </p>
                      {event.status === 'rejected' && event.rejectionReason && (
                        <PlainTextContent
                          className="text-red-600 text-xs mt-2 bg-red-50 p-2 rounded"
                          content={`拒绝原因：${event.rejectionReason}`}
                        />
                      )}
                    </div>
                    <button
                      className="text-blue text-sm font-semibold px-3 py-1.5 rounded-full bg-blue-soft hover:bg-blue hover:text-white transition-colors"
                      onClick={() => setSelectedAnnouncement(event)}
                      type="button"
                    >
                      查看
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {isAuthenticated && !myEventsLoading && myEvents.length > 0 && visibleMyEvents.length === 0 && (
            <div className="py-12 text-center text-text-2">
              <p>{searching ? '没有找到匹配的活动申请' : '您还没有提交过活动申请'}</p>
            </div>
          )}
        </div>
      )}

      {/* Announcement Detail Modal */}
      {selectedAnnouncement && (
        <div
          className="modal-overlay fixed inset-0 z-[150] grid place-items-center bg-black/40 animate-modal-fade-in"
          onClick={() => setSelectedAnnouncement(null)}
        >
          <div
            className="modal-content w-[min(560px,90vw)] max-h-[85vh] overflow-y-auto rounded-lg bg-white shadow-md animate-modal-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={
                selectedAnnouncement.image ||
                'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=80'
              }
              alt={selectedAnnouncement.title}
              className="w-full h-[240px] object-cover rounded-t-lg"
            />
            <div className="p-6 max-sm:p-4">
              <span className="pill blue inline-flex items-center gap-[5px] w-fit rounded-full px-3 py-2 text-xs font-semibold text-white bg-blue">
                {selectedAnnouncement.type}
              </span>
              <h2 className="mt-[14px] mb-[10px] text-2xl tracking-tight">{selectedAnnouncement.title}</h2>
              <p className="flex items-center gap-2 my-2 text-text-2 text-[15px]">
                <Icon name="schedule" /> {formatTimeForDisplay(selectedAnnouncement.time)}
              </p>
              <p className="flex items-center gap-2 my-2 text-text-2 text-[15px]">
                <Icon name="location_on" /> {selectedAnnouncement.place}
              </p>
              {selectedAnnouncement.description ? (
                <PlainTextContent
                  className="modal-desc block !mt-4 pt-4 border-t border-line-soft leading-relaxed"
                  content={selectedAnnouncement.description}
                />
              ) : (
                <p className="modal-desc block !mt-4 pt-4 border-t border-line-soft leading-relaxed">
                  欢迎全校师生参加！详情请关注校内通知，或扫描活动现场二维码报名。名额有限，先到先得。
                </p>
              )}
              {selectedAnnouncement.status === 'rejected' && selectedAnnouncement.rejectionReason && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-red-700 text-sm font-semibold">拒绝原因</p>
                  <PlainTextContent className="text-red-600 text-sm mt-1" content={selectedAnnouncement.rejectionReason} />
                </div>
              )}
              <div className="modal-actions flex justify-end items-center mt-5">
                <button
                  className="primary-button inline-flex items-center justify-center gap-[7px] border-0 rounded-full px-[18px] py-[10px] text-white bg-blue font-bold shadow-sm transition-all duration-150 hover:-translate-y-px hover:bg-blue-2"
                  type="button"
                  onClick={() => setSelectedAnnouncement(null)}
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Publish Event Modal */}
      {showPublishForm && (
        <div
          className="modal-overlay fixed inset-0 z-[150] grid place-items-center bg-black/40 animate-modal-fade-in"
        >
          <div
            className="modal-content w-[min(560px,90vw)] max-h-[85vh] overflow-y-auto rounded-lg bg-white shadow-md animate-modal-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {posterPreview && (
              <img src={posterPreview} alt="poster preview" className="w-full h-[240px] max-sm:h-[180px] object-cover rounded-t-lg" />
            )}
            <div className="p-6 max-sm:p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl tracking-tight">发布新活动</h2>
                <button
                  className="p-2 rounded-full hover:bg-surface-soft transition-colors"
                  onClick={() => {
                    setShowPublishForm(false);
                    resetPublishForm();
                  }}
                  type="button"
                >
                  <Icon name="close" />
                </button>
              </div>
              <div className="modal-form grid gap-3 mt-4">
                <input
                  className="w-full px-[14px] py-[10px] border border-line rounded-sm bg-white text-text text-sm"
                  placeholder="活动名称 *"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                />
                <input
                  className="w-full px-[14px] py-[10px] border border-line rounded-sm bg-white text-text text-sm"
                  placeholder="活动地点 *"
                  value={newEvent.place}
                  onChange={(e) => setNewEvent({ ...newEvent, place: e.target.value })}
                />
                <input
                  className="w-full px-[14px] py-[10px] border border-line rounded-sm bg-white text-text text-sm"
                  placeholder="活动时间 *"
                  type="datetime-local"
                  value={newEvent.time}
                  onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                />
                <select
                  className="px-[14px] py-[10px] border border-line rounded-sm bg-white text-sm"
                  value={newEvent.type}
                  onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value })}
                >
                  <option value="官方活动">官方活动</option>
                  <option value="学术讲座">学术讲座</option>
                  <option value="体育赛事">体育赛事</option>
                  <option value="科技竞赛">科技竞赛</option>
                  <option value="志愿公益">志愿公益</option>
                  <option value="答辩">答辩</option>
                  <option value="校招">校招</option>
                </select>
                <textarea
                  className="w-full px-[14px] py-[10px] border border-line rounded-sm bg-white text-text text-sm min-h-[80px] resize-y"
                  placeholder="活动简介（选填）"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                />
                <div className="border-t border-line-soft pt-3 mt-2">
                  <p className="text-sm font-semibold text-text-2 mb-2">申请人信息（仅管理员可见）</p>
                  <div className="grid gap-3">
                    <input
                      className="w-full px-[14px] py-[10px] border border-line rounded-sm bg-white text-text text-sm"
                      placeholder="姓名 *"
                      value={newEvent.applicantName}
                      onChange={(e) => setNewEvent({ ...newEvent, applicantName: e.target.value })}
                    />
                    <input
                      className="w-full px-[14px] py-[10px] border border-line rounded-sm bg-white text-text text-sm"
                      placeholder="学号 *"
                      value={newEvent.applicantStudentId}
                      onChange={(e) => setNewEvent({ ...newEvent, applicantStudentId: e.target.value })}
                    />
                    <input
                      className="w-full px-[14px] py-[10px] border border-line rounded-sm bg-white text-text text-sm"
                      placeholder="手机号 *"
                      value={newEvent.applicantPhone}
                      onChange={(e) => setNewEvent({ ...newEvent, applicantPhone: e.target.value })}
                    />
                    <input
                      className="w-full px-[14px] py-[10px] border border-line rounded-sm bg-white text-text text-sm"
                      placeholder="QQ号 *"
                      value={newEvent.applicantQQ}
                      onChange={(e) => setNewEvent({ ...newEvent, applicantQQ: e.target.value })}
                    />
                  </div>
                </div>
                <div className="poster-upload flex items-center gap-2.5 flex-wrap">
                  <label className="text-sm font-semibold text-text-2">活动海报</label>
                  <button
                    type="button"
                    className="secondary-button inline-flex items-center justify-center gap-[7px] border border-line rounded-full px-4 py-[7px] bg-white text-text-2 text-[13px] font-semibold transition-all duration-150"
                    onClick={() => posterInputRef.current?.click()}
                  >
                    <Icon name="image" /> {posterPreview ? '更换海报' : '上传海报'}
                  </button>
                  <input
                    ref={posterInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handlePosterSelect}
                  />
                  {posterPreview && <span className="poster-hint text-green text-xs font-semibold">已选择图片</span>}
                </div>
              </div>
              <div className="modal-actions flex justify-end gap-2.5 mt-5">
                <button
                  className="secondary-button inline-flex items-center justify-center gap-[7px] border border-line rounded-full px-4 py-[7px] bg-white text-text-2 text-[13px] font-semibold transition-all duration-150"
                  onClick={() => {
                    setShowPublishForm(false);
                    resetPublishForm();
                  }}
                  type="button"
                >
                  取消
                </button>
                <button
                  className="primary-button inline-flex items-center justify-center gap-[7px] border-0 rounded-full px-[18px] py-[10px] text-white bg-blue font-bold shadow-sm transition-all duration-150 hover:-translate-y-px hover:bg-blue-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handlePublishEvent}
                  disabled={
                    !newEvent.title.trim() ||
                    !newEvent.place.trim() ||
                    !newEvent.time.trim() ||
                    !newEvent.applicantName.trim() ||
                    !newEvent.applicantStudentId.trim() ||
                    !newEvent.applicantPhone.trim() ||
                    !newEvent.applicantQQ.trim()
                  }
                  type="button"
                >
                  提交申请
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AnnouncementsPage;
