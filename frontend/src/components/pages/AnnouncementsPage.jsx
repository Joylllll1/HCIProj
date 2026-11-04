import Select from '../common/Select';
import React, { useState, useEffect, useRef } from 'react';
import useDialogFocus from '../../hooks/useDialogFocus';
import PageHeader from '../common/PageHeader';
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
  pending: { label: '待审核', color: 'event-status-pending' },
  approved: { label: '已通过', color: 'event-status-approved' },
  rejected: { label: '已拒绝', color: 'event-status-rejected' },
  archived: { label: '已归档', color: 'event-status-archived' },
  deleted: { label: '已下架', color: 'event-status-deleted' },
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
  const [posterProcessing, setPosterProcessing] = useState(false);
  const [posterError, setPosterError] = useState('');
  const posterProcessingRef = useRef(false);
  const [submitPending, setSubmitPending] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const submitPendingRef = useRef(false);

  // Past events fold
  const [showPastEvents, setShowPastEvents] = useState(false);

  const eventDialogRef = useRef(null);
  const publishDialogRef = useRef(null);
  useDialogFocus(eventDialogRef, Boolean(selectedAnnouncement), () => setSelectedAnnouncement(null));
  useDialogFocus(publishDialogRef, showPublishForm, () => setShowPublishForm(false), submitPending);

  // Store
  const publicEvents = useEventStore((s) => s.publicEvents);
  const myEvents = useEventStore((s) => s.myEvents);
  const publicLoading = useEventStore((s) => s.publicLoading);
  const myEventsLoading = useEventStore((s) => s.myEventsLoading);
  const publicError = useEventStore((s) => s.publicError);
  const myEventsError = useEventStore((s) => s.myEventsError);
  const fetchPublicEvents = useEventStore((s) => s.fetchPublicEvents);
  const fetchMyEvents = useEventStore((s) => s.fetchMyEvents);
  const submitEvent = useEventStore((s) => s.submitEvent);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentUserId = useAuthStore((s) => s.user?._id);
  const query = useUiStore((s) => s.query);

  // Fetch events on mount
  useEffect(() => {
    fetchPublicEvents();
    if (isAuthenticated) {
      fetchMyEvents();
    }
  }, [fetchPublicEvents, fetchMyEvents, isAuthenticated, currentUserId]);

  useEffect(() => () => {
    if (posterPreviewUrlRef.current) {
      URL.revokeObjectURL(posterPreviewUrlRef.current);
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
  const visiblePastEvents = pastEvents.filter((event) => (category === '全部活动' || event.type === category) && matchEventQuery(event, query));
  const visibleMyEvents = myEvents.filter((event) => matchEventQuery(event, query));
  const searching = hasSearchQuery(query);
  const hasPublishDraft = newEvent.type !== '官方活动' || Object.entries(newEvent).some(([key, value]) => key !== 'type' && Boolean(value)) || Boolean(posterPreview);
  // Handle poster upload
  const handlePosterSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setPosterError('');
      if (file.size > MAX_POSTER_SIZE_BYTES) {
        setPosterError('活动海报过大，请上传 3MB 以内图片。');
        e.target.value = '';
        return;
      }
      if (file.type && !file.type.startsWith('image/')) {
        setPosterError('请选择图片文件。');
        e.target.value = '';
        return;
      }

      posterProcessingRef.current = true;
      setPosterProcessing(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result;
        if (typeof result !== 'string' || !result) {
          setPosterError('海报读取失败，请重新选择图片。');
          e.target.value = '';
          posterProcessingRef.current = false;
          setPosterProcessing(false);
          return;
        }
        try {
          const url = URL.createObjectURL(file);
          if (posterPreviewUrlRef.current) URL.revokeObjectURL(posterPreviewUrlRef.current);
          posterPreviewUrlRef.current = url;
          setPosterPreview(url);
          setNewEvent((prev) => ({ ...prev, poster: result }));
        } catch {
          setPosterError('海报读取失败，请重新选择图片。');
          e.target.value = '';
        } finally {
          posterProcessingRef.current = false;
          setPosterProcessing(false);
        }
      };
      reader.onerror = () => {
        setPosterError('海报读取失败，请重新选择图片。');
        e.target.value = '';
        posterProcessingRef.current = false;
        setPosterProcessing(false);
      };
      reader.onabort = reader.onerror;
      try {
        reader.readAsDataURL(file);
      } catch {
        reader.onerror?.();
      }
    }
  };

  // Handle publish event
  const handlePublishEvent = async () => {
    if (submitPendingRef.current || posterProcessingRef.current) return;
    if (!newEvent.title.trim() || !newEvent.place.trim() || !newEvent.time.trim() || !newEvent.applicantName.trim() || !newEvent.applicantStudentId.trim() || !newEvent.applicantPhone.trim() || !newEvent.applicantQQ.trim()) return;

    // Validate event time is in the future
    const eventTime = new Date(newEvent.time);
    if (eventTime <= new Date()) {
      setSubmitError('活动时间必须在现在之后。');
      return;
    }

    submitPendingRef.current = true;
    setSubmitPending(true);
    setSubmitError('');
    try {
      await submitEvent({
        title: newEvent.title,
        place: newEvent.place,
        time: eventTime.toISOString(),
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
      setSubmitError(err?.message || '提交失败，请重试。');
    } finally {
      submitPendingRef.current = false;
      setSubmitPending(false);
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

  const closePublishForm = () => {
    if (submitPendingRef.current) return;
    setShowPublishForm(false);
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

  const renderEventRow = (event, archived = false) => (
    <article className="event-list-row" key={event._id}>
      <div className="event-date"><strong>{new Date(event.time).getDate()}</strong><span>{new Date(event.time).getMonth() + 1} 月</span></div>
      <div className="event-row-copy"><div className="event-row-meta"><span>{event.type}</span><span>{archived ? '已结束' : '即将开始'}</span></div><button type="button" className="row-title" onClick={() => setSelectedAnnouncement(event)}>{event.title}</button><p><Icon name="schedule" />{formatTimeForDisplay(event.time)}<Icon name="location_on" />{event.place}</p></div>
      {event.image && <img className="event-thumbnail" src={event.image} alt="活动海报" />}
      <button type="button" className="event-open" aria-label={`查看活动：${event.title}`} onClick={() => setSelectedAnnouncement(event)}><Icon name="chevron_right" /></button>
    </article>
  );

  return (
    <div className="announcements-page max-w-[1180px] mx-auto">
      <PageHeader title="校园公告" description={hasPublishDraft && !showPublishForm ? '活动申请草稿已保留，可继续编辑。' : '校园里的讲座、比赛和活动。'} actions={<button className="primary-button" type="button" onClick={() => setShowPublishForm(true)}><Icon name="add" />{hasPublishDraft ? '继续编辑申请' : '发布活动'}</button>} />

      {/* Tabs */}
      <div className="page-tabs" aria-label="活动列表">
        <button
          className={`px-4 py-3 text-sm font-semibold transition-colors duration-150 ${
            activeTab === 'all' ? 'text-blue border-b-2 border-blue' : 'text-text-2 hover:text-text'
          }`}
          aria-pressed={activeTab === 'all'}
          onClick={() => setActiveTab('all')}
          type="button"
        >
          校园活动
        </button>
        <button
          className={`px-4 py-3 text-sm font-semibold transition-colors duration-150 ${
            activeTab === 'my' ? 'text-blue border-b-2 border-blue' : 'text-text-2 hover:text-text'
          }`}
          aria-pressed={activeTab === 'my'}
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
          <div className="event-category-row"><label htmlFor="event-category">活动分类</label><Select id="event-category" aria-label="活动分类" value={category} onChange={setCategory} options={categories.map(cat => ({ value: cat, label: cat }))} /><span>{visibleCurrentEvents.length} 场近期活动</span></div>
          <div className="event-category-buttons category-row flex flex-wrap gap-2 my-[22px]">
            {categories.map((cat) => (
              <button
                className={`rounded-full px-4 py-[10px] text-sm font-semibold shadow-xs transition-all duration-200 active:scale-95 ${
                  category === cat
                    ? 'bg-blue-soft text-blue border border-blue'
                    : 'bg-surface text-text-2 border border-line hover:border-[#b0c4de] hover:text-blue'
                }`}
                key={cat}
                aria-pressed={category === cat}
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

          {publicError && <div className="feed-error" role="alert"><span>{publicError}{publicEvents.length > 0 && ' 当前保留上次加载的活动。'}</span><button type="button" onClick={fetchPublicEvents} disabled={publicLoading}>重试加载活动</button></div>}

          {!publicLoading && visibleCurrentEvents.length > 0 && <section className="event-list" aria-label="近期活动">{visibleCurrentEvents.map((event) => renderEventRow(event))}</section>}
          {!publicLoading && !publicError && visibleCurrentEvents.length === 0 && <div className="page-empty"><p>{searching ? '没有找到匹配的近期活动。' : '这个分类暂时没有近期活动。'}</p><button type="button" className="secondary-button" onClick={() => setShowPublishForm(true)}>申请发布活动</button></div>}
          {visiblePastEvents.length > 0 && <section className="archived-section"><button className="archived-toggle" type="button" aria-expanded={showPastEvents} onClick={() => setShowPastEvents(!showPastEvents)}><Icon name={showPastEvents ? 'expand_less' : 'expand_more'} />往期活动 ({visiblePastEvents.length})</button>{showPastEvents && <div className="event-list">{visiblePastEvents.map((event) => renderEventRow(event, true))}</div>}</section>}
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

          {isAuthenticated && myEventsError && <div className="feed-error" role="alert"><span>{myEventsError}{myEvents.length > 0 && ' 当前保留上次加载的申请。'}</span><button type="button" onClick={fetchMyEvents} disabled={myEventsLoading}>重试加载申请</button></div>}

          {isAuthenticated && !myEventsLoading && !myEventsError && myEvents.length === 0 && (
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
            <div className="application-list">
              {visibleMyEvents.map((event) => {
                const statusInfo = getEventStatus(event);
                return (
                  <div
                    key={event._id}
                    className="application-row"
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
            className="modal-content event-dialog w-[min(560px,90vw)] max-h-[85vh] overflow-y-auto rounded-lg bg-surface shadow-md animate-modal-scale-in"
            ref={eventDialogRef} role="dialog" aria-modal="true" aria-label={selectedAnnouncement.title}
            onClick={(e) => e.stopPropagation()}
          >
            {selectedAnnouncement.image && <img src={selectedAnnouncement.image} alt={selectedAnnouncement.title} className="w-full max-h-[240px] object-contain" />}
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
                  暂无补充说明，请以活动时间与地点为准。
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
            className="modal-content event-dialog w-[min(560px,90vw)] max-h-[85vh] overflow-y-auto rounded-lg bg-surface shadow-md animate-modal-scale-in"
            ref={publishDialogRef} role="dialog" aria-modal="true" aria-label="发布新活动"
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
                  aria-label="关闭发布活动"
                  disabled={submitPending}
                  onClick={closePublishForm}
                  type="button"
                >
                  <Icon name="close" />
                </button>
              </div>
              <fieldset className="modal-form grid gap-3 mt-4 min-w-0 border-0 p-0" disabled={submitPending || posterProcessing}>
                <input
                  className="w-full px-[14px] py-[10px] border border-line rounded-sm bg-surface text-text text-sm"
                  placeholder="活动名称 *"
                  aria-label="活动名称"
                  required
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                />
                <input
                  className="w-full px-[14px] py-[10px] border border-line rounded-sm bg-surface text-text text-sm"
                  placeholder="活动地点 *"
                  aria-label="活动地点"
                  required
                  value={newEvent.place}
                  onChange={(e) => setNewEvent({ ...newEvent, place: e.target.value })}
                />
                <input
                  className="w-full px-[14px] py-[10px] border border-line rounded-sm bg-surface text-text text-sm"
                  placeholder="活动时间 *"
                  aria-label="活动时间"
                  required
                  type="datetime-local"
                  value={newEvent.time}
                  onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                />
                <Select aria-label="活动类型" className="event-type-select" disabled={submitPending || posterProcessing} value={newEvent.type} onChange={type => setNewEvent({ ...newEvent, type })} options={['官方活动', '学术讲座', '体育赛事', '科技竞赛', '志愿公益', '答辩', '校招'].map(type => ({ value: type, label: type }))} />
                <textarea
                  aria-label="活动简介"
                  className="w-full px-[14px] py-[10px] border border-line rounded-sm bg-surface text-text text-sm min-h-[80px] resize-y"
                  placeholder="活动简介（选填）"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                />
                <div className="border-t border-line-soft pt-3 mt-2">
                  <p className="text-sm font-semibold text-text-2 mb-2">申请人信息（仅管理员可见）</p>
                  <div className="grid gap-3">
                    <input
                      className="w-full px-[14px] py-[10px] border border-line rounded-sm bg-surface text-text text-sm"
                      placeholder="姓名 *"
                      aria-label="申请人姓名"
                      required
                      value={newEvent.applicantName}
                      onChange={(e) => setNewEvent({ ...newEvent, applicantName: e.target.value })}
                    />
                    <input
                      className="w-full px-[14px] py-[10px] border border-line rounded-sm bg-surface text-text text-sm"
                      placeholder="学号 *"
                      aria-label="申请人学号"
                      required
                      value={newEvent.applicantStudentId}
                      onChange={(e) => setNewEvent({ ...newEvent, applicantStudentId: e.target.value })}
                    />
                    <input
                      className="w-full px-[14px] py-[10px] border border-line rounded-sm bg-surface text-text text-sm"
                      placeholder="手机号 *"
                      aria-label="申请人手机号"
                      required
                      value={newEvent.applicantPhone}
                      onChange={(e) => setNewEvent({ ...newEvent, applicantPhone: e.target.value })}
                    />
                    <input
                      className="w-full px-[14px] py-[10px] border border-line rounded-sm bg-surface text-text text-sm"
                      placeholder="QQ号 *"
                      aria-label="申请人 QQ 号"
                      required
                      value={newEvent.applicantQQ}
                      onChange={(e) => setNewEvent({ ...newEvent, applicantQQ: e.target.value })}
                    />
                  </div>
                </div>
                <div className="poster-upload flex items-center gap-2.5 flex-wrap">
                  <label className="text-sm font-semibold text-text-2">活动海报</label>
                  <button
                    type="button"
                    className="secondary-button inline-flex items-center justify-center gap-[7px] border border-line rounded-full px-4 py-[7px] bg-surface text-text-2 text-[13px] font-semibold transition-all duration-150"
                    aria-label={posterPreview ? '更换活动海报' : '选择活动海报'}
                    onClick={() => posterInputRef.current?.click()}
                  >
                    <Icon name="image" /> {posterPreview ? '更换海报' : '上传海报'}
                  </button>
                  <input
                    ref={posterInputRef}
                    type="file"
                    accept="image/*"
                    aria-label="活动海报图片文件"
                    style={{ display: 'none' }}
                    onChange={handlePosterSelect}
                  />
                  {posterPreview && <span className="poster-hint text-green text-xs font-semibold">已选择图片</span>}
                  {posterProcessing && <span className="text-text-2 text-xs" role="status">正在读取海报…</span>}
                </div>
                {posterError && <p className="inline-error" role="alert">{posterError}</p>}
              </fieldset>
              {submitError && <p className="inline-error mt-3" role="alert">{submitError}</p>}
              <div className="modal-actions flex justify-end gap-2.5 mt-5">
                <button
                  className="secondary-button inline-flex items-center justify-center gap-[7px] border border-line rounded-full px-4 py-[7px] bg-surface text-text-2 text-[13px] font-semibold transition-all duration-150"
                  onClick={closePublishForm}
                  disabled={submitPending}
                  type="button"
                >
                  取消
                </button>
                <button
                  className="primary-button inline-flex items-center justify-center gap-[7px] border-0 rounded-full px-[18px] py-[10px] text-white bg-blue font-bold shadow-sm transition-all duration-150 hover:-translate-y-px hover:bg-blue-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handlePublishEvent}
                  disabled={
                    submitPending || posterProcessing ||
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
                  {submitPending ? '正在提交…' : '提交申请'}
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
