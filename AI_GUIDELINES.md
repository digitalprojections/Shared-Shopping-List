# AI Agent Guidelines: Core Tech Stack & Security Patterns

This document defines the mandatory blueprint for replicating the architecture of this application in other React/Capacitor projects.

## 1. Core Technology Stack
- **Framework**: React 19+ (Functional components, Hooks).
- **Build Tool**: Vite (configured for PWA).
- **Styling**: Tailwind CSS (Utility-first, responsive design).
- **Language**: TypeScript (Strict mode enabled).
- **Native Wrapper**: Capacitor 7+ (Mandatory for Android/iOS builds).

## 2. Mandatory Architecture Patterns

### Centralized Configuration
All environment-specific variables must reside in `src/config.ts`.
- **AdMob**: Separate `REWARDED_ID_TEST` and `REWARDED_ID_REAL`.
- **Environment Checks**: Use `import.meta.env.DEV` to automatically toggle between test and production assets.

### Service-Layer Isolation
Business logic must be extracted into services (e.g., `userService.ts`, `adService.ts`) rather than living inside components.
- Components should only handle UI and call service methods.

### Offline-First Data Strategy
- Use **Firebase Firestore** for remote real-time synchronization.
- Use **Dexie.js** or a similar IndexedDB wrapper for local persistence.
- Enable Firestore offline persistence in `firebase.ts`.

## 3. Security & Integrity Rules (CRITICAL)

### Backend-Only Rewards
**Never** update user balances or sensitive counters directly from the frontend.
- **Rule**: All reward-bearing actions must call a **Firebase Cloud Function**.
- **Reason**: Frontend code can be tampered with. Backend functions must verify cooldowns and daily caps using `db.runTransaction`.

### Firestore Security Rules
Maintain a `firestore.rules` file and enforce the following:
- Verify `request.auth != null` for all private data.
- Ensure only owners can delete their own records.
- Use `get()` in rules to verify permissions across related collections (e.g., checking if a user is a member of a shared list).

### Rate Limiting
- Implement client-side throttling (cooldowns) for UI feedback.
- **Always** back this up with server-side time-checks in Cloud Functions.

## 4. Native Integration (Capacitor)

### Plugin Standards
Use the following community-standard plugins:
- `@capacitor-firebase/authentication`: For native Google Sign-In and session persistence.
- `@capacitor-community/admob`: For rewarded ads.
- `@capacitor-firebase/crashlytics`: Mandatory for production error monitoring.

### Platform Detection
Use `Capacitor.getPlatform()` and `Capacitor.isNativePlatform()` to handle environment differences (e.g., deep linking behavior should differ between Web/PWA and Android).

## 5. Deployment & CI/CD
- **Vite Config**: Ensure the `base` path is correctly set if deploying to a subdirectory.
- **Environment Variables**: Use `.env` files for project IDs and API keys; never hardcode these in source files.
