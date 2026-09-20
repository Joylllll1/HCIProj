## ADDED Requirements

### Requirement: User can view their account information

SettingsPage SHALL display the current user's account information with data fetched from the backend.

- The system SHALL display the campus email address (read-only, from `GET /api/auth/me`)
- The system SHALL display the registration date formatted as `YYYY年M月D日` (read-only)
- The system SHALL display a verification status badge showing the account has been verified

#### Scenario: Account info renders from API data
- **WHEN** the user navigates to `/settings`
- **THEN** the system SHALL fetch user data from `GET /api/auth/me`
- **THEN** the system SHALL display the user's email, registration date, and verified status

#### Scenario: API failure during account info load
- **WHEN** `GET /api/auth/me` fails
- **THEN** the system SHALL display a loading error state with a retry option
