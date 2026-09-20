## ADDED Requirements

### Requirement: Admin login redirects to admin dashboard
Upon successful login, the system SHALL redirect admin users to the admin dashboard while regular users SHALL be redirected to the home page.

#### Scenario: Admin user login
- **WHEN** a user with `role: 'admin'` logs in successfully
- **THEN** the system redirects to `/admin` page

#### Scenario: Regular user login
- **WHEN** a user with `role: 'user'` logs in successfully
- **THEN** the system redirects to `/` (home page)

### Requirement: Admin dashboard access control
The system SHALL only allow users with `role: 'admin'` to access the admin dashboard.

#### Scenario: Admin accesses admin dashboard
- **WHEN** an admin user navigates to `/admin`
- **THEN** the system displays the admin dashboard

#### Scenario: Regular user attempts admin access
- **WHEN** a regular user navigates to `/admin`
- **THEN** the system redirects to `/` (home page)

#### Scenario: Unauthenticated user attempts admin access
- **WHEN** an unauthenticated user navigates to `/admin`
- **THEN** the system redirects to `/login`

### Requirement: Sidebar hides admin entry for regular users
The system SHALL NOT display the "管理后台" sidebar entry for regular users.

#### Scenario: Regular user views sidebar
- **WHEN** a regular user is logged in
- **THEN** the sidebar does NOT contain "管理后台" button

#### Scenario: Admin user views sidebar
- **WHEN** an admin user is logged in
- **THEN** the sidebar contains "管理后台" button (or admin is already in admin view)
