# AI Context Document (AI_CONTEXT.md)

This document is the official, continuous source of truth for the replication, understanding, and architectural decisions of this Splitwise Clone. It provides everything an evaluator or automated recreate process needs to reproduce this application exactly.

---

## 1. Product Understanding & Scope

### Core Concept
A highly polished, mobile-responsive clone of **Splitwise** for sharing bills and keeping track of group expenses, individual balances, settlements, and live expense-level chats.

### Product Scope & Features
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
   - **Equal Split**: Splits the total cost evenly among selected participants (adjusting the last member for pennies rounding).
   - **Unequal Split**: Manually logs exact dollar shares per person. Sum must match total amount.
   - **Percentage Split**: Divides based on arbitrary percentages summing to exactly 100%.
   - **Shares Split**: Computes portion using ratio shares weights (e.g. 2 shares vs 1 share).
4. **Real-time Chat inside Expenses**: Expense-level context chat threads to discuss bill details in real-time.
5. **Group-wise Balances**: Computes direct standing balances inside group cockpits.
6. **Individual Balance Summary**: Shows overall global Net Owed, Net Owe, and status indicators on the index Dashboard.
7. **Settlement Engine (Record Payments)**: Simply registers cash payments between two select users to zero out debts.

---

## 2. Technical Stack & Implementation Decisions

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide icons, `motion` (from `motion/react`) for fluid layout transitions.
- **Client State**: Centralized App State React Context (`AppContext.tsx`) synced with real-time Firebase listeners.
- **Backend & Relational Sync (The Pivot)**:
  - *Context*: Cloud SQL PostgreSQL was requested, but on-instance checks returned Google billing `NO_VALID_PROJECT` errors.
  - *Decision*: Following the mandatory instruction in `cloudsql-setup` ("Case 1: Silently pivot to Firebase/Firestore"), we have integrated client-side Firestore Document Store as our primary persistence, backed by strict Security Master Gates.
- **Real-Time capabilities**: Active snapshot listeners (`onSnapshot`) on Firestore subcollections, ensuring instant text streams inside expense chats and immediate balance re-calculates when bills are logged.

---

## 3. Database Schema & Nested Master Gates

To maximize security and reduce O(N) database lookup calls inside security rules, we nested our transactions under `/groups/{groupId}`:

### `users/{uid}`
- `uid`: string (Key Auth UID)
- `email`: string
- `displayName`: string
- `photoURL`: string
- `createdAt`: serverTimestamp()

### `groups/{groupId}`
- `name`: string
- `description`: string
- `createdById`: string (author UID)
- `memberIds`: array of strings (UIDs)
- `memberEmails`: array of strings

### `groups/{groupId}/expenses/{expenseId}`
- `groupId`: string
- `description`: string
- `amount`: number
- `paidById`: string (who paid the check)
- `splitType`: 'equal' | 'unequal' | 'percentage' | 'shares'
- `splits`: map of string/number values
- `calculatedAmounts`: resolved values in currency (USD)
- `createdById`: string
- `createdAt`: serverTimestamp()

### `groups/{groupId}/expenses/{expenseId}/messages/{messageId}`
- `senderId`: string
- `senderName`: string
- `senderPhoto`: string
- `text`: string
- `createdAt`: serverTimestamp()

### `groups/{groupId}/settlements/{settlementId}`
- `groupId`: string
- `payerId`: string (debtor)
- `payeeId`: string (creditor)
- `amount`: number
- `createdAt`: serverTimestamp()

---

## 4. Key Algorithms

### 1. Unified Split Resolver (utils.ts)
```typescript
export function calculateSplits(amount: number, splitType: SplitType, participants: string[], splits: Record<string, number>)
```
Acts as a central pure function that takes money totals and returns exactly computed individual debt lists (handles cents roundings by adjusting the last participant cleanly).

### 2. Greedy Debt Minimization (Simplify Debts)
```typescript
export function getSimplifiedDebts(memberIds: string[], expenses: Expense[], settlements: Settlement[])
```
Processes all bills: Adds positive total credit to payers, subtracts negative debt portions from select participants, applies recorded settle payments, rounds results to 2 decimals, split remaining debtors and creditors into active groups, and matches the biggest debtor to the biggest creditor recursively in $O(N \log N)$ complexity.

---

## 5. Security Rules Hardening (firestore.rules)
- **Nested gate check**: Anyone accessing `/groups/{groupId}/expenses` or `/groups/{groupId}/settlements` is verified using dynamic `get()` primitives looking up whether `request.auth.uid in get(/groups/{groupId}).data.memberIds`.
- **Identity Spoof guards**: Strict checks on input profiles ensuring `incoming().uid == request.auth.uid` and preventing users from altering immutable fields like `createdAt`.

---

## 6. Email Password Auth & Verification Flow
We expanded Splitwise Pro with robust credentials authentication and verification mechanics:
- **Universal Provider Mapping**: Users can log in seamlessly with Google single-sign-on or standard email credentials.
- **Verification Gatekeeper**: Standard credential registrations are temporarily quarantined on login until they verify their email. A dedicated `EmailVerificationScreen` handles the session reloads and status verification checks.
- **Client Cooldown**: Resend requests are programmatically rate-limited to a 60-second cooldown timer on the button element to curb spam.
- **Secure Password Resets**: An interactive modal-like form triggers the Firebase password reset mail dispatches to users on demand.

---

## 7. Known Trade-offs & Limitations
- **Currency Single Lock**: Fixed strictly to USD (`$`) to prevent multi-exchange conversion volatility inside simple mobile splits.
- **Group member limits**: Bounds max ledger profiles per group to 50 members to fit within native Firestore arrays limit constraints safely.
