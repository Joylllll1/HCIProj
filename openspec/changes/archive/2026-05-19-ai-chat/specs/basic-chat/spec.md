## ADDED Requirements

### Requirement: User can send messages to AI and receive responses

The system SHALL allow users to have a conversation with an AI assistant through the AIPanel.

- The system SHALL provide a text input field for users to type messages
- The system SHALL send the user's message to the backend API `/api/ai/chat`
- The system SHALL display the AI's response when received
- The system SHALL support multi-turn conversations with context memory
- The system SHALL display a loading indicator while waiting for the AI response

#### Scenario: User sends a message and receives response
- **GIVEN** the AIPanel is open
- **WHEN** the user types a message and clicks send or presses Enter
- **THEN** the user's message SHALL appear in the chat history
- **THEN** the system SHALL send the message to the backend
- **THEN** the AI response SHALL appear in the chat history

#### Scenario: Multi-turn conversation with context
- **GIVEN** a conversation has started
- **WHEN** the user sends a follow-up message
- **THEN** the AI SHALL understand the context from previous messages
- **THEN** the AI SHALL provide a relevant response based on the conversation history

#### Scenario: API error during message sending
- **GIVEN** the AIPanel is open
- **WHEN** the user sends a message but the API fails
- **THEN** the system SHALL display an error message: "服务暂时不可用，请稍后再试"
- **THEN** the user's message SHALL still be displayed in the chat
