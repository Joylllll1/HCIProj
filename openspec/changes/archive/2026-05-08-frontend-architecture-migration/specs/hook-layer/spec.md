## ADDED Requirements

### Requirement: usePostActions hook for post interactions

The system SHALL provide a `usePostActions` hook that encapsulates post-related business logic (opening a post detail, filtering posts).

#### Scenario: Open a post detail view
- **WHEN** a component calls `usePostActions().openPost(post)`
- **THEN** the selected post SHALL be set in the post store
- **AND** the active page SHALL be navigated to 'detail'

#### Scenario: Filter posts by search query
- **WHEN** the search query changes
- **THEN** the hook SHALL return a filtered list of posts whose title, content, or tags match the query (case-insensitive)
- **AND** the query state SHALL be managed via uiStore

### Requirement: useLikeBookmark hook for like and bookmark toggles

The system SHALL provide a `useLikeBookmark` hook that encapsulates like and bookmark toggle logic.

#### Scenario: Toggle like on a post
- **WHEN** `useLikeBookmark().toggleLike(postId)` is called
- **THEN** the post's like count SHALL be incremented if not previously liked
- **AND** decremented if already liked
- **AND** a toast notification SHALL show appropriate message

#### Scenario: Toggle bookmark on a post
- **WHEN** `useLikeBookmark().toggleBookmark(itemId)` is called
- **THEN** if not bookmarked, the folder selector SHALL open
- **AND** after folder selection, the bookmark SHALL be saved
- **AND** if already bookmarked, it SHALL be removed
- **AND** appropriate toast messages SHALL be shown

### Requirement: useEventActions hook for event management

The system SHALL provide a `useEventActions` hook that encapsulates event-related business logic (approve, reject, archive, submit).

#### Scenario: Approve a pending event
- **WHEN** `useEventActions().approveEvent(event)` is called
- **THEN** the event SHALL move from pending to approved in the event store
- **AND** a notification SHALL be created for the event submitter
- **AND** a toast SHALL confirm the action

#### Scenario: Reject a pending event with reason
- **WHEN** `useEventActions().rejectEvent(eventId, reason)` is called
- **THEN** the event SHALL move from pending to rejected with the reason stored
- **AND** a notification SHALL be created for the event submitter
- **AND** a toast SHALL confirm the action

#### Scenario: Archive an approved event
- **WHEN** `useEventActions().archiveEvent(event)` is called
- **THEN** the event SHALL move from approved to archived in the event store
- **AND** a toast SHALL confirm the action
