## MODIFIED Requirements

### Requirement: User can manage chat sessions

The system SHALL allow users to create, switch, and delete chat sessions.

- The system SHALL display a list of user's chat sessions
- The system SHALL allow users to create a new session
- The system SHALL allow users to switch between sessions
- The system SHALL allow users to delete sessions
- The session list SHALL slide in from the left when opened
- Each session item SHALL display: title, last update time, and delete button
- Each session SHALL support an optional persona override configuration

#### Scenario: User views session list
- **GIVEN** the AIPanel is open
- **WHEN** the user clicks the session list button
- **THEN** a session list panel SHALL slide in from the left
- **THEN** the list SHALL display all user's sessions sorted by update time

#### Scenario: User creates new session
- **GIVEN** the session list is visible
- **WHEN** the user clicks "新建会话"
- **THEN** a new empty session SHALL be created
- **THEN** the new session SHALL become the current session
- **THEN** the session list SHALL close

#### Scenario: User switches session
- **GIVEN** the session list is visible with multiple sessions
- **WHEN** the user clicks on a session
- **THEN** the selected session SHALL become the current session
- **THEN** the session's messages SHALL be loaded and displayed
- **THEN** the session list SHALL close

#### Scenario: User deletes session
- **GIVEN** the session list is visible
- **WHEN** the user clicks the delete button on a session
- **THEN** a confirmation dialog SHALL appear
- **WHEN** the user confirms
- **THEN** the session SHALL be deleted
- **THEN** the system SHALL switch to another session or create a new one

#### Scenario: User edits persona for current session
- **GIVEN** the user is inside an AI session
- **WHEN** the user updates persona settings for the current session
- **THEN** the session SHALL persist the persona override configuration
- **THEN** reloading the same session later SHALL restore that session-specific persona configuration
