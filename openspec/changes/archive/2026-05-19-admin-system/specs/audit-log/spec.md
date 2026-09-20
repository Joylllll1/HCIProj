## ADDED Requirements

### Requirement: Audit log for tracing
The system SHALL create an audit log entry for every anonymous tracing operation.

#### Scenario: Admin traces user
- **WHEN** admin traces anonymous post author
- **THEN** the system creates AuditLog with:
  - action: 'trace'
  - targetUserId: user's ObjectId
  - targetPostId: post's ObjectId
  - reason: admin-provided reason
  - createdAt: timestamp

### Requirement: Audit log for banning
The system SHALL create an audit log entry for every ban operation.

#### Scenario: Admin bans user
- **WHEN** admin bans a user
- **THEN** the system creates AuditLog with:
  - action: 'ban'
  - targetUserId: user's ObjectId
  - targetPostId: related post's ObjectId (if applicable)
  - reason: ban reason
  - days: ban duration
  - createdAt: timestamp

### Requirement: Audit log for unbanning
The system SHALL create an audit log entry for every unban operation (manual or automatic).

#### Scenario: Admin manually unbans
- **WHEN** admin manually unbans a user
- **THEN** the system creates AuditLog with:
  - action: 'unban'
  - targetUserId: user's ObjectId
  - reason: unban reason
  - isManual: true
  - createdAt: timestamp

#### Scenario: System auto-unbans
- **WHEN** system automatically unbans expired ban
- **THEN** the system creates AuditLog with:
  - action: 'unban'
  - targetUserId: user's ObjectId
  - isManual: false
  - createdAt: timestamp

### Requirement: Audit log for post deletion
The system SHALL create an audit log entry for every admin post deletion.

#### Scenario: Admin deletes post
- **WHEN** admin deletes a post
- **THEN** the system creates AuditLog with:
  - action: 'delete_post'
  - targetPostId: post's ObjectId
  - targetUserId: post author's ObjectId
  - reason: deletion reason (if provided via report flow)
  - createdAt: timestamp
