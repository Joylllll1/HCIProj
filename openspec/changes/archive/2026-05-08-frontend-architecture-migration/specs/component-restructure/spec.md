## ADDED Requirements

### Requirement: Component directory reorganization

The system SHALL reorganize all components from the flat `components/` directory into a four-layer hierarchy: `pages/`, `features/`, `layout/`, `common/`.

#### Scenario: Page components moved to pages directory
- **WHEN** the component restructure is applied
- **THEN** the following components SHALL be moved to `components/pages/`:
  - HomePage.jsx, DetailPage.jsx, ComposePage.jsx, BookmarksPage.jsx,
  - AdminPage.jsx, AnnouncementsPage.jsx, TrendingPage.jsx, SettingsPage.jsx

#### Scenario: Feature components moved to features directory
- **WHEN** the component restructure is applied
- **THEN** the following components SHALL be moved to `components/features/`:
  - AIPanel.jsx, DailyFortune.jsx, DailyLuck.jsx, HeroCarousel.jsx, ReportModal.jsx

#### Scenario: Layout components moved to layout directory
- **WHEN** the component restructure is applied
- **THEN** the following components SHALL be moved to `components/layout/`:
  - Sidebar.jsx, TopBar.jsx, MobileNav.jsx

#### Scenario: Common components moved to common directory
- **WHEN** the component restructure is applied
- **THEN** the following components SHALL be moved to `components/common/`:
  - PostCard.jsx, Comment.jsx, Icon.jsx, Toast.jsx, EmptyState.jsx, StatCard.jsx, Progress.jsx

#### Scenario: All import paths updated after move
- **WHEN** components are moved to their new directories
- **THEN** all import paths in App.jsx and all components SHALL be updated to reflect the new locations
- **AND** `npm run dev` SHALL start without import errors

### Requirement: Empty components directory removal

The system SHALL clean up the old flat components directory after migration.

#### Scenario: Old components directory removed
- **WHEN** all components have been moved to their new locations
- **AND** all imports have been verified working
- **THEN** the old `components/` directory SHALL be deleted
