## ADDED Requirements

### Requirement: Zustand store for post state

The system SHALL manage post-related state (post list, filtered posts, selected post, liked posts) through a Zustand store (`postStore`).

#### Scenario: Initialize posts from localStorage
- **WHEN** `postStore` is first created
- **THEN** it SHALL load posts from localStorage key `nju_posts`
- **AND** if no saved data exists, SHALL initialize with the default seed posts

#### Scenario: Add a new post
- **WHEN** user publishes a new post via `postStore.addPost(post)`
- **THEN** the post SHALL be prepended to the post list with generated id, timestamp, ownerUserId, and zero counters
- **AND** the updated list SHALL be persisted to localStorage

#### Scenario: Toggle like on a post
- **WHEN** user clicks like button on a post via `postStore.toggleLike(postId)`
- **THEN** the post's like count SHALL increment if not already liked, or decrement if already liked
- **AND** the liked status SHALL be tracked in the store

#### Scenario: Filter posts by search query
- **WHEN** user types a search query in the search bar
- **THEN** the store SHALL provide a computed `filteredPosts` value that matches posts whose title, content, or tags contain the query (case-insensitive)

### Requirement: Zustand store for comment state

The system SHALL manage comment-related state (comments map per post) through a Zustand store (`commentStore`).

#### Scenario: Initialize comments from localStorage
- **WHEN** `commentStore` is first created
- **THEN** it SHALL load comments map from localStorage key `nju_comments`
- **AND** if no saved data exists, SHALL initialize with the default seed comments

#### Scenario: Add a comment to a post
- **WHEN** user submits a comment on a post via `commentStore.addComment(postId, content)`
- **THEN** the comment SHALL be appended to that post's comment list with generated id, userId, and timestamp
- **AND** the updated comments map SHALL be persisted to localStorage

### Requirement: Zustand store for bookmark state

The system SHALL manage bookmark-related state (bookmark list, collection folders, bookmark folders) through a Zustand store (`bookmarkStore`).

#### Scenario: Initialize bookmarks from localStorage
- **WHEN** `bookmarkStore` is first created
- **THEN** it SHALL load bookmarks, collection folders, and bookmark folders from their respective localStorage keys

#### Scenario: Toggle bookmark on a post
- **WHEN** user clicks bookmark button on a post
- **THEN** if not bookmarked, the folder selector SHALL open
- **AND** upon folder selection, the post id SHALL be added to the bookmark list and the selected folder
- **AND** if already bookmarked, the post id SHALL be removed from bookmarks and all folders

#### Scenario: Manage collection folders
- **WHEN** user creates, renames, or deletes a collection folder via `bookmarkStore.updateFolders(folders)`
- **THEN** the folders list SHALL be updated and persisted to localStorage

### Requirement: Zustand store for UI state

The system SHALL manage UI-related ephemeral state (toast messages, AI panel open/close, notifications, active page, search query) through a Zustand store (`uiStore`).

#### Scenario: Show a toast message
- **WHEN** any component calls `uiStore.showToast(message)`
- **THEN** a toast notification SHALL be displayed
- **AND** it SHALL auto-dismiss after a timeout

#### Scenario: Toggle AI panel
- **WHEN** user clicks the AI button
- **THEN** the AI panel open state SHALL toggle

#### Scenario: Mark all notifications as read
- **WHEN** user clicks "mark all as read" in the notification dropdown
- **THEN** all notifications SHALL have their `read` field set to `true`

### Requirement: Zustand store for event state

The system SHALL manage event-related state (pending, approved, rejected, archived events, carousel items) through a Zustand store (`eventStore`).

#### Scenario: Initialize events from localStorage
- **WHEN** `eventStore` is first created
- **THEN** it SHALL load all event categories and carousel items from their respective localStorage keys

#### Scenario: Approve a pending event
- **WHEN** admin approves a pending event via `eventStore.approveEvent(event)`
- **THEN** the event SHALL move from pending to approved list
- **AND** a notification SHALL be created for the event submitter

#### Scenario: Reject a pending event
- **WHEN** admin rejects a pending event with a reason via `eventStore.rejectEvent(eventId, reason)`
- **THEN** the event SHALL move from pending to rejected list with the rejection reason stored
- **AND** a notification SHALL be created for the event submitter

#### Scenario: Archive an approved event
- **WHEN** admin archives an approved event via `eventStore.archiveEvent(event)`
- **THEN** the event SHALL move from approved to archived list
