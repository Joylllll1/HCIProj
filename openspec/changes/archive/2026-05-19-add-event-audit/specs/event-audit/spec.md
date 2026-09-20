## ADDED Requirements

### Requirement: User can submit event application
The system SHALL allow authenticated users to submit event applications with title, type, place, time, description, and optional poster image.

#### Scenario: Successful submission
- **WHEN** authenticated user submits event with all required fields (title, type, place, time)
- **THEN** system creates an event with status "pending"
- **AND** system returns the created event

#### Scenario: Missing required fields
- **WHEN** user submits event without title or place or time
- **THEN** system returns 400 error with message indicating missing fields

### Requirement: Admin can view pending events
The system SHALL allow admin users to view all pending event applications.

#### Scenario: List pending events
- **WHEN** admin requests pending events list
- **THEN** system returns all events with status "pending", sorted by newest first

#### Scenario: Non-admin access denied
- **WHEN** non-admin user requests pending events
- **THEN** system returns 403 forbidden error

### Requirement: Admin can approve event
The system SHALL allow admin users to approve pending events.

#### Scenario: Successful approval
- **WHEN** admin approves a pending event
- **THEN** system updates event status to "approved"
- **AND** system records admin ID and approval timestamp
- **AND** system creates audit log entry with action "approve_event"

#### Scenario: Approve non-existent event
- **WHEN** admin attempts to approve an event that does not exist
- **THEN** system returns 404 not found error

#### Scenario: Approve already approved event
- **WHEN** admin attempts to approve an already approved event
- **THEN** system returns 400 bad request error

### Requirement: Admin can reject event with reason
The system SHALL allow admin users to reject pending events and require a rejection reason.

#### Scenario: Successful rejection with preset reason
- **WHEN** admin rejects a pending event with a preset reason
- **THEN** system updates event status to "rejected"
- **AND** system stores the rejection reason
- **AND** system records admin ID and rejection timestamp
- **AND** system creates audit log entry with action "reject_event"

#### Scenario: Successful rejection with custom reason
- **WHEN** admin rejects a pending event with a custom reason
- **THEN** system updates event status to "rejected"
- **AND** system stores the custom rejection reason
- **AND** system records admin ID and rejection timestamp

#### Scenario: Reject without reason
- **WHEN** admin attempts to reject an event without providing a reason
- **THEN** system returns 400 bad request error with message "请填写拒绝原因"

### Requirement: Admin can view rejected events
The system SHALL allow admin users to view rejected events with their rejection reasons.

#### Scenario: List rejected events
- **WHEN** admin requests rejected events list
- **THEN** system returns all events with status "rejected", sorted by rejection time

### Requirement: Admin can archive approved events
The system SHALL allow admin users to archive approved events.

#### Scenario: Successful archive
- **WHEN** admin archives an approved event
- **THEN** system updates event status to "archived"
- **AND** system creates audit log entry with action "archive_event"

### Requirement: Public can view approved events
The system SHALL allow all users (including unauthenticated) to view approved events.

#### Scenario: List approved events
- **WHEN** any user requests approved events
- **THEN** system returns all events with status "approved", sorted by approval time

#### Scenario: Archived events excluded from public list
- **WHEN** user requests approved events
- **THEN** system excludes events with status "archived"
