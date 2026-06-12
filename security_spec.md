# Security Specification & Test Cases (security_spec.md)

This document details our strict security invariants for Splitwise Clone and lists the 12 malicious payloads ("Dirty Dozen") designed to test our protection mechanisms.

---

## 1. Core Data Invariants
- **Group Membership Gate**: A user cannot read, create, update, or delete any resource (Expenses, Messages, Settlements) in `/groups/{groupId}` unless they are listed in `/groups/{groupId}.memberIds`.
- **Identity Theft Block**: A user cannot write a document where the owner/creator ID (`createdById`, `senderId`, `payerId`) is different from their actual authenticated UID (`request.auth.uid`).
- **Audit Field Immutability**: Fields such as `createdAt`, `createdById`, and the parent `groupId` must remain immutable once written.
- **Split Accuracy Enforcer**: For all expensive and settlement transactions, amounts must be non-negative, and splits must conform to structural requirements matching the splitType.

---

## 2. The "Dirty Dozen" Attack Payloads

### Test 1: Unauthorized Group Access (Impersonation)
- **Path**: `/groups/group_abc/expenses/exp_123`
- **User**: Authenticated, ID is `attacker_999`. Group members are `["user_111", "user_222"]`.
- **Action**: Read expense items.
- **Payload**: `N/A` (Direct Read)
- **Desired Result**: `PERMISSION_DENIED` (Not a group member).

### Test 2: Spoofing Payer/Creator ID
- **Path**: `/groups/group_abc/expenses/exp_123`
- **User**: Authenticated, ID is `attacker_999`.
- **Action**: Create expense.
- **Payload**: `{ "paidById": "victim_userId_111", "amount": 100, "createdById": "victim_userId_111", "description": "Steak Dinner" }`
- **Desired Result**: `PERMISSION_DENIED` (Identity mismatch).

### Test 3: System-State Bypassing (Illegal Field Injection)
- **Path**: `/groups/group_abc`
- **User**: Authenticated, ID is `user_111`.
- **Action**: Inject an unapproved/custom system configuration key.
- **Payload**: `{ "name": "Skiing Trip", "createdAt": "request.time", "secret_unlocked": true }`
- **Desired Result**: `PERMISSION_DENIED` (Keys list size mismatch).

### Test 4: Modifying Immutable Profile
- **Path**: `/users/user_111`
- **User**: Authenticated, ID is `user_111`.
- **Action**: Update the user document but change `createdAt`.
- **Payload**: `{ "createdAt": "timestamp_from_2020", "displayName": "New Name" }`
- **Desired Result**: `PERMISSION_DENIED` (Audit field changed).

### Test 5: Poisoning Document IDs
- **Path**: `/groups/LOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOONG_ID_128_CHARS/expenses/exp_abc`
- **User**: Authenticated, ID is `user_111`.
- **Action**: Create document with over-sized ID.
- **Desired Result**: `PERMISSION_DENIED` (Path size check failed).

### Test 6: Incomplete Schema Injection
- **Path**: `/groups/group_abc/expenses/exp_123`
- **User**: Authenticated, ID is `user_111`.
- **Action**: Write an incomplete Expense (skipping `splitType`).
- **Payload**: `{ "description": "Tacos", "amount": 20 }`
- **Desired Result**: `PERMISSION_DENIED` (Missing key attributes).

### Test 7: Email Spoofing without Verified Status
- **Path**: `/groups/group_abc`
- **User**: `request.auth.token.email = "Sunnytyagi2004@gmail.com"`, but `email_verified = false`.
- **Action**: Write operation that requires authenticated verified status.
- **Desired Result**: `PERMISSION_DENIED` (Email verification required).

### Test 8: Writing Negative Amount Expenses
- **Path**: `/groups/group_abc/expenses/exp_321`
- **User**: Authenticated, ID is `user_111`.
- **Action**: Create expense of negative money to force net-debt theft.
- **Payload**: `{ "amount": -100, ... }`
- **Desired Result**: `PERMISSION_DENIED` (Negative bounds check).

### Test 9: Zero-Sum / Invalid Share Splitting
- **Path**: `/groups/group_abc/expenses/exp_321`
- **User**: Authenticated, ID is `user_111`.
- **Action**: Set split ratios where individual percent is invalid or negative.
- **Desired Result**: `PERMISSION_DENIED` (Constraint check on properties).

### Test 10: Unauthorized Settlement Manipulation
- **Path**: `/groups/group_abc/settlements/set_111`
- **User**: Authenticated, ID is `user_999` (not payer or receiver).
- **Action**: Edit an existing settlement.
- **Desired Result**: `PERMISSION_DENIED` (Not a party involved in the settlement / settlement modified).

### Test 11: Message Injection for Others
- **Path**: `/groups/group_abc/expenses/exp_123/messages/msg_1`
- **User**: Authenticated, ID is `user_111`.
- **Action**: Create chat message but spoofing `senderName` of someone else.
- **Desired Result**: `PERMISSION_DENIED`.

### Test 12: Escape Member Bounds
- **Path**: `/groups/group_abc`
- **User**: Authenticated, ID is `user_111`.
- **Action**: Update group to add 10,000 members, crashing local layout performance.
- **Desired Result**: `PERMISSION_DENIED` (Max member size constraint).
