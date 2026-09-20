function normalizeSearchValue(value) {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.join(' ');
  }
  return value == null ? '' : String(value);
}

export function normalizeSearchQuery(query) {
  return typeof query === 'string' ? query.trim().toLowerCase() : '';
}

export function hasSearchQuery(query) {
  return normalizeSearchQuery(query).length > 0;
}

export function matchesSearchQuery(query, values) {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) return true;

  const haystack = values
    .map((value) => normalizeSearchValue(value).trim().toLowerCase())
    .filter(Boolean)
    .join(' ');

  return haystack.includes(normalizedQuery);
}

export function matchPostQuery(post, query) {
  return matchesSearchQuery(query, [
    post?.title,
    post?.content,
    post?.authorName,
    post?.tags || [],
  ]);
}

export function matchEventQuery(event, query) {
  return matchesSearchQuery(query, [
    event?.title,
    event?.place,
    event?.description,
    event?.type,
    event?.status,
    event?.rejectionReason,
  ]);
}

export function matchLikedCommentQuery(comment, relatedPostTitle, query) {
  return matchesSearchQuery(query, [
    comment?.item?.content,
    comment?.postTitle,
    relatedPostTitle,
    comment?.type === 'reply' ? 'reply' : 'comment',
  ]);
}
