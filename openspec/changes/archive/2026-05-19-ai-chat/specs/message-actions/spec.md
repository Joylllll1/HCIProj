## ADDED Requirements

### Requirement: User can copy AI messages and regenerate responses

The system SHALL provide actions on AI messages for better user experience.

- The system SHALL provide a "复制" button to copy AI message content to clipboard
- The system SHALL provide a "重新生成" button to regenerate the last AI response
- The action buttons SHALL be hidden by default and appear on hover
- The copy action SHALL show a temporary success indicator

#### Scenario: User copies AI message
- **GIVEN** there is an AI message in the conversation
- **WHEN** the user hovers over the AI message
- **THEN** action buttons (复制, 重新生成) SHALL appear
- **WHEN** the user clicks "复制"
- **THEN** the message content SHALL be copied to clipboard
- **THEN** a brief success indicator SHALL be shown

#### Scenario: User regenerates AI response
- **GIVEN** the last message is from the AI
- **WHEN** the user clicks "重新生成"
- **THEN** the system SHALL call `POST /api/ai/sessions/:id/regenerate`
- **THEN** the old AI message SHALL be replaced with the new response
- **THEN** the conversation SHALL continue normally

#### Scenario: Regenerate with API error
- **GIVEN** the user clicks "重新生成"
- **WHEN** the API call fails
- **THEN** the system SHALL display an error message
- **THEN** the original message SHALL remain unchanged
