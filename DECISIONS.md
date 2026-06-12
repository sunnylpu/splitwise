# Decision Log (DECISIONS.md)

This document outlines the significant technical and architectural decisions made during the development of the Splitwise Clone.

## 1. Database Selection: Firebase Firestore vs PostgreSQL
- **Options Considered**: Google Cloud SQL (PostgreSQL) vs. Firebase Firestore (NoSQL).
- **Decision**: Firebase Firestore.
- **Why**: Initial attempts to provision Cloud SQL failed due to Google Cloud billing account restrictions (`NO_VALID_PROJECT` error). We pivoted to Firebase Firestore. It provided the necessary real-time listener capabilities (`onSnapshot`) critical for the live expense chat feature, and allowed us to ship faster without managing database infrastructure.

## 2. Debt Simplification Algorithm Placement
- **Options Considered**: Run the greedy debt minimization algorithm ($O(N \log N)$) on the client side (React) vs. server-side (Cloud Functions).
- **Decision**: Client-side execution inside `utils.ts`.
- **Why**: Since group sizes are strictly limited to 50 members, the computational overhead is minimal. Running it client-side saves cloud function invocations (cost), reduces latency, and allows the UI to instantly recalculate balances when a new expense is drafted offline or in real-time.

## 3. Nested Security Rules vs. Flat Collections
- **Options Considered**: Storing all expenses in a root `/expenses` collection vs. nesting them under `/groups/{groupId}/expenses`.
- **Decision**: Nested under `/groups/{groupId}/expenses`.
- **Why**: In Firestore, security rules cannot easily filter queries across a massive flat collection without expensive document lookups. By nesting expenses under the group, we can use a single master gate rule: `request.auth.uid in get(/databases/$(database)/documents/groups/$(groupId)).data.memberIds`. This explicitly locks all financial data to authenticated group members only.

## 4. Float and Currency Math
- **Options Considered**: Using external libraries like `currency.js` vs. native JavaScript `Number` with manual rounding.
- **Decision**: Native JavaScript with strict 2-decimal rounding.
- **Why**: To keep the bundle size small, we built a custom pure function (`calculateSplits`) that handles pennies distribution. When an amount cannot be split equally (e.g., $10 / 3), the function assigns the remainder to the last participant ensuring the sum always perfectly matches the total.
