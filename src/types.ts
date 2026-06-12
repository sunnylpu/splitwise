export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  createdAt: any;
}

export type SplitType = "equal" | "unequal" | "percentage" | "shares";

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  paidById: string; // The user who paid the bill
  splitType: SplitType;
  splits: Record<string, number>; // Raw values (weights, amounts, percent) per UID
  calculatedAmounts: Record<string, number>; // The resolved actual debt values (USD) per UID
  createdById: string;
  createdAt: any;
}

export interface Settlement {
  id: string;
  groupId: string;
  payerId: string; // The person who is paying to settle their debt
  payeeId: string; // The person receiving the payment
  amount: number;
  createdAt: any;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  createdById: string;
  memberIds: string[];
  memberEmails: string[];
  createdAt: any;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderPhoto: string;
  text: string;
  createdAt: any;
}

// Struct to store calculated net obligations (reconciled balances)
export interface ObjectBalance {
  userId: string;
  netBalance: number; // Positive means they are owed money, negative means they owe money
}

export interface Debt {
  from: string; // owes money
  to: string; // gets money
  amount: number;
}
