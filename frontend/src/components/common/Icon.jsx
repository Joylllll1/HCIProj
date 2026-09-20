import React from 'react';

const Icon = ({ name, filled = false, className = '', size, style }) => {
  const paths = {
    dynamic_feed: 'M4 5.5h16M4 12h10M4 18.5h13',
    campaign: 'M5 13h3l8 4V7l-8 4H5v2Zm3 0v5',
    bookmark: 'M7 5h10v15l-5-3-5 3V5Z',
    edit_square: 'M5 19h14M7 15.5 16.5 6 18 7.5 8.5 17H7v-1.5Z',
    admin_panel_settings: 'M12 3 19 6v5c0 4-2.8 7.4-7 9-4.2-1.6-7-5-7-9V6l7-3Zm0 5v5l3 2',
    park: 'M12 3 6 10h4l-3 5h4v5h2v-5h4l-3-5h4l-6-7Z',
    search: 'M10.5 18a7.5 7.5 0 1 1 5.3-12.8A7.5 7.5 0 0 1 10.5 18Zm5.2-2.3 4.3 4.3',
    auto_awesome: 'M12 3l1.2 4.2L17 9l-3.8 1.8L12 15l-1.2-4.2L7 9l3.8-1.8L12 3ZM5 14l.7 2.3L8 17l-2.3.7L5 20l-.7-2.3L2 17l2.3-.7L5 14Zm14-1 .8 2.7L22 17l-2.2 1.3L19 21l-.8-2.7L16 17l2.2-1.3L19 13Z',
    notifications: 'M18 16H6l1.5-2V10a4.5 4.5 0 0 1 9 0v4L18 16ZM10 19h4',
    person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
    favorite: 'M12 20s-7-4.4-8.5-9.2C2.5 7.6 4.4 5 7.2 5c1.7 0 3.1.9 4 2.1.7-1.2 2.2-2.1 3.9-2.1 2.8 0 4.7 2.6 3.7 5.8C17.3 15.6 12 20 12 20Z',
    favorite_border: 'M12 20s-7-4.4-8.5-9.2C2.5 7.6 4.4 5 7.2 5c1.7 0 3.1.9 4 2.1.7-1.2 2.2-2.1 3.9-2.1 2.8 0 4.7 2.6 3.7 5.8C17.3 15.6 12 20 12 20Z',
    chat_bubble: 'M5 6h14v9H9l-4 4V6Z',
    smart_toy: 'M8 9h8a3 3 0 0 1 3 3v5H5v-5a3 3 0 0 1 3-3Zm4 0V5m-4 8h.1m7.9 0h.1M9 17h6',
    local_fire_department: 'M12 21c-3.5-1.6-5-3.7-5-6.5 0-2.5 1.5-4.2 3.2-5.9.9-.9 1.6-2 1.8-3.6 2.8 1.7 5 4.4 5 8 0 3.5-1.9 6.2-5 8Z',
    verified_user: 'M12 3 19 6v5c0 4-2.8 7.4-7 9-4.2-1.6-7-5-7-9V6l7-3Zm-3 9 2 2 4-5',
    thumb_up: 'M8 11v9H4v-9h4Zm0 0 4-7c1.3 0 2 1 1.5 2.5L13 9h5a2 2 0 0 1 2 2l-1.2 7a2 2 0 0 1-2 2H8',
    image: 'M4 6h16v12H4V6Zm3 9 3-3 2 2 3-4 3 5',
    sentiment_satisfied: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8.5 10h.1m6.8 0h.1M8 14c1 1.4 2.3 2 4 2s3-.6 4-2',
    sentiment_very_satisfied: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8 10h.1m7.9 0h.1M8 14h8c-.8 2-2.1 3-4 3s-3.2-1-4-3Z',
    sentiment_neutral: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8.5 10h.1m6.8 0h.1M8 15h8',
    sentiment_dissatisfied: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8.5 10h.1m6.8 0h.1M8 16c1-1.4 2.3-2 4-2s3 .6 4 2',
    alternate_email: 'M16 12a4 4 0 1 1-1.2-2.8V12a2 2 0 0 0 4 0 7 7 0 1 0-2.5 5.4',
    tag: 'M4 12 12 4h7v7l-8 8-7-7Zm11-5h.1',
    add_circle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v8m-4-4h8',
    schedule: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3 2',
    location_on: 'M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Zm0-8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
    add: 'M12 5v14M5 12h14',
    masks: 'M5 8c3-2 5-2 7 0 2-2 4-2 7 0v4c0 4-3 6-7 7-4-1-7-3-7-7V8Zm3 4h2m4 0h2',
    shield_person: 'M12 3 19 6v5c0 4-2.8 7.4-7 9-4.2-1.6-7-5-7-9V6l7-3Zm0 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm-4 4a4.5 4.5 0 0 1 8 0',
    sensors: 'M7 12a5 5 0 0 1 10 0m-13 0a8 8 0 0 1 16 0m-8 0h.1',
    history_edu: 'M4 6h12v12H4V6Zm12 3 4-2v10l-4-2',
    report_problem: 'M12 4 21 20H3L12 4Zm0 5v5m0 3h.1',
    forum: 'M4 5h13v9H8l-4 4V5Zm5 13h7l4 3V9',
    fingerprint: 'M12 11v3m-4-1a4 4 0 0 1 8 0c0 3-1 5-2 7m-6-3c.5-2 0-4 0-4a4 4 0 0 1 8 0m-11 1a7 7 0 0 1 14 0',
    inventory_2: 'M4 7 12 3l8 4v10l-8 4-8-4V7Zm0 0 8 4 8-4M12 11v10',
    send: 'M3 4.5 21 12 3 19.5v-6l10.5-1.5L3 10.5v-6Z',
    bookmark_border: 'M7 5h10v15l-5-3-5 3V5Z',
    arrow_back: 'M5 12h14M5 12l5-5M5 12l5 5',
    arrow_forward: 'M19 12H5m14 0-5-5m5 5-5 5',
    delete: 'M6 7h12M6 7l1 12h10l1-12M9 7V5h6v2m-4 4v5m2-5v5',
    edit: 'M5 3l10 10M3 21l3-1 11-11-2-2-11 11-1 3Z',
    check: 'M5 12l5 5L20 7',
    loop: 'M12 4a8 8 0 0 1 8 8M20 12l-3-3m3 3-3 3M4 12l3-3m-3 3 3 3',
    expand_less: 'M7 14l5-5 5 5',
    expand_more: 'M7 10l5 5 5-5',
    error_outline: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-1-13v5m0 4h.1',
    construction: 'M17.5 11.5l-5-5M4.5 19.5l5-5 2 2-5 5Zm8-8 5 5-2 2-5-5 2-2Z',
    logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 12 4-4-4-4m-8 4h12',
    gavel: 'M1 21h12M3 17l9-9 3 3-9 9H3v-3Zm10-10 3-3 3 3-3 3-3-3Z',
    receipt_long: 'M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-3-2-2 2-2-2-2 2-2-2-3 2Zm3-8h8m-8-4h8',
    close: 'M6 6l12 12M6 18L18 6',
    chevron_left: 'M15 6l-6 6 6 6',
    chevron_right: 'M9 6l6 6-6 6',
    download: 'M12 3v10m0 0 4-4m-4 4-4-4M5 17v2h14v-2',
    zoom_in: 'M11 8v6m-3-3h6m5 8-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z',
    zoom_out: 'M8 11h6m5 8-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z',
    home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
    description: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
    menu: 'M3 6h18M3 12h18M3 18h18',
    settings: 'M19.1 12.9c.04-.3.07-.6.07-.9s-.03-.6-.08-.9l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.6-.22l-2.49 1a7.03 7.03 0 0 0-1.56-.9l-.38-2.65a.5.5 0 0 0-.5-.42h-4a.5.5 0 0 0-.5.42l-.38 2.65c-.56.23-1.08.53-1.56.9l-2.49-1a.5.5 0 0 0-.6.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65c-.05.3-.08.6-.08.9s.03.6.08.9L2.2 14.55a.5.5 0 0 0-.12.64l2 3.46a.5.5 0 0 0 .6.22l2.49-1c.48.37 1 .67 1.56.9l.38 2.65a.5.5 0 0 0 .5.42h4a.5.5 0 0 0 .5-.42l.38-2.65c.56-.23 1.08-.53 1.56-.9l2.49 1a.5.5 0 0 0 .6-.22l2-3.46a.5.5 0 0 0-.12-.64zM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5z',
    refresh: 'M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
    content_copy: 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z',
  };

  const iconStyle = size
    ? {
      width: size,
      height: size,
      ...style,
    }
    : style;

  return (
    <svg
      className={`app-icon ${filled ? 'filled' : ''} ${className}`.trim()}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={iconStyle}
    >
      <path d={paths[name] ?? paths.dynamic_feed} />
    </svg>
  );
};

export default Icon;
