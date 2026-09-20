## ADDED Requirements

### Requirement: Ban duration options
The system SHALL support banning users for fixed durations (1, 3, 7, 30 days) or custom days.

#### Scenario: Ban with fixed duration
- **WHEN** admin selects "7天" and confirms ban
- **THEN** the user is banned for exactly 7 days

#### Scenario: Ban with custom duration
- **WHEN** admin enters "15" days and confirms ban
- **THEN** the user is banned for exactly 15 days

### Requirement: Ban reason required
The system SHALL require a reason when banning a user.

#### Scenario: Ban without reason
- **WHEN** admin attempts to ban without entering a reason
- **THEN** the system displays validation error "请输入封禁原因"

### Requirement: Ban stores related post
The system SHALL store the related post ID when banning a user through the report flow.

#### Scenario: Ban from report
- **GIVEN** admin bans user while processing report for post "P-123"
- **THEN** the Ban record SHALL include relatedPostId: "P-123"

### Requirement: Ban email notification
The system SHALL automatically send an email to the banned user with ban details and contact information.

#### Scenario: User is banned
- **WHEN** admin bans a user for 7 days with reason "发布人身攻击内容"
- **THEN** the system sends email containing:
  - Ban reason
  - Ban duration
  - Related post title and excerpt (first 50 chars)
  - Contact QQ from configuration

### Requirement: Ban restrictions
The system SHALL prevent banned users from posting or commenting while allowing them to view content.

#### Scenario: Banned user attempts to post
- **GIVEN** user is currently banned
- **WHEN** user attempts to create a post
- **THEN** the system rejects with "你已被禁言，剩余 X 天"

#### Scenario: Banned user attempts to comment
- **GIVEN** user is currently banned
- **WHEN** user attempts to create a comment
- **THEN** the system rejects with "你已被禁言，剩余 X 天"

#### Scenario: Banned user views content
- **GIVEN** user is currently banned
- **WHEN** user browses posts and comments
- **THEN** the system allows normal viewing

### Requirement: Automatic unban on expiration
The system SHALL automatically unban users when the ban period expires.

#### Scenario: Ban expires naturally
- **GIVEN** user's ban expired 2 hours ago
- **WHEN** user attempts to post
- **THEN** the system allows the post creation
- **AND** sends unban notification email

### Requirement: Manual unban with reason
The system SHALL allow admin to manually unban a user before expiration, requiring a reason.

#### Scenario: Admin unbans early
- **WHEN** admin clicks "提前解禁" and enters reason "申诉通过"
- **THEN** the user is immediately unbanned
- **AND** an unban email is sent
- **AND** the Ban record is marked inactive

### Requirement: Ban history view
The system SHALL display ban history in the admin dashboard with details and related posts.

#### Scenario: Admin views ban history
- **WHEN** admin navigates to ban records page
- **THEN** the system displays list of all bans with:
  - User email
  - Ban reason
  - Duration
  - Related post (clickable, even if deleted)
  - Status (active/expired)
  - Actions (unban if active)
