## ADDED Requirements

### Requirement: User can manage AI persona settings

The system SHALL allow users to manage structured AI persona settings without exposing full system prompt editing.

- The system SHALL support the following persona fields:
  - `role`
  - `tone`
  - `directness`
  - `verbosity`
  - `customInstruction`
- The system SHALL support a user-level default persona configuration.
- The system SHALL support an optional session-level persona override configuration.
- The system SHALL validate enum fields against a fixed allowed set.
- The system SHALL limit the maximum length of free-text persona fields.
- All persona fields SHALL be optional in user-submitted configuration payloads.
- The system SHALL provide default persona values when a user has not configured one or more persona fields.
- Empty string values in optional free-text persona fields SHALL be treated as unset values unless explicitly needed as a persisted override.
- The persona settings UI SHALL be presented as a full-screen overlay view entered from the AIPanel.
- The persona settings UI SHALL allow the user to choose whether changes apply to the current session only or become the user's default persona.
- The persona settings UI MAY offer preset tone suggestions as quick-fill helpers, but the persisted persona schema SHALL store tone as free text rather than a preset enum field.

#### Scenario: User loads default persona settings
- **WHEN** the user opens the AI persona settings entry
- **THEN** the system SHALL load the user's current default persona configuration
- **THEN** the system SHALL show default values when the user has never configured a persona before

#### Scenario: User enters persona settings view
- **GIVEN** the AIPanel is open
- **WHEN** the user clicks the persona settings entry
- **THEN** the system SHALL open a full-screen overlay persona settings view inside the AI panel flow
- **THEN** the user SHALL be able to return to the chat view without leaving the AI panel

#### Scenario: User saves partial persona settings
- **WHEN** the user submits persona settings with only some fields filled
- **THEN** the system SHALL persist the provided fields without requiring all persona fields
- **THEN** any missing persona fields SHALL continue using fallback default values at runtime

#### Scenario: User updates default persona settings
- **WHEN** the user edits persona fields and chooses to save as default
- **THEN** the system SHALL persist the persona configuration as the user's default AI persona
- **THEN** subsequent new AI sessions SHALL use this default persona unless a session override exists

#### Scenario: User updates session-level persona settings
- **WHEN** the user edits persona fields and chooses to apply them only to the current session
- **THEN** the system SHALL persist the persona configuration on the current AI session
- **THEN** the updated configuration SHALL apply to subsequent AI replies in that session

#### Scenario: User leaves with unsaved persona changes
- **WHEN** the user attempts to leave the persona settings view with unsaved changes
- **THEN** the system SHALL prompt the user to confirm discarding or continuing editing

#### Scenario: User submits invalid persona data
- **WHEN** the user submits an unsupported enum value or overlong free-text persona field
- **THEN** the system SHALL reject the update request
- **THEN** the system SHALL return a validation error that the frontend can display
