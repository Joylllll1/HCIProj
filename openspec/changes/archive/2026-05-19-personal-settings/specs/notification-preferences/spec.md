## ADDED Requirements

### Requirement: User can manage notification preferences

The system SHALL allow users to enable or disable four notification types: reply notifications, like notifications, system announcements, and report result notifications.

- The system SHALL display toggle switches for each of the four notification types
- Each toggle SHALL default to enabled (`true`) for new users
- When a user toggles a switch, the system SHALL send the complete `notificationPreferences` object to `PUT /api/auth/profile`
- The system SHALL update the UI immediately (optimistic update) and revert on API error

#### Scenario: User toggles a notification preference on
- **WHEN** the user clicks a notification toggle to enable it
- **THEN** the UI SHALL immediately show the switch as enabled
- **THEN** the system SHALL call `PUT /api/auth/profile` with the updated preferences
- **THEN** on success, the change persists

#### Scenario: User toggles a notification preference off
- **WHEN** the user clicks a notification toggle to disable it
- **THEN** the UI SHALL immediately show the switch as disabled
- **THEN** the system SHALL call `PUT /api/auth/profile` with the updated preferences

#### Scenario: API error when updating preferences
- **WHEN** `PUT /api/auth/profile` fails after toggling
- **THEN** the UI SHALL revert the toggle to its previous state
- **THEN** the system SHALL display an error toast "更新失败，请重试"
