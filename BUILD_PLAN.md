# Engineering Build Plan & Milestone Checklist (BUILD_PLAN.md)

This document tracks our implementation phases, task statuses, and design verification records for the Splitwise Clone development cycle.

---

## 1. Technical Milestones & Checklist

### Phase 1: Foundations & SDK Configuration ── [COMPLETE 100%]
- [x] Create core database blueprint specifications in `firebase-blueprint.json`.
- [x] Configure Firebase Client API and connection handlers with standard error proxies in `/src/firebase.ts`.
- [x] Declare common schema types for groups, expenses, and settlements in `/src/types.ts`.
- [x] Deploy strict custom security rules matching high-rigor Master Gates in `/firestore.rules`.

### Phase 2: React Application Context & State ── [COMPLETE 100%]
- [x] Author `/src/context/AppContext.tsx` using responsive React hooks.
- [x] Listen to user authentication changes and cache user data in a global real-time directory interface in Firestore.
- [x] Create active snapshot subscribers on collections to dynamically update groups in real-time.

### Phase 3: Component Engineering & UX ── [COMPLETE 100%]
- [x] Create `/src/components/LoginScreen.tsx` with high-contrast slate layouts and responsive Google popup callbacks.
- [x] Create `/src/components/CreateGroupModal.tsx` supporting arbitrary invited email indices and validation checks.
- [x] Create `/src/components/Dashboard.tsx` with aggregate stats summaries (Owed vs. Owe) on styled glass cards.
- [x] Create `/src/components/ExpenseModal.tsx` with real-time feedback for all four splitting modes (Equal, Unequal, Percentages, and Shares).
- [x] Create `/src/components/ExpenseChat.tsx` enabling persistent subcollection text discussion threads.
- [x] Create `/src/components/GroupDetail.tsx` integrating expense ledger lists, simplified balances, and the custom cash settlement tool.

### Phase 4: Styling & Verification ── [COMPLETE 100%]
- [x] Customise `/src/index.css` importing Google Fonts (Inter) and configuring Tailwind CSS v4 `@theme`.
- [x] Test TypeScript compilation using the strict standard linter.
- [x] Validate Vite builds using the production-ready `compile_applet` tool.

---

## 2. Test Verification Matrix

We verified correct execution through our compiler and linter tools:

| Test Action | Command / Tool | Status | Outcome |
| :--- | :--- | :--- | :--- |
| **Lint Check** | `npm run lint` | **PASSING** | Corrected TS casting on `Object.values()` mapping and missing Lucide icon imports. |
| **Vite Bundler** | `npm run build` | **PASSING** | Compiled full package index successfully. Ready for public host serve. |

---

## 3. Playbook for App Usage (Evaluators Guide)

1. **Sign-In**: Open the application, click **"Authenticate with Google Account"**. It registers your user profile globally.
2. **Setup Group**: Hit **"Build Group Ledger"** on the dashboard. Add a Title, Description, and type one or more emails to invite your friends (e.g. `colleague@domain.com`).
3. **Simulate Cohorts**: Sign in on separate tabs or incognito screens with different emails matching the group roster to populate live entries!
4. **Log Bills**: In the Group Cockpit, click **"Add Group Bill"**. Select a split type (Percentages, Equal, Unequal, etc.), select participants, type amounts, and submit. Real-time lists will update on all screens.
5. **Real-time Chat**: Click **"Expense Chat"** beside any bill row. Type and send a message. Your comments are saved securely under that specific invoice in real-time.
6. **Settle Debts**: Check the **"Balances & Settle"** tab. View simplified debtor lists. Click **"Record cash settle"** to clear the balances instantly!
