## ADDED Requirements

### Requirement: AI system prompt is composed from fixed base rules and persona settings

The system SHALL compose the final AI system prompt from a fixed system base, product safety rules, the effective persona configuration, and optional user-provided persona supplements.

- The system SHALL keep the product safety boundary outside user-editable fields.
- The system SHALL translate structured persona enum fields into natural-language prompt instructions.
- The system SHALL ignore missing optional persona fields and use default prompt behavior instead.
- The system SHALL give session-level persona settings precedence over user-level default settings.
- The system SHALL resolve persona settings using field-level fallback in the order: session override, user default, system default.

#### Scenario: Chat request uses default persona settings
- **GIVEN** the user has a saved default AI persona configuration
- **WHEN** the user sends a message in a session without a session-level override
- **THEN** the system SHALL compose the AI system prompt using the default persona configuration
- **THEN** the AI reply SHALL reflect the configured role and tone preferences

#### Scenario: Chat request uses session override persona settings
- **GIVEN** the current AI session has a saved persona override
- **WHEN** the user sends a message in that session
- **THEN** the system SHALL compose the AI system prompt using the session override configuration
- **THEN** the session override SHALL take precedence over the user's default persona configuration

#### Scenario: Persona configuration is partially missing
- **GIVEN** the current session override defines only some persona fields
- **AND** the user default persona also defines only some persona fields
- **WHEN** the user sends a message
- **THEN** the system SHALL resolve each persona field independently using session override, then user default, then system default
- **THEN** the final system prompt SHALL still contain a complete effective persona configuration

#### Scenario: User persona text attempts to override system boundaries
- **WHEN** the user-provided persona supplement conflicts with fixed product safety rules
- **THEN** the system SHALL still include the fixed safety rules in the final system prompt
- **THEN** the user supplement SHALL NOT remove or replace those fixed safety rules
