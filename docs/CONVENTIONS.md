# CONVENTIONS.md — Focus-AI

## File & Directory Naming

| What | Convention | Example |
|------|-----------|---------|
| Python modules | `snake_case.py` | `bandit_service.py` |
| Python classes | `PascalCase` | `BanditService` |
| TypeScript/React components | `PascalCase.tsx` | `CoursePlayer.tsx` |
| TypeScript utilities | `camelCase.ts` | `feedbackApi.ts` |
| Next.js pages | `page.tsx` inside named directory | `app/dashboard/page.tsx` |
| CSS files | `camelCase.css` or `globals.css` | `globals.css` |
| JSON seed data | `snake_case.json` | `dbms_questions.json` |
| Test files | `test_<module>.py` | `test_answers.py` |

## Python / Backend

### Imports
```python
# 1. Standard library
import os
import logging

# 2. Third-party
from fastapi import FastAPI, Depends
from pydantic import BaseModel

# 3. Local
from routers import auth, courses
from services.ml_service import ml_service
```

### Logging
Always use module-level loggers with structured JSON format:
```python
import logging
logger = logging.getLogger(__name__)

logger.info("Model loaded successfully")
logger.warning(f"LATENCY VIOLATION: {time_ms:.2f}ms")
logger.error(f"Bandit selection failed: {e}")
```

### Pydantic Schemas
Use Pydantic v2 with `ConfigDict`:
```python
from pydantic import BaseModel, ConfigDict

class Course(CourseBase):
    id: str
    units: List[Unit] = []
    model_config = ConfigDict(from_attributes=True)
```

### Router Registration
All routers go in `backend/routers/` and are registered in `main.py`:
```python
app.include_router(
    feature.router,
    prefix="/api/v1/feature",
    tags=["feature"],
    dependencies=[Depends(get_current_user)]  # if auth needed
)
```

### Service Pattern
Services are singletons instantiated at module level:
```python
class FeatureService:
    def __init__(self):
        self._init_state()
    
    def do_something(self, ...) -> dict:
        ...

# Singleton
feature_service = FeatureService()
```

### Error Handling
- Routers catch exceptions and return HTTP errors
- Services log errors and return fallback values
- ML inference failures fall back to heuristics — never crash the request

## TypeScript / Frontend

### Component Structure
```tsx
"use client";  // Required for components using hooks or browser APIs

import { useState } from 'react';
import { SomeComponent } from '@/components/neural/SomeComponent';
import { apiFetch } from '@/lib/api';

interface Props { ... }

export function MyComponent({ prop1, prop2 }: Props) {
    // hooks first
    // handlers next
    // render last
}
```

### Import Aliases
Always use the `@/` alias for absolute imports:
```tsx
// ✅ Correct
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

// ❌ Wrong
import { apiFetch } from '../../lib/api';
```

### API Calls
Always use `apiFetch()` from `lib/api.ts`:
```tsx
// ✅ Correct
const data = await apiFetch<CourseResponse>('/courses/dbms');

// ❌ Wrong — bypasses auth, retries, error handling
const res = await fetch('http://localhost:8000/api/v1/courses/dbms');
```

### Type Definitions
- Shared types go in `frontend/types/index.ts`
- Component-specific interfaces can live in the component file
- Always define response shapes — never use `any`

### Component Placement
| Type | Directory |
|------|-----------|
| Full pages | `app/<route>/page.tsx` |
| Reusable UI primitives | `components/ui/` |
| Themed custom components | `components/neural/` |
| Feature-specific components | `components/` (root) |
| Layout wrappers | `components/layout/` |
| API utilities & helpers | `lib/` |
| React hooks | `hooks/` |
| Context providers | `context/` |

## Error Handling Patterns

### Backend
```python
# In routers — raise HTTP exceptions
from fastapi import HTTPException
raise HTTPException(status_code=404, detail="Course not found")

# In services — log and return fallback
try:
    result = self.bandit.select_arm(context)
except Exception as e:
    logger.error(f"Bandit failed: {e}")
    return self._heuristic_recommendation(...)
```

### Frontend
```tsx
// Use ApiError class from lib/api.ts
try {
    const data = await apiFetch('/endpoint');
} catch (e) {
    if (e instanceof ApiError && e.status === 404) {
        // Handle specifically
    }
    // Toast notification for user-facing errors
}
```

## Banned / Preferred Libraries

### Banned
- `axios` — use `apiFetch()` wrapper instead
- `moment.js` — use native `Date` or `Intl.DateTimeFormat`
- `lodash` (full) — use native JS or import single functions if needed
- `styled-components` — project uses Tailwind CSS

### Preferred
- `lucide-react` for icons
- `framer-motion` for animations
- `radix-ui` primitives for accessible UI
- `class-variance-authority` + `clsx` + `tailwind-merge` for class composition
- `react-markdown` for rendering markdown content
