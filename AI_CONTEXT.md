# AI Context Document (AI_CONTEXT.md)

This document is the official, continuous source of truth for the replication, understanding, and architectural decisions of this Splitwise Clone. It provides everything an evaluator or automated recreate process needs to reproduce this application exactly.

---

## 1. Product Understanding & Scope

### Product Understanding
A highly polished, mobile-responsive clone of **Splitwise** for sharing bills and keeping track of group expenses, individual balances, settlements, and live expense-level chats.

### Product Scope
1. **User Authentication (Login Module)**: 
   - Google Sign-In powered by Firebase Authentication.
   - Full Email & Password login and registration options.
   - Dynamic Password Reset flow where users can trigger link dispatches via email.
   - Forced Email Verification for credential-based signups (featuring a 60-second resend cooldown to filter spam) to ensure ledger member legitimacy.
   - Auto-onboarding and Firestore user profile (initials avatar via Dicebear) registration on first login/registration.
2. **Groups Management**:
   - Create groups with dynamic titles, descriptions, and list-invite member email setups.
   - Settle balances / delete users from group rosters (strictly blocked if their balance !== 0).
3. **Expense Management & Split Types**:
   - **Equal Split**: Splits the total cost evenly among selected participants.
   - **Unequal Split**: Manually logs exact dollar shares per person.
   - **Percentage Split**: Divides based on arbitrary percentages summing to 100%.
   - **Shares Split**: Computes portion using ratio shares weights.
4. **Real-time Chat inside Expenses**: Expense-level context chat threads to discuss bill details in real-time.
5. **Group-wise Balances**: Computes direct standing balances inside group cockpits.
6. **Individual Balance Summary**: Shows overall global Net Owed, Net Owe, and status indicators on the index Dashboard.
7. **Settlement Engine (Record Payments)**: Simply registers cash payments between two select users to zero out debts.

---

## 2. Implementation Decisions & Engineering Requirements

### Engineering Requirements
- Highly responsive, fast, and real-time.
- Mobile-first UI using Tailwind CSS.
- Secure database rules preventing unauthorized access to ledgers.
- 100% correct float/currency math handling for expense splits.

### Implementation Decisions
- **Real-Time capabilities**: Active snapshot listeners (`onSnapshot`) on Firestore subcollections, ensuring instant text streams inside expense chats and immediate balance re-calculates when bills are logged.
- **Nested Database Design**: All transactions are scoped under a specific group to enforce strict security gatekeeping at the top level.
- **Backend & Relational Sync (The Pivot)**:
  - *Context*: Cloud SQL PostgreSQL was requested, but on-instance checks returned Google billing `NO_VALID_PROJECT` errors.
  - *Decision*: Pivoted to Firebase/Firestore as our primary persistence, backed by strict Security Master Gates.

---

## 3. Tech Stack
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide icons, `motion` (from `motion/react`) for fluid layout transitions.
- **Backend**: Firebase Authentication (Email/Password & Google OAuth), Firestore Database.
- **Hosting**: Vercel.

---

## 4. Database Schema
To maximize security and reduce O(N) database lookup calls inside security rules, we nested our transactions under `/groups/{groupId}`:

### `users/{uid}`
- `uid`: string, `email`: string, `displayName`: string, `photoURL`: string, `createdAt`: timestamp

### `groups/{groupId}`
- `name`: string, `description`: string, `createdById`: string, `memberIds`: array[string], `memberEmails`: array[string]

### `groups/{groupId}/expenses/{expenseId}`
- `groupId`: string, `description`: string, `amount`: number, `paidById`: string, `splitType`: string, `splits`: map, `calculatedAmounts`: map, `createdById`: string, `createdAt`: timestamp

### `groups/{groupId}/expenses/{expenseId}/messages/{messageId}`
- `senderId`: string, `senderName`: string, `senderPhoto`: string, `text`: string, `createdAt`: timestamp

### `groups/{groupId}/settlements/{settlementId}`
- `groupId`: string, `payerId`: string, `payeeId`: string, `amount`: number, `createdAt`: timestamp

---

## 5. API Design
Since we use Firebase Serverless BaaS, our API design is primarily defined by direct SDK access to our NoSQL schemas combined with Firestore Security Rules.
- Client reads/writes directly to collections using Firebase SDK.
- Security Rules (`firestore.rules`) act as the middleware/API boundary.

---

## 6. Frontend Structure
- **`/src/components/`**: Modular UI components (Dashboard, GroupDetail, ExpenseModal, ExpenseChat, etc.).
- **`/src/context/`**: Global `AppContext.tsx` for auth state and current user sessions.
- **`/src/types.ts`**: Strict TypeScript interfaces for all data models.
- **`/src/utils.ts`**: Pure functions for split calculations (`calculateSplits`) and debt simplification (`getSimplifiedDebts`).
- **`/src/firebase.ts`**: Firebase app initialization and centralized error handlers.

---

## 7. Deployment Plan
- **Frontend Deployment**: Deployed via Vercel connecting to the GitHub repository. Vercel automatically builds using `npm run build` (Vite) and hosts the static files.
- **Database**: Hosted on Google Firebase (Firestore natively).
- **Environment Variables**: Managed inside Vercel Dashboard (`GEMINI_API_KEY`).

---

## 8. Testing Plan
- **Manual End-to-End Testing**: Login flows, creating a group, adding equal/unequal/percentage expenses, checking the real-time chat, and logging a settlement.
- **Security Rule Testing**: Covered under `security_spec.md` with "Dirty Dozen" payload definitions to guarantee strict permissions.

---

## 9. Trade-offs
- **Firebase vs SQL**: Chose Firebase NoSQL for faster shipping and real-time hooks, sacrificing relational complex aggregations (SQL JOINs).
- **Client-side Split Math**: Debt minimization algorithm runs client-side instead of in a backend Cloud Function. This is faster but slightly less secure if a user modifies their local client (though backend rules prevent saving mismatched totals).

---

## 10. Prompts and AI Responses
- **Core Prompt**: "Build a Splitwise clone with Firebase, React, Vite. Include equal, unequal, percentage, and shares splits. Add expense chat."
- **AI Response**: Implemented the structure utilizing Firebase listeners and custom `calculateSplits` algorithm.
- **Vercel Prompt**: "What do I need to deploy this to Vercel?"
- **AI Response**: Created Firebase production config steps, Firestore Rules deployment, and Vercel GitHub import instructions.

---

## 11. Changes Made During Implementation
- **Vercel Deployment Fixes**: Replaced development AI Studio Firebase config with a dedicated Production Firebase project configuration inside `firebase-applet-config.json` to support public Vercel deployment.
- **Removed Empty Rule Blocks**: Repaired a deployment-blocking syntax error in `firestore.rules` caused by an empty `service cloudfastpath` definition.

---

## 12. Known Limitations
- **Currency Single Lock**: Fixed strictly to USD (`$`) to prevent multi-exchange conversion volatility inside simple mobile splits.
- **Group member limits**: Bounds max ledger profiles per group to 50 members to fit within native Firestore arrays limit constraints safely.
