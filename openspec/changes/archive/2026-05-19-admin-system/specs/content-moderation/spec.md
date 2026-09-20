## ADDED Requirements

### Requirement: Soft delete for posts
The system SHALL use soft delete (set `isDeleted: true`) when admin deletes a post, preserving the data.

#### Scenario: Admin deletes post
- **WHEN** admin clicks "删除内容" on a reported post
- **THEN** the system sets post.isDeleted = true
- **AND** the post is hidden from all user views

### Requirement: Deleted posts hidden from all user views
The system SHALL exclude deleted posts from home, search, bookmarks, likes, and user profiles.

#### Scenario: User views home page
- **GIVEN** post "P-123" is deleted
- **WHEN** any user views home page
- **THEN** "P-123" is not visible

#### Scenario: User views search results
- **GIVEN** post "P-123" is deleted
- **WHEN** user searches for keywords matching "P-123"
- **THEN** "P-123" is not in results

#### Scenario: User views their bookmarks
- **GIVEN** user bookmarked "P-123" and it was deleted
- **WHEN** user views bookmarks page
- **THEN** "P-123" is not visible (or shown as "[已删除]" if keeping placeholder)

### Requirement: Deleted posts visible in ban records
The system SHALL allow viewing deleted post content within the ban record context.

#### Scenario: Admin views ban with deleted post
- **GIVEN** user was banned for post "P-123" which was subsequently deleted
- **WHEN** admin views the ban record
- **THEN** the system displays the deleted post content with "[该帖子已被删除]" indicator
