# Manual Device Testing Checklist

## Overview

This checklist ensures Grade Math works correctly across different devices and scenarios.

---

## Device Testing Matrix

### Desktop Browsers

| Browser | Version | Status | Tester | Date |
|---------|---------|--------|--------|------|
| Chrome | Latest | [ ] | | |
| Firefox | Latest | [ ] | | |
| Safari | Latest | [ ] | | |
| Edge | Latest | [ ] | | |

### Mobile Devices

| Device | OS | Browser | Status | Tester | Date |
|--------|-----|---------|--------|--------|------|
| iPhone 12+ | iOS 16+ | Safari | [ ] | | |
| iPhone SE | iOS 16+ | Safari | [ ] | | |
| iPad | iPadOS 16+ | Safari | [ ] | | |
| Pixel 5+ | Android 12+ | Chrome | [ ] | | |
| Samsung Galaxy | Android 12+ | Chrome | [ ] | | |

### Tablet Devices

| Device | OS | Status | Tester | Date |
|--------|-----|--------|--------|------|
| iPad Pro 11" | iPadOS | [ ] | | |
| iPad Mini | iPadOS | [ ] | | |
| Android Tablet | Android | [ ] | | |

---

## Feature Testing Checklist

### Authentication

- [ ] Login page displays correctly
- [ ] Signup page displays correctly
- [ ] Form validation works
- [ ] Password visibility toggle works
- [ ] Forgot password flow works
- [ ] Error messages display correctly
- [ ] Redirects work after login

### Dashboard

- [ ] Dashboard loads after login
- [ ] Stats display correctly
- [ ] Recent projects show
- [ ] Token balance visible
- [ ] Offline banner appears when offline
- [ ] Navigation works on mobile

### Project Management

- [ ] Create new project works
- [ ] Project list displays
- [ ] Project detail page loads
- [ ] Edit project works
- [ ] Archive project works
- [ ] Search/filter works

### Submission Upload

- [ ] Camera capture works (mobile)
- [ ] File drag-and-drop works (desktop)
- [ ] Multi-file upload works
- [ ] PDF upload and split works
- [ ] HEIC conversion works (iOS)
- [ ] Upload progress shows
- [ ] Thumbnail previews display
- [ ] Error handling works

### Grading

- [ ] Start grading button works
- [ ] Progress indicator shows
- [ ] Results display correctly
- [ ] Score breakdown visible
- [ ] Confidence indicators work
- [ ] Feedback generation works

### Student Roster

- [ ] Add student works
- [ ] Edit student works
- [ ] Delete student works
- [ ] Student search works
- [ ] Auto-assignment preview works

### Token System

- [ ] Balance displays in header
- [ ] Low balance warning shows
- [ ] Cost preview works
- [ ] Bulk discount applied correctly

---

## PWA Testing

### Installation

- [ ] Install prompt appears (mobile)
- [ ] Install works on iOS (Add to Home Screen)
- [ ] Install works on Android
- [ ] App icon displays correctly
- [ ] Splash screen shows

### Offline Mode

- [ ] Offline banner appears
- [ ] Cached pages load offline
- [ ] Form data preserved
- [ ] Graceful error messages
- [ ] Reconnect detection works

### Performance

- [ ] First load < 3 seconds
- [ ] Page transitions < 500ms
- [ ] Images lazy load
- [ ] No layout shift

---

## Accessibility Testing

### Keyboard Navigation

- [ ] Tab order is logical
- [ ] Focus indicators visible
- [ ] Skip links work
- [ ] Modal focus trap works
- [ ] Escape closes modals

### Screen Reader

- [ ] Headings are logical
- [ ] Images have alt text
- [ ] Forms have labels
- [ ] Errors announced
- [ ] Loading states announced

### Visual

- [ ] Color contrast passes WCAG AA
- [ ] Text is readable at 200% zoom
- [ ] No horizontal scroll at 320px width
- [ ] Dark mode works (if enabled)

---

## Network Conditions

### Slow Connection (3G)

- [ ] Page loads eventually
- [ ] Loading indicators show
- [ ] Timeouts handled gracefully
- [ ] Retry logic works

### Offline

- [ ] Offline indicator shows
- [ ] Cached content displays
- [ ] Actions queue properly
- [ ] Sync on reconnect

---

## Error Scenarios

### Server Errors

- [ ] 500 errors show user-friendly message
- [ ] Retry button works
- [ ] Navigation still works

### Client Errors

- [ ] 404 page displays
- [ ] Invalid routes handled
- [ ] Form validation errors clear

### Network Errors

- [ ] Timeout errors handled
- [ ] Connection errors shown
- [ ] Automatic retry works

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| QA | | | |
| Product Owner | | | |
