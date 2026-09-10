# Focus-AI Deep UI Specification

> **Version:** 1.0  
> **Last Updated:** 2025-12-11  
> **Status:** Implementation Guide

---

## Table of Contents
1. [Design Tokens](#design-tokens)
2. [Global Primitives](#global-primitives)
3. [Student Pages](#student-pages)
4. [Admin Pages](#admin-pages)
5. [API Payloads](#api-payloads)

---

## Design Tokens

### Colors
| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#0ea5a4` | Main CTA buttons, links |
| Primary-dark | `#085f5d` | Hover states |
| Accent | `#6366f1` | Highlights, badges |
| Success | `#10b981` | Correct answers, positive |
| Warning | `#f59e0b` | Caution, moderate confusion |
| Danger | `#ef4444` | Errors, high confusion |
| Surface-light | `#ffffff` | Light mode background |
| Surface-dark | `#0b1220` | Dark mode background |

### Typography
- **xl**: Headings (text-xl, text-2xl, text-3xl)
- **lg**: Subheadings (text-lg)
- **base**: Body text (text-base)
- **sm**: Secondary text (text-sm)
- **xs**: Labels, captions (text-xs)

### Spacing
Base unit: 4px (use Tailwind: p-1, p-2, p-4, p-6, p-8)

### Motion
- Micro-interactions: 120-240ms
- Easing: ease-out
- Use `transition-all duration-200`

---

## Global Primitives

### Toast
```tsx
// Props: {type: 'success'|'error'|'warning'|'info', message, duration, action?}
// Position: top-right, stackable
// Accessibility: role="status", aria-live="polite"
```

### Modal/Dialog
```tsx
// Props: {title, open, onClose, size: 'sm'|'md'|'lg'}
// Behavior: Trap focus, ESC closes, click outside closes
// Use: Headless UI Dialog
```

### ConfirmDialog
```tsx
// Props: {title, message, onConfirm, onCancel, confirmText, danger?}
// Special modal for destructive actions
```

### Tooltip
```tsx
// Props: {content, children}
// Behavior: Show on hover/focus, 200ms delay
// Accessibility: aria-describedby
```

### Badge
```tsx
// Variants: default, success, warning, danger, info
// Size: sm (default)
```

### Spinner & Skeleton
```tsx
// Spinner: Animated circle for loading states
// Skeleton: Placeholder blocks while fetching
```

---

## Student Pages

### 1. Login/Signup (`/login`, `/signup`)

**Purpose:** Firebase authentication entry

**Elements:**
- Hero card with branding
- Form: Email, Password (with reveal toggle)
- Validation: required, email regex, password ≥8 chars
- Buttons: Sign In, Sign Up, Continue as Demo, Google Sign In
- Link: Forgot Password → Modal

**API:**
- `POST /auth/verify_token` - Verify Firebase ID token

---

### 2. Dashboard (`/dashboard`)

**Purpose:** Personalized home with progress & recommendations

**Layout:** Two-column (desktop), single column (mobile)

**Left Column:**
- Course progress cards with:
  - Title
  - Progress ring (circular)
  - Subtopic count ("3/10 complete")
  - Resume button
  - Adaptive/Static badge

**Right Column:**
- Next recommended topic card
- Recent activity list
- Mastery sparkline chart
- Download progress dropdown

**Elements:**
- Header: Search bar, Notifications (bell + badge), Profile dropdown
- Filters: Course dropdown, View toggle (Grid/List)

---

### 3. Course Overview (`/course/dbms`)

**Purpose:** Navigate units and subtopics

**Elements:**
- Accordion for units (expandable)
- Each unit header: title, progress bar, Start button, menu
- Subtopic rows with:
  - Title
  - Difficulty badge (1-5)
  - Action buttons: View, Practice, Bookmark
- Bulk actions: checkbox per subtopic, Start selected

---

### 4. Lesson Viewer (`/lesson/[subtopicId]`)

**Purpose:** Primary learning screen with behavior tracking

**Layout:**
- Left: Lesson carousel (slides)
- Right (collapsible): Debug panel (admin), mini TOC

**Elements:**
- Prev/Next buttons
- Progress stepper
- Explanation type toggle (visual/step/example)
- Hint button
- Bookmark star
- SQL editor for SQL topics

**Behavior Tracking:**
- Session timer
- Tab blur/focus count
- Scroll depth
- Hesitation detection

---

### 5. Quiz (`/quiz/[subtopicId]`)

**Purpose:** Adaptive assessment

**Elements:**
- Question card (supports images, LaTeX)
- MCQ: Radio button options
- SQL: Code editor with Run/Submit
- Hint icon
- Show explanation (after submit)
- Timer (if timed)
- Difficulty badge

**Feedback:**
- Correct (green badge) / Incorrect (red badge)
- Modal for confusion > threshold with explanation

---

### 6. Review (`/review`)

**Purpose:** Analytics for student

**Elements:**
- Filters: Time range, Unit selector, Export button
- Charts: Mastery line, Confusion timeline, Radar chart
- Weak concepts table with Practice action
- Download options: PDF, CSV, JSON

---

### 7. Profile (`/profile`)

**Elements:**
- Avatar upload
- Learning style selector (radio)
- Accessibility: Font size slider, Contrast toggle
- Privacy toggle: Anonymize data
- Export my data button

---

## Admin Pages

### 1. Admin Dashboard (`/admin/dashboard`)

**Widgets:**
- KPI cards: Active users, Avg learning gain, Avg confusion, Retention
- Filters: Class, Date range, Unit
- Heatmap: Weak topics
- Live feed: Recent events

**Table:**
- Columns: Name, Progress, Confusion rate, Last active, Actions
- Bulk actions: Select students, Assign to experiment

---

### 2. Content Manager (`/admin/content`)

**Elements:**
- Tree view: Course → Units → Subtopics (drag-drop reorder)
- Content Editor modal:
  - Rich text editor
  - Tabs: Content, Explanations, Questions, References
  - Add Question form
  - Difficulty slider
  - Save/Publish buttons
- Version history with Revert

---

### 3. Experiment Panel (`/admin/experiment`)

**Elements:**
- Experiment form:
  - Name, Description
  - Participant selection
  - Assignment method: Random/Stratified
  - Duration picker
  - Mode toggles: Enable bandit, epsilon slider
- Launch button (confirm dialog)
- Experiment list table
- Export results button

---

### 4. ML Monitor (`/admin/ml-monitor`)

**Tabs:** Confusion | Profiler | Bandit | DKT

**Each tab:**
- Model summary card
- Performance graphs (ROC, PCA, reward, loss)
- SHAP feature importance table
- Retrain button
- Rollback action

---

## API Payloads

### Behavior Event
```json
{
  "user_id": "uid_abc",
  "session_id": "sess_001",
  "question_id": "dbms_u1_q3",
  "time_on_question_ms": 18500,
  "hesitation_ms": 1200,
  "tab_switches": 1,
  "scroll_depth_pct": 78,
  "attempts": 2,
  "hint_requests": 0,
  "timestamp": "2025-12-02T11:30:00Z"
}
```

### Submit Answer
```json
{
  "user_id": "uid_abc",
  "qid": "dbms_u1_q3",
  "answer": "B",
  "time_taken_ms": 28500,
  "attempts": 1,
  "is_hint_used": false
}
```

### Recommendation Response
```json
{
  "next_qid": "dbms_u1_q4",
  "explanation_type": "step_by_step",
  "reason": {
    "bandit_score": 0.72,
    "context": ["low_mastery_ER", "high_confusion"]
  }
}
```

---

## Implementation Checklist

- [ ] Global primitives: Toast, Modal, Tooltip, Badge, Spinner, Skeleton
- [ ] useBehavior hook with queue & retry
- [ ] Login flow + Firebase verification
- [ ] Course Overview with accordion
- [ ] Lesson Viewer with carousel + code editor
- [ ] Quiz page with adaptive explanations
- [ ] Review dashboard with charts
- [ ] Admin: Content manager
- [ ] Admin: Experiment panel
- [ ] Admin: ML monitor
- [ ] Accessibility checks (axe)
- [ ] Component tests

---

## Tech Stack

| Category | Library |
|----------|---------|
| UI Primitives | Headless UI / Radix / shadcn |
| Charting | Recharts or Chart.js |
| Code Editor | Monaco Editor |
| Toasts | react-hot-toast |
| Forms | react-hook-form + zod |
| State | React Query |
| Real-time | WebSocket / Pusher (optional) |
