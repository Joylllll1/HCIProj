## ADDED Requirements

### Requirement: Report aggregation by post
The system SHALL aggregate multiple reports targeting the same post into a single report entry, displaying the report count.

#### Scenario: Same post reported multiple times
- **GIVEN** post "P-123" has been reported 3 times with different reasons
- **WHEN** admin views the report list
- **THEN** the system displays ONE entry for "P-123" with "举报次数: 3"

### Requirement: Report list sorting
The system SHALL sort reports by report count descending, then by time descending.

#### Scenario: Viewing sorted report list
- **GIVEN** reports with counts [5, 2, 5] and times [T1, T2, T3] where T3 > T1
- **WHEN** admin views the report list
- **THEN** the system displays order: [5/T3], [5/T1], [2/T2]

### Requirement: Report detail view
The system SHALL allow admin to view the reported post details including title, content, author anonymous name, and report reasons.

#### Scenario: Admin clicks report to view details
- **WHEN** admin clicks on a report entry
- **THEN** the system displays the post detail card with all report reasons listed

### Requirement: Dismiss report
The system SHALL allow admin to dismiss a report (mark as false positive), removing it from the pending list.

#### Scenario: Admin dismisses false positive report
- **WHEN** admin clicks "驳回举报" on a report
- **THEN** the system removes the report from pending list
- **AND** the post remains visible to users

### Requirement: Processed reports removed from list
The system SHALL remove processed reports (dismissed or acted upon) from the pending report list.

#### Scenario: Report is processed
- **GIVEN** admin processes a report (dismisses, deletes post, or bans user)
- **WHEN** the report list refreshes
- **THEN** the processed report is no longer visible
