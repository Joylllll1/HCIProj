## ADDED Requirements

### Requirement: Chat conversations are persisted to database

The system SHALL persist all chat data to the database for long-term storage.

- The system SHALL store each chat session with a unique ID
- The system SHALL store all messages with their role (user/assistant) and content
- The system SHALL auto-generate session titles based on the first user message
- The system SHALL load conversation history when switching sessions
- The system SHALL only store messages for authenticated users

#### Scenario: Session title auto-generation
- **GIVEN** a new session is created
- **WHEN** the user sends the first message
- **THEN** the system SHALL generate a title based on the message content
- **THEN** the title SHALL be truncated to max 20 characters

#### Scenario: Messages persist after page refresh
- **GIVEN** a user has sent messages in a session
- **WHEN** the user refreshes the page
- **THEN** the session SHALL still exist
- **THEN** all messages SHALL be loaded from the database

#### Scenario: Context token limit handling
- **GIVEN** a conversation has many messages
- **WHEN** the message count exceeds 20
- **THEN** the system SHALL truncate early messages when sending to LLM
- **THEN** the system SHALL preserve the full history in database

#### Data Models

**AISession**
```javascript
{
  _id: ObjectId,
  user: ObjectId,      // Reference to User
  title: String,       // Auto-generated from first message
  createdAt: Date,
  updatedAt: Date
}
```

**AIMessage**
```javascript
{
  _id: ObjectId,
  session: ObjectId,   // Reference to AISession
  role: String,        // 'user' | 'assistant'
  content: String,     // Message content
  createdAt: Date
}
```
