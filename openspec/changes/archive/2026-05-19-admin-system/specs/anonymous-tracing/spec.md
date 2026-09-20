## ADDED Requirements

### Requirement: Anonymous tracing requires reason
The system SHALL require admin to provide a reason before revealing the real identity of an anonymous post author.

#### Scenario: Admin traces without reason
- **WHEN** admin attempts to trace without entering a reason
- **THEN** the system displays validation error "请输入追溯原因"

#### Scenario: Admin traces with reason
- **WHEN** admin enters a reason and confirms trace
- **THEN** the system reveals the author's real email

### Requirement: Tracing result display
The system SHALL display the traced user's email and activity statistics (post count, comment count, report count).

#### Scenario: Successful trace
- **WHEN** admin successfully traces a post author
- **THEN** the system displays:
  - User email (e.g., "student@smail.nju.edu.cn")
  - Post count
  - Comment count
  - Times reported
  - Current ban status

### Requirement: Tracing audit log
The system SHALL record an audit log entry for every tracing operation.

#### Scenario: Admin traces identity
- **WHEN** admin successfully traces a user
- **THEN** the system creates an AuditLog entry with:
  - action: 'trace'
  - targetUserId
  - targetPostId
  - reason (admin provided)
  - timestamp
