## 1. Backend Models

- [x] 1.1 Create `Event` Mongoose model with all fields
- [x] 1.2 Update `AuditLog` model enum to add `approve_event`, `reject_event`, `archive_event`

## 2. Backend Services

- [x] 2.1 Create `createEvent` service function
- [x] 2.2 Create `getPendingEvents` service function
- [x] 2.3 Create `getApprovedEvents` service function
- [x] 2.4 Create `getRejectedEvents` service function
- [x] 2.5 Create `approveEvent` service function with audit log
- [x] 2.6 Create `rejectEvent` service function with audit log
- [x] 2.7 Create `archiveEvent` service function with audit log

## 3. Backend Controllers & Routes

- [x] 3.1 Create `eventController.js` with all CRUD operations
- [x] 3.2 Create `eventRoutes.js` with public and admin routes
- [x] 3.3 Register event routes in `index.js`

## 4. Frontend Services

- [x] 4.1 Add `createEvent` API function to `eventService.js`
- [x] 4.2 Add `getPendingEvents` API function
- [x] 4.3 Add `getApprovedEvents` API function
- [x] 4.4 Add `getRejectedEvents` API function
- [x] 4.5 Add `approveEvent` API function
- [x] 4.6 Add `rejectEvent` API function
- [x] 4.7 Add `archiveEvent` API function

## 5. Frontend Store

- [x] 5.1 Rewrite `eventStore.js` to use API calls instead of localStorage
- [x] 5.2 Add loading states and error handling

## 6. Admin UI

- [x] 6.1 Add "公告审核" button to `AdminSidebar.jsx` in the correct order
- [x] 6.2 Add events tab to `AdminDashboard.jsx`
- [x] 6.3 Create `EventDetailModal` component (copy from AdminPage.jsx)
- [x] 6.4 Create `RejectionModal` component with reason selection
- [x] 6.5 Implement pending events list view
- [x] 6.6 Implement approved events list view with archive button
- [x] 6.7 Implement rejected events list view
- [x] 6.8 Wire up approve/reject/archive actions

## 7. Integration & Testing

- [ ] 7.1 Test event submission from user side
- [ ] 7.2 Test event approval flow
- [ ] 7.3 Test event rejection with reason
- [ ] 7.4 Test event archiving
- [ ] 7.5 Verify audit logs are created
- [ ] 7.6 Check public event listing shows only approved events
