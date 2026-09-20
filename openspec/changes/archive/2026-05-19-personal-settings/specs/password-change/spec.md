## ADDED Requirements

### Requirement: User can change password via email verification

The system SHALL allow authenticated users to change their password using email verification.

- The `/settings/password` page SHALL be a separate route
- The page SHALL display a "发送验证码" button that triggers `POST /api/verify/send` with `type: "change_password"`
- After sending, the button SHALL enter a 60-second cooldown
- The user SHALL enter a verification code, a new password, and a confirmation of the new password
- The new password SHALL meet the existing password rules (minimum 8 characters, must contain letters AND numbers)
- On submission, the system SHALL call `POST /api/auth/change-password` with `{ code, newPassword }`
- On success, redirect to `/settings` with a success message
- Errors SHALL display inline on the form (code expired/invalid, weak password)

#### Scenario: Successful password change
- **WHEN** the user enters a valid verification code, new password, and confirmation
- **AND** clicks "保存修改"
- **THEN** the system SHALL validate the verification code from `POST /api/verify/check`
- **THEN** the system SHALL call `POST /api/auth/change-password`
- **THEN** the system SHALL redirect to `/settings` with success toast "密码已更新"

#### Scenario: Verification code expired
- **WHEN** the user submits an expired verification code
- **THEN** the system SHALL display the error "验证码已过期，请重新获取"

#### Scenario: Weak password
- **WHEN** the user enters a new password that does not meet strength requirements
- **THEN** the system SHALL display the error "密码至少8位，需包含字母和数字"

#### Scenario: Passwords do not match
- **WHEN** the new password and confirmation do not match
- **THEN** the form SHALL display "两次密码不一致" before submission

#### Scenario: Verification code send cooldown
- **WHEN** the user clicks "发送验证码"
- **THEN** the button SHALL be disabled for 60 seconds
- **THEN** after 60 seconds, the button SHALL become clickable again
