## ADDED Requirements

### Requirement: StorageService for localStorage abstraction

The system SHALL provide a `storageService` that encapsulates all localStorage read/write operations.

#### Scenario: Save data to localStorage
- **WHEN** `storageService.save(key, data)` is called
- **THEN** the data SHALL be JSON-serialized and stored in localStorage under the given key
- **AND** the function SHALL return a Promise (resolved) for API compatibility

#### Scenario: Load data from localStorage
- **WHEN** `storageService.load(key, fallback)` is called
- **THEN** the function SHALL parse and return the JSON data stored under the given key
- **AND** if the key does not exist or parsing fails, SHALL return the provided fallback value
- **AND** the function SHALL return the value wrapped in a Promise

#### Scenario: Remove data from localStorage
- **WHEN** `storageService.remove(key)` is called
- **THEN** the key-value pair SHALL be deleted from localStorage

### Requirement: PostService for post data operations

The system SHALL provide a `postService` that handles all post-related data operations.

#### Scenario: Get all posts
- **WHEN** `postService.getPosts()` is called
- **THEN** the function SHALL return all posts (from localStorage)

#### Scenario: Create a post
- **WHEN** `postService.createPost(post)` is called
- **THEN** the post SHALL be saved with generated id, userId, and timestamp
- **AND** the updated post list SHALL be persisted to localStorage
- **AND** the function SHALL return the created post

#### Scenario: Update a post's like count
- **WHEN** `postService.updateLikes(postId, increment)` is called
- **THEN** the post's like count SHALL be adjusted by the increment value
- **AND** the change SHALL be persisted to localStorage

### Requirement: CommentService for comment data operations

The system SHALL provide a `commentService` that handles all comment-related data operations.

#### Scenario: Get comments for a post
- **WHEN** `commentService.getComments(postId)` is called
- **THEN** the function SHALL return all comments for the given post

#### Scenario: Add a comment to a post
- **WHEN** `commentService.addComment(postId, comment)` is called
- **THEN** the comment SHALL be added to the post's comment list with generated id and timestamp
- **AND** the updated comments SHALL be persisted to localStorage

### Requirement: ReportService for report data operations

The system SHALL provide a `reportService` that handles report-related data operations.

#### Scenario: Create a report
- **WHEN** `reportService.createReport(postId, reason)` is called
- **THEN** a new report SHALL be created with generated id, type, and timestamp
- **AND** the report SHALL be persisted to localStorage

#### Scenario: Dismiss a report
- **WHEN** `reportService.dismissReport(reportId)` is called
- **THEN** the specified report SHALL be removed from the report list
- **AND** the change SHALL be persisted to localStorage
