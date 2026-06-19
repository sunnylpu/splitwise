import { SplitType, Expense, Settlement, Debt } from "./types";

/**
 * Calculates raw currency split amounts for each group participant.
 * Keeps currency values rounded safely to 2 decimal places.
 */
export function calculateSplits(
  amount: number,
  splitType: SplitType,
  participants: string[], // List of user IDs participating in this split
  splits: Record<string, number> // Map from uid -> raw split value (shares, percent, of amount)
): Record<string, number> {
  const result: Record<string, number> = {};
  if (participants.length === 0) return result;

  // Zero-fill all members
  for (const p of participants) {
    result[p] = 0;
  }

  if (splitType === "equal") {
    const share = Number((amount / participants.length).toFixed(2));
    let cumulative = 0;

    // Distribute equally, adjusting for any rounding remainder on the last user
    participants.forEach((p, idx) => {
      if (idx === participants.length - 1) {
        result[p] = Number((amount - cumulative).toFixed(2));
      } else {
        result[p] = share;
        cumulative += share;
      }
    });
  } else if (splitType === "unequal") {
    // splits already has absolute numeric values. We just project them.
    participants.forEach((p) => {
      result[p] = Number((splits[p] || 0).toFixed(2));
    });
  } else if (splitType === "percentage") {
    let cumulative = 0;
    participants.forEach((p, idx) => {
      const pct = splits[p] || 0;
      if (idx === participants.length - 1) {
        result[p] = Number((amount - cumulative).toFixed(2));
      } else {
        const share = Number(((pct / 100) * amount).toFixed(2));
        result[p] = share;
        cumulative += share;
      }
    });
  } else if (splitType === "shares") {
    const totalShares = participants.reduce((acc, p) => acc + (splits[p] || 0), 0);
    if (totalShares === 0) {
      // Avoid division by zero
      const share = Number((amount / participants.length).toFixed(2));
      let cumulative = 0;
      participants.forEach((p, idx) => {
        if (idx === participants.length - 1) {
          result[p] = Number((amount - cumulative).toFixed(2));
        } else {
          result[p] = share;
          cumulative += share;
        }
      });
    } else {
      let cumulative = 0;
      participants.forEach((p, idx) => {
        const shareCount = splits[p] || 0;
        if (idx === participants.length - 1) {
          result[p] = Number((amount - cumulative).toFixed(2));
        } else {
          const share = Number(((shareCount / totalShares) * amount).toFixed(2));
          result[p] = share;
          cumulative += share;
        }
      });
    }
  }

  return result;
}

/**
 * Computes net balances of all group members and reduces complex transitive debts 
 * into minimal transactions (the classic Splitwise 'Simplify Debts' engine).
 */
export function getSimplifiedDebts(
  memberIds: string[],
  expenses: Expense[],
  settlements: Settlement[]
): { netBalances: Record<string, number>; simplifiedDebts: Debt[] } {
  const netBalances: Record<string, number> = {};

  // Initialize
  for (const uid of memberIds) {
    netBalances[uid] = 0;
  }

  // 1. Process Expenses
  for (const exp of expenses) {
    const paidBy = exp.paidById;
    const totalAmount = exp.amount;

    // The person who paid gets a POSITIVE credit of the bill
    if (memberIds.includes(paidBy)) {
      netBalances[paidBy] += totalAmount;
    }

    // Every participant gets a NEGATIVE debit of their portion
    for (const [uid, owedAmount] of Object.entries(exp.calculatedAmounts)) {
      if (memberIds.includes(uid)) {
        netBalances[uid] -= owedAmount;
      }
    }
  }

  // 2. Process Settlements
  for (const set of settlements) {
    const payer = set.payerId; // The debtor
    const payee = set.payeeId; // The creditor
    const amt = set.amount;

    // The source payer balances increases (reducing their negative debt)
    if (memberIds.includes(payer)) {
      netBalances[payer] += amt;
    }
    // The target receiver balance decreases (reducing their credit)
    if (memberIds.includes(payee)) {
      netBalances[payee] -= amt;
    }
  }

  // Round all net balances to remove JS float representation artifacts
  for (const uid of Object.keys(netBalances)) {
    netBalances[uid] = Number(netBalances[uid].toFixed(2));
  }

  // 3. Debt Minimization Algorithm
  // Copy and separate debtors and creditors
  const debtors: { uid: string; absAmt: number }[] = [];
  const creditors: { uid: string; absAmt: number }[] = [];

  for (const [uid, bal] of Object.entries(netBalances)) {
    if (bal < -0.01) {
      debtors.push({ uid, absAmt: Math.abs(bal) });
    } else if (bal > 0.01) {
      creditors.push({ uid, absAmt: bal });
    }
  }

  // Sort descending to match largest debts first (smart matching heuristic)
  debtors.sort((a, b) => b.absAmt - a.absAmt);
  creditors.sort((a, b) => b.absAmt - a.absAmt);

  const simplifiedDebts: Debt[] = [];

  let dIdx = 0;
  let cIdx = 0;

  // Loop while we still have debtors and creditors to balance
  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const minAmt = Number(Math.min(debtor.absAmt, creditor.absAmt).toFixed(2));
    if (minAmt > 0) {
      simplifiedDebts.push({
        from: debtor.uid,
        to: creditor.uid,
        amount: minAmt,
      });
    }

    debtor.absAmt = Number((debtor.absAmt - minAmt).toFixed(2));
    creditor.absAmt = Number((creditor.absAmt - minAmt).toFixed(2));

    if (debtor.absAmt < 0.01) {
      dIdx++;
    }
    if (creditor.absAmt < 0.01) {
      cIdx++;
    }
  }

  return {
    netBalances,
    simplifiedDebts,
  };
}
