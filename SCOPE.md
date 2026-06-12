# Scope & Anomaly Log (SCOPE.md)

## 1. Database Schema
Our application utilizes a nested NoSQL structure on Firebase Firestore to enforce security and optimize reads:

- **`users/{uid}`**: 
  - `uid` (string), `email` (string), `displayName` (string), `photoURL` (string), `createdAt` (timestamp)
- **`groups/{groupId}`**: 
  - `name` (string), `description` (string), `createdById` (string), `memberIds` (array of strings), `memberEmails` (array of strings)
- **`groups/{groupId}/expenses/{expenseId}`**: 
  - `groupId`, `description`, `amount`, `paidById`, `splitType`, `splits` (map), `calculatedAmounts` (map), `createdById`, `createdAt`
- **`groups/{groupId}/settlements/{settlementId}`**: 
  - `groupId`, `payerId`, `payeeId`, `amount`, `createdAt`

## 2. CSV Anomaly Log
During the initial bulk ingestion of seed data via CSV, several data anomalies were encountered. Here is how they were handled:

1. **Missing Email Addresses**:
   - *Problem*: Some rows had empty email fields for users.
   - *Handling*: The system generated a placeholder email (`user_{id}@placeholder.com`) and flagged the user profile as needing an update on first login.
2. **Negative Expense Amounts**:
   - *Problem*: Certain expenses were recorded with negative values (e.g., refunds entered incorrectly).
   - *Handling*: The parser applied `Math.abs()` to convert amounts to positive and logged a warning in the import report.
3. **Mismatched Split Totals**:
   - *Problem*: Unequal splits in the CSV did not mathematically sum up to the exact total expense amount.
   - *Handling*: The ingestion script rejected the specific expense row entirely, skipping it to prevent ledger corruption, and logged an error in the import report.
4. **Duplicate Group Names**:
   - *Problem*: Multiple rows attempted to create a group with the exact same name.
   - *Handling*: The system appended an incrementing numeric suffix (e.g., `Trip (1)`) to ensure unique logical separation.
