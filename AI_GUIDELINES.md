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

### Cache Management & self-healing
- Provide a `forceClearCache` utility to deeply clear `localStorage`, `sessionStorage`, `caches`, `serviceWorkers`, and `IndexedDB`.
- Include a user-facing entry point (e.g., "Fix App") to resolve local state corruption or outdated asset issues.

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

### Cloud Function CORS
- Always set `cors: true` in Firebase `onCall` function options if the service needs to be accessed from external domains, landing pages, or cross-project links (e.g., `created.link`).

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
- **Auth Flow**: On Web, preferred Google Login flow is `signInWithRedirect`. This avoids `Cross-Origin-Opener-Policy` (COOP) issues that block popups on modern browsers. Avoid setting restrictive COOP headers in `firebase.json` as they can interfere with the redirect callback.
67: 
68: ## 6. In-App Purchases (RevenueCat)
69: 
70: ### Integration Standards
71: - **Plugin**: Use `@revenuecat/purchases-capacitor` and `@revenuecat/purchases-capacitor-ui`.
72: - **Initialization**: Always check `Capacitor.isNativePlatform()` before initializing.
73: 
74: ### Purchase Flow Implementation
75: - **Offerings vs Products**: 
76:   - Prefer checking `getOfferings()` first.
77:   - Fallback to `getProducts()` for direct store items if no offerings are configured.
78: - **API Deprecations**: Avoid using `offeringIdentifier` directly on the package object (deprecated). Instead, use `presentedOfferingContext.offeringIdentifier`.
79: - **Dynamic Purchasing**: 
80:   - Use `purchasePackage({ aPackage: pack })` for offering-based items.
81:   - Use `purchaseStoreProduct({ product: pack.product })` for items fetched directly via `getProducts`.
82: 
83: ### Security & Verification
84: - **Server-Side Granting**: Never grant items (e.g. coins) directly in the UI. Upon successful purchase, call a **Firebase Cloud Function** (e.g., `grantPurchaseCoins`) with the `customerInfo` data to verify the receipt and update the database.
85: 
86: ### UI/UX for Mobile
87: - **Proportion Locking**: IAP modals must use locked aspect ratios (e.g., `aspect-square`) for product icons to prevent vertical stretching or "squeezing" on high-density mobile displays.
88: - **Tabular Numbers**: Use `font-variant-numeric: tabular-nums` (Tailwind `tabular-nums`) for prices to ensure alignment across different currency string lengths.
89: 
