import React, { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { Group, Expense, Settlement, Debt, UserProfile } from "../types";
import { getSimplifiedDebts } from "../utils";
import { 
  collection, 
  onSnapshot, 
  updateDoc, 
  doc, 
  addDoc, 
  deleteDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { ExpenseModal } from "./ExpenseModal";
import { ExpenseChat } from "./ExpenseChat";
import { motion, AnimatePresence } from "motion/react";
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Sparkles, 
  TrendingUp, 
  UserPlus, 
  Coins, 
  Users, 
  MessageSquare, 
  FileText, 
  Wallet,
  Check,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  X,
  Receipt
} from "lucide-react";

interface GroupDetailProps {
  groupId: string;
  onBack: () => void;
}

type TabType = "expenses" | "debts" | "members" | "activity";

export const GroupDetail: React.FC<GroupDetailProps> = ({ groupId, onBack }) => {
  const { userProfile, users, groups } = useApp();
  
  // Find group metadata
  const group = groups.find((g) => g.id === groupId);

  // States
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("expenses");

  // Invite states
  const [newEmail, setNewEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  // Expense modal states
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  
  // Expandable expense details map (expenseId -> boolean)
  const [expandedExpenses, setExpandedExpenses] = useState<Record<string, boolean>>({});

  // Active chat expense state
  const [activeChatExpense, setActiveChatExpense] = useState<Expense | null>(null);

  // Settle Up state
  const [isSettleOpen, setIsSettleOpen] = useState(false);
  const [settlePayer, setSettlePayer] = useState("");
  const [settlePayee, setSettlePayee] = useState("");
  const [settleAmount, setSettleAmount] = useState("");
  const [settleError, setSettleError] = useState<string | null>(null);
  const [settleSubmitting, setSettleSubmitting] = useState(false);

  const exportToCSV = () => {
    if (!group) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Type,Date,Description,Amount,Paid By,Paid To\n";

    // Add Expenses
    expenses.forEach((exp) => {
      const date = exp.createdAt ? new Date(exp.createdAt.seconds * 1000).toLocaleDateString() : "Pending";
      const payerName = users[exp.paidById]?.displayName || "Unknown";
      // Escape commas in description
      const desc = exp.description.replace(/,/g, " ");
      csvContent += `Expense,${date},${desc},${exp.amount},${payerName},Group\n`;
    });

    // Add Settlements
    settlements.forEach((set) => {
      const date = set.createdAt ? new Date(set.createdAt.seconds * 1000).toLocaleDateString() : "Pending";
      const payerName = users[set.payerId]?.displayName || "Unknown";
      const payeeName = users[set.payeeId]?.displayName || "Unknown";
      csvContent += `Settlement,${date},Settlement Payment,${set.amount},${payerName},${payeeName}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `group_${group.name.replace(/\s+/g, '_')}_ledger.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Snapshot readers
  useEffect(() => {
    if (!groupId) return;
    setLoading(true);

    // 1. Subscribe to Expenses
    const expUnsub = onSnapshot(
      collection(db, "groups", groupId, "expenses"),
      (snapshot) => {
        const exps: Expense[] = [];
        snapshot.forEach((doc) => {
          exps.push({ id: doc.id, ...doc.data() } as Expense);
        });
        
        // Sort expenses by createdAt descending
        exps.sort((a, b) => {
          const t1 = a.createdAt?.seconds || 0;
          const t2 = b.createdAt?.seconds || 0;
          return t2 - t1;
        });

        setExpenses(exps);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `groups/${groupId}/expenses`);
      }
    );

    // 2. Subscribe to Settlements
    const setUnsub = onSnapshot(
      collection(db, "groups", groupId, "settlements"),
      (snapshot) => {
        const sets: Settlement[] = [];
        snapshot.forEach((doc) => {
          sets.push({ id: doc.id, ...doc.data() } as Settlement);
        });

        // Sort settlements by createdAt descending
        sets.sort((a, b) => {
          const t1 = a.createdAt?.seconds || 0;
          const t2 = b.createdAt?.seconds || 0;
          return t2 - t1;
        });

        setSettlements(sets);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `groups/${groupId}/settlements`);
      }
    );

    return () => {
      expUnsub();
      setUnsub();
    };
  }, [groupId]);

  if (!group) {
    return (
      <div id="group-not-found" className="flex flex-col items-center justify-center p-12 min-h-screen">
        <AlertCircle className="h-10 w-10 text-rose-500 mb-2" />
        <h3 className="text-base font-bold text-slate-700">Group not found</h3>
        <button onClick={onBack} className="mt-4 text-xs font-semibold text-emerald-600 underline">
          Return to home
        </button>
      </div>
    );
  }

  // Calculate Standing balances
  const { netBalances, simplifiedDebts } = getSimplifiedDebts(group.memberIds, expenses, settlements);
  const myUid = userProfile?.uid || "";
  const myBalance = netBalances[myUid] || 0;

  // Settle handler
  const handleOpenSettle = (fromId?: string, toId?: string, amount?: number) => {
    setSettleError(null);
    setSettlePayer(fromId || myUid);
    setSettlePayee(toId || group.memberIds.find((id) => id !== (fromId || myUid)) || "");
    setSettleAmount(amount ? amount.toFixed(2) : "");
    setIsSettleOpen(true);
  };

  const handleRecordSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettleError(null);

    const amt = parseFloat(settleAmount) || 0;
    if (amt <= 0) {
      setSettleError("Settle payment amount must be a positive number.");
      return;
    }

    if (!settlePayer || !settlePayee || settlePayer === settlePayee) {
      setSettleError("Please designate two distinct group members to settle up.");
      return;
    }

    setSettleSubmitting(true);
    try {
      const settlementData = {
        groupId,
        payerId: settlePayer,
        payeeId: settlePayee,
        amount: amt,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "groups", groupId, "settlements"), settlementData);
      setIsSettleOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `groups/${groupId}/settlements`);
    } finally {
      setSettleSubmitting(false);
    }
  };

  // Add Member by Email
  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);

    const email = newEmail.trim().toLowerCase();
    if (!email) return;

    if (group.memberEmails.includes(email)) {
      setInviteError("This email is already in the group roster.");
      return;
    }

    try {
      // 1. Compile update emails
      const updatedEmails = [...group.memberEmails, email];

      // 2. Check if a synced user already exists with this email globally
      const matchedUser = (Object.values(users) as UserProfile[]).find(
        (u) => u.email.toLowerCase() === email
      );

      const updatedIds = [...group.memberIds];
      if (matchedUser && !updatedIds.includes(matchedUser.uid)) {
        updatedIds.push(matchedUser.uid);
      }

      // 3. Write modified lists back to group metadata
      const groupDocRef = doc(db, "groups", groupId);
      await updateDoc(groupDocRef, {
        memberEmails: updatedEmails,
        memberIds: updatedIds,
      });

      setNewEmail("");
      setInviteSuccess(`Successfully added ${email} to this group ledger.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `groups/${groupId}`);
    }
  };

  // Leave / Remove member logic
  const handleRemoveMember = async (uidToRemove: string) => {
    setInviteError(null);
    setInviteSuccess(null);

    // CRITICAL: Ensure balance is exactly zero before removing from ledger!
    const memberStanding = netBalances[uidToRemove] || 0;
    if (Math.abs(memberStanding) > 0.05) {
      setInviteError(
        `Denied. ${users[uidToRemove]?.displayName || "This user"} has an active standing balance of $${memberStanding.toFixed(2)}. They must settle up fully to leave.`
      );
      return;
    }

    const confirm = window.confirm(
      `Are you sure you want to remove ${users[uidToRemove]?.displayName || "this member"} from the group?`
    );
    if (!confirm) return;

    try {
      const emailToRemove = users[uidToRemove]?.email.toLowerCase() || "";
      const updatedEmails = group.memberEmails.filter(
        (em) => em.toLowerCase() !== emailToRemove
      );
      const updatedIds = group.memberIds.filter((id) => id !== uidToRemove);

      const groupDocRef = doc(db, "groups", groupId);
      await updateDoc(groupDocRef, {
        memberEmails: updatedEmails,
        memberIds: updatedIds,
      });

      setInviteSuccess("Member successfully removed from group ledger.");
      
      // If removed myself, return to dashboard
      if (uidToRemove === myUid) {
        onBack();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `groups/${groupId}`);
    }
  };

  // Delete Expense
  const handleDeleteExpense = async (expId: string) => {
    const doubleCheck = window.confirm("Are you sure you want to permanently delete this expense?");
    if (!doubleCheck) return;

    try {
      await deleteDoc(doc(db, "groups", groupId, "expenses", expId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `groups/${groupId}/expenses/${expId}`);
    }
  };

  // Delete Settlement record
  const handleDeleteSettlement = async (setId: string) => {
    const doubleCheck = window.confirm("Are you sure you want to permanently remove this settlement record?");
    if (!doubleCheck) return;

    try {
      await deleteDoc(doc(db, "groups", groupId, "settlements", setId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `groups/${groupId}/settlements/${setId}`);
    }
  };

  const toggleExpandExpense = (id: string) => {
    setExpandedExpenses((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div id={`group-detail-${groupId}`} className="min-h-screen bg-slate-50 pb-16 font-sans">
      
      {/* Group Detail Banner */}
      <div className="mx-auto max-w-5xl px-4 pt-6">
        <section className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-855 text-white relative py-8 px-6 rounded-2xl shadow-md border border-slate-800">
          <div className="mx-auto max-w-5xl">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-xs font-semibold text-slate-300 hover:text-white transition-colors mb-6 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </button>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <span className="inline-flex items-center gap-1 bg-slate-800 text-slate-350 font-bold text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest mb-2 border border-slate-700/50">
                active ledger roster
              </span>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl text-white">
                {group.name}
              </h1>
              <p className="text-xs text-slate-400 max-w-xl mt-1.5 font-medium leading-relaxed">
                {group.description || "No billing description specified for this group."}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => handleOpenSettle()}
                className="flex items-center justify-center gap-2 rounded-lg bg-teal-650 px-5 py-2.5 hover:bg-teal-600 transition-colors text-xs font-bold shadow-sm cursor-pointer active:scale-97"
              >
                <Coins className="h-4 w-4" />
                Settle up cash
              </button>
              <button
                onClick={() => setIsExpenseOpen(true)}
                className="flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 hover:bg-orange-600 transition-colors text-xs font-bold shadow-sm cursor-pointer active:scale-97"
              >
                <Plus className="h-4 w-4 stroke-[2.5]" />
                Add Group Bill
              </button>
            </div>
          </div>
        </div>
      </section>
      </div>

      {/* Main Content Layout */}
      <main className="mx-auto max-w-5xl px-4 py-6 grid gap-6 lg:grid-cols-12">
        
        {/* LEFT COLUMN: Main Ledger Content (8/12 widths) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Standing info chip bar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Your Balance Here</span>
                <span className={`text-base font-extrabold ${myBalance > 0 ? "text-emerald-600" : myBalance < 0 ? "text-rose-600" : "text-slate-500"}`}>
                  {myBalance > 0 ? `+$${myBalance.toFixed(2)}` : myBalance < 0 ? `-$${Math.abs(myBalance).toFixed(2)}` : "$0.00"}
                </span>
              </div>
            </div>

            <span className="text-xs text-slate-400 font-semibold italic">
              {myBalance > 0 ? "You are owed cash" : myBalance < 0 ? "You owe group members" : "Perfectly cleared!"}
            </span>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1.5 p-1 bg-white border border-slate-200 rounded-xl flex-wrap">
            {(["expenses", "debts", "members", "activity"] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setInviteError(null);
                  setInviteSuccess(null);
                }}
                className={`flex-1 rounded-lg py-2.5 text-xs font-bold transition-all capitalize cursor-pointer min-w-[100px] ${
                  activeTab === tab
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                {tab === "expenses" ? "Expenses Ledger" : tab === "debts" ? "Balances & Settle" : tab === "members" ? "Group Members" : "Activity Feed"}
              </button>
            ))}
            <button
              onClick={exportToCSV}
              className="flex-1 rounded-lg py-2.5 text-xs font-bold transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-slate-200 cursor-pointer"
            >
              Export CSV
            </button>
          </div>

          {/* TAB 1: Expenses Ledger List */}
          {activeTab === "expenses" && (
            <div className="space-y-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 bg-white rounded-3xl border border-slate-100">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-500 border-t-transparent" />
                  <span className="text-xs text-slate-400 font-medium mt-2">Reading ledger transactions...</span>
                </div>
              ) : expenses.length === 0 && settlements.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center p-10 bg-white rounded-3xl border border-dashed border-slate-200">
                  <div className="rounded-full bg-slate-100 p-4 text-slate-400 mb-3">
                    <FileText className="h-8 w-8" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700">Ledger sheet is empty</h4>
                  <p className="text-xs text-slate-400 max-w-sm mt-1">
                    No transactions or settlements found. Hit "Add Group Bill" to split something now!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* EXPENSES ROWS */}
                  {expenses.map((exp) => {
                    const payerProfile = users[exp.paidById];
                    const isExpanded = !!expandedExpenses[exp.id];
                    const portionOwedByMe = exp.calculatedAmounts[myUid] || 0;
                    const didIPay = exp.paidById === myUid;

                    return (
                      <div
                        key={exp.id}
                        id={`expense-row-${exp.id}`}
                        className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-xs hover:shadow-md transition-all"
                      >
                        {/* Summary Block */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <img
                              src={payerProfile?.photoURL || "https://api.dicebear.com/7.x/initials/svg?seed=user"}
                              alt="paidBy"
                              className="h-9 w-9 rounded-full object-cover ring-2 ring-slate-100"
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                {exp.description}
                                {exp.category && (
                                  <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[10px] font-medium border border-slate-200">
                                    {exp.category}
                                  </span>
                                )}
                                {exp.isRecurring && (
                                  <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-[10px] font-medium border border-blue-200 flex items-center gap-1">
                                    🔄 Recurring
                                  </span>
                                )}
                              </h4>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <span className="text-[10px] text-slate-400 font-semibold">
                                  Paid by{" "}
                                  <span className="font-bold text-slate-600">
                                    {didIPay ? "You" : payerProfile?.displayName || "Member"}
                                  </span>
                                </span>
                                <span className="text-[10px] text-slate-300 font-bold">&bull;</span>
                                {exp.splitType === "equal" ? (
                                  <span className="bg-teal-50 text-teal-700 border border-teal-200 uppercase tracking-wider font-bold text-[8.5px] px-2 py-0.5 rounded-md inline-block">
                                    Equal Split
                                  </span>
                                ) : exp.splitType === "percentage" ? (
                                  <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider font-bold text-[8.5px] px-2 py-0.5 rounded-md inline-block">
                                    Percentage split
                                  </span>
                                ) : exp.splitType === "unequal" ? (
                                  <span className="bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider font-bold text-[8.5px] px-2 py-0.5 rounded-md inline-block">
                                    Unequal split
                                  </span>
                                ) : (
                                  <span className="bg-purple-50 text-purple-700 border border-purple-200 uppercase tracking-wider font-bold text-[8.5px] px-2 py-0.5 rounded-md inline-block">
                                    Shares split
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-6 self-end sm:self-center">
                            {/* Visual amount */}
                            <div className="text-right">
                              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Total</span>
                              <span className="text-base font-extrabold text-slate-800">${exp.amount.toFixed(2)}</span>
                            </div>

                            {/* What you stand relative to this bill */}
                            <div className="text-right min-w-[90px]">
                              {didIPay ? (
                                <>
                                  <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 block leading-tight">You lent</span>
                                  <span className="text-sm font-bold text-emerald-600">
                                    +${(exp.amount - portionOwedByMe).toFixed(2)}
                                  </span>
                                </>
                              ) : portionOwedByMe > 0 ? (
                                <>
                                  <span className="text-[10px] uppercase font-bold tracking-wider text-rose-500 block leading-tight">You owe</span>
                                  <span className="text-sm font-bold text-rose-500">
                                    -${portionOwedByMe.toFixed(2)}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-450 block leading-tight">Not in bill</span>
                                  <span className="text-sm font-bold text-slate-400">$0.00</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Collapsible allocations and Chat Drawer actions */}
                        <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between flex-wrap gap-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => toggleExpandExpense(exp.id)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer bg-slate-50 hover:bg-slate-100 rounded-lg px-2.5 py-1.5 transition-colors border border-slate-200/40"
                            >
                              {isExpanded ? "Hide Splits" : "View Split Details"}
                              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </button>

                            <button
                              onClick={() => setActiveChatExpense(exp)}
                              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer bg-emerald-50/50 hover:bg-emerald-100/50 rounded-lg px-2.5 py-1.5 transition-colors border border-emerald-100/60"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              Expense Chat
                            </button>
                          </div>

                          <button
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="rounded-lg p-1.5 text-slate-350 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer ml-auto"
                            title="Delete Expense"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Expandable allocations list */}
                        {isExpanded && (
                          <div className="mt-3 bg-slate-50 rounded-xl p-3 border border-slate-200/40 space-y-1.5">
                            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Member Shares breakdown:</div>
                            {Object.entries(exp.calculatedAmounts).map(([uId, owedAmt]) => {
                              const prof = users[uId];
                              return (
                                <div key={uId} className="flex justify-between items-center text-xs">
                                  <span className="text-slate-600 font-medium">
                                    {prof?.displayName || "Member"} {uId === myUid ? "(You)" : ""}
                                  </span>
                                  <span className="font-bold text-slate-800">${(owedAmt as number).toFixed(2)}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* SETTLEMENTS LEDGER SECTION */}
                  {settlements.length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-400 mb-3 block">Cash Settlements History:</h4>
                      <div className="space-y-3">
                        {settlements.map((set) => {
                          const payer = users[set.payerId];
                          const payee = users[set.payeeId];
                          const isSentByMe = set.payerId === myUid;

                          return (
                            <div
                              key={set.id}
                              className="flex items-center justify-between rounded-xl border border-slate-150 bg-slate-50/50 px-4 py-3 shadow-xs"
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center">
                                  <Coins className="h-4.5 w-4.5" />
                                </div>
                                <div>
                                  <p className="text-xs text-slate-705">
                                    <span className="font-bold text-slate-800">
                                      {isSentByMe ? "You" : payer?.displayName || "Member"}
                                    </span>{" "}
                                    settled up with{" "}
                                    <span className="font-bold text-slate-800">
                                      {set.payeeId === myUid ? "You" : payee?.displayName || "Member"}
                                    </span>
                                  </p>
                                  <span className="text-[9px] text-slate-400 font-semibold block">Confirmed Cash Transaction</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-4">
                                <span className="text-xs font-extrabold text-teal-700">${set.amount.toFixed(2)}</span>
                                <button
                                  onClick={() => handleDeleteSettlement(set.id)}
                                  className="text-slate-350 hover:text-red-500 hover:bg-white rounded-md p-1 border border-slate-100 transition-colors cursor-pointer"
                                  title="Delete settlement record"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Activity Feed */}
          {activeTab === "activity" && (
            <div className="space-y-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 bg-white rounded-3xl border border-slate-100">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-500 border-t-transparent" />
                  <span className="text-xs text-slate-400 font-medium mt-2">Loading activity feed...</span>
                </div>
              ) : expenses.length === 0 && settlements.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center p-10 bg-white rounded-3xl border border-dashed border-slate-200">
                  <div className="rounded-full bg-slate-100 p-4 text-slate-400 mb-3">
                    <FileText className="h-8 w-8" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700">No activity yet</h4>
                  <p className="text-xs text-slate-400 max-w-sm mt-1">
                    Transactions and settlements will appear here chronologically.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {[...expenses.map(e => ({...e, type: 'expense' as const})), ...settlements.map(s => ({...s, type: 'settlement' as const}))]
                    .sort((a, b) => {
                      const t1 = a.createdAt?.seconds || 0;
                      const t2 = b.createdAt?.seconds || 0;
                      return t2 - t1; // Descending
                    })
                    .map((item) => {
                      if (item.type === 'expense') {
                        const exp = item as Expense & { type: 'expense' };
                        const payerProfile = users[exp.paidById];
                        return (
                          <div key={`act-exp-${exp.id}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex items-center gap-4">
                            <div className="h-10 w-10 shrink-0 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                              <Receipt className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-slate-800">{exp.description}</h4>
                                <span className="text-sm font-extrabold text-slate-900">${exp.amount.toFixed(2)}</span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                <span className="font-semibold text-slate-700">{payerProfile?.displayName || "Someone"}</span> added an expense
                                <span className="text-slate-300 mx-1.5">•</span>
                                {exp.createdAt ? new Date(exp.createdAt.seconds * 1000).toLocaleDateString() : "Pending"}
                              </p>
                            </div>
                          </div>
                        );
                      } else {
                        const set = item as Settlement & { type: 'settlement' };
                        const payer = users[set.payerId];
                        const payee = users[set.payeeId];
                        return (
                          <div key={`act-set-${set.id}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex items-center gap-4">
                            <div className="h-10 w-10 shrink-0 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center border border-violet-100">
                              <Coins className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-slate-800">Settled up</h4>
                                <span className="text-sm font-extrabold text-violet-600">${set.amount.toFixed(2)}</span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                <span className="font-semibold text-slate-700">{payer?.displayName || "Someone"}</span> paid <span className="font-semibold text-slate-700">{payee?.displayName || "Someone"}</span>
                                <span className="text-slate-300 mx-1.5">•</span>
                                {set.createdAt ? new Date(set.createdAt.seconds * 1000).toLocaleDateString() : "Pending"}
                              </p>
                            </div>
                          </div>
                        );
                      }
                    })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Balances & Simplified Debts */}
          {activeTab === "debts" && (
            <div className="space-y-6">
              
              {/* Standings list */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <h4 className="text-sm font-bold text-slate-800 mb-4">Net Balances Inside Group</h4>
                
                <div className="space-y-3.5">
                  {group.memberIds.map((uid) => {
                    const prof = users[uid];
                    const amt = netBalances[uid] || 0;

                    return (
                      <div key={uid} className="flex items-center justify-between border-b border-slate-50 last:border-0 pb-3 last:pb-0">
                        <div className="flex items-center gap-2">
                          <img
                            src={prof?.photoURL || "https://api.dicebear.com/7.x/initials/svg?seed=user"}
                            alt="Avatar"
                            className="h-7 w-7 rounded-full object-cover"
                          />
                          <span className="text-xs font-bold text-slate-700">
                            {prof?.displayName || "Group Member"} {uid === myUid ? "(You)" : ""}
                          </span>
                        </div>

                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                            amt > 0
                              ? "bg-emerald-50 text-emerald-700"
                              : amt < 0
                              ? "bg-rose-50 text-rose-700"
                              : "bg-slate-50 text-slate-400"
                          }`}
                        >
                          {amt > 0 ? `Owed +$${amt.toFixed(2)}` : amt < 0 ? `Owes $${Math.abs(amt).toFixed(2)}` : "Settled"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Simplified Debts ledger */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-5 w-5 text-violet-500" />
                  <h4 className="text-sm font-bold text-slate-800">Splitwise Simplified Debts</h4>
                </div>
                <p className="text-xs text-slate-400 mb-4">
                  These calculated transfers minimize the total number of transactions required to settle up.
                </p>

                {simplifiedDebts.length === 0 ? (
                  <div className="flex items-center justify-center p-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-center text-xs text-slate-500 font-medium">
                     Perfectly cleared! No active settlements are currently pending.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {simplifiedDebts.map((debt, idx) => {
                      const fromUser = users[debt.from];
                      const toUser = users[debt.to];

                      const isImOwing = debt.from === myUid;
                      const isImReceiving = debt.to === myUid;

                      return (
                        <div
                          key={idx}
                          className={`flex items-center justify-between rounded-xl p-3 border ${
                            isImOwing
                              ? "bg-rose-50/20 border-rose-100"
                              : isImReceiving
                              ? "bg-emerald-50/20 border-emerald-100"
                              : "bg-slate-50/30 border-slate-150"
                          }`}
                        >
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-bold text-slate-800">
                              {isImOwing ? "You" : fromUser?.displayName || "Member"}
                            </span>
                            <span className="text-slate-400 font-semibold italic">owes</span>
                            <span className="font-bold text-slate-800">
                              {isImReceiving ? "You" : toUser?.displayName || "Member"}
                            </span>
                            <span className="text-[11px] font-extrabold text-slate-900 border-l border-slate-200 pl-2">
                              ${debt.amount.toFixed(2)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {isImOwing && (
                              <a
                                href={`venmo://pay?charge=pay&txn=pay&amount=${debt.amount.toFixed(2)}&note=Splitwise%20Settlement`}
                                className="rounded-lg bg-[#008CFF] hover:bg-[#007BE0] px-3 py-1.5 text-[10px] font-bold text-white transition-colors cursor-pointer"
                              >
                                Venmo
                              </a>
                            )}
                            {isImReceiving && fromUser?.email && (
                              <a
                                href={`mailto:${fromUser.email}?subject=Reminder:%20Settle%20up%20on%20Splitwise&body=Hi%20${fromUser.displayName},%0A%0AJust%20a%20friendly%20reminder%20that%20you%20owe%20$${debt.amount.toFixed(2)}%20in%20the%20${encodeURIComponent(group.name)}%20group.%0A%0AThanks!`}
                                className="rounded-lg bg-amber-500 hover:bg-amber-600 px-3 py-1.5 text-[10px] font-bold text-white transition-colors cursor-pointer"
                              >
                                Remind
                              </a>
                            )}
                            <button
                              onClick={() => handleOpenSettle(debt.from, debt.to, debt.amount)}
                              className="rounded-lg bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-[10px] font-bold text-white transition-colors cursor-pointer"
                            >
                              Record cash settle
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Members & Invites */}
          {activeTab === "members" && (
            <div className="space-y-6">
              
              {/* Add member box */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-3">
                  <UserPlus className="h-5 w-5 text-emerald-600" />
                  <h4 className="text-sm font-bold text-slate-800">Invite Members To Group</h4>
                </div>

                <form onSubmit={handleInviteMember} className="flex gap-2">
                  <input
                    type="email"
                    required
                    placeholder="friend@email.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2 text-xs focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-slate-900 hover:bg-slate-800 py-2.5 px-4 text-xs font-bold text-white transition-colors cursor-pointer"
                  >
                    Add Ledger Member
                  </button>
                </form>

                {inviteError && (
                  <div className="mt-3 rounded-lg bg-orange-50 p-2.5 text-[11px] font-semibold text-orange-700">
                    {inviteError}
                  </div>
                )}
                {inviteSuccess && (
                  <div className="mt-3 rounded-lg bg-emerald-50 p-2.5 text-[11px] font-semibold text-emerald-800 flex items-center gap-1">
                    <Check className="h-4 w-4 stroke-[2.5]" />
                    <span>{inviteSuccess}</span>
                  </div>
                )}
              </div>

              {/* Members dynamic list */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Users className="h-4.5 w-4.5 text-slate-400" />
                  Current Group ledger members ({group.memberIds.length})
                </h4>

                <div className="space-y-3">
                  {group.memberEmails.map((email) => {
                    // Match a profile if they exist in syncing dictionary
                    const profile = (Object.values(users) as UserProfile[]).find(
                      (u) => u.email.toLowerCase() === email.toLowerCase()
                    );

                    const isMe = profile?.uid === myUid;

                    return (
                      <div
                        key={email}
                        className="flex items-center justify-between border-b border-slate-50 last:border-0 pb-2.5 last:pb-0"
                      >
                        <div className="flex items-center gap-2.5">
                          <img
                            src={profile?.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(email)}`}
                            alt="Avatar"
                            className="h-8 w-8 rounded-full border border-slate-100 object-cover"
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-850 block">
                              {profile?.displayName || "Invited / Pending login"} {isMe ? "(You)" : ""}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium block leading-tight">{email}</span>
                          </div>
                        </div>

                        {/* Leave or delete button */}
                        <button
                          onClick={() => profile && handleRemoveMember(profile.uid)}
                          disabled={!profile}
                          className="rounded-lg p-1.5 text-slate-350 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40 cursor-pointer"
                          title={profile ? "Remove Member" : "Settle validations require complete profiles"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Static sidebar items / Real-time chat integration (4/12 width) */}
        <div id="side-chat-col" className="lg:col-span-4 space-y-6">
          {activeChatExpense ? (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden sticky top-24">
              <ExpenseChat
                groupId={groupId}
                expense={activeChatExpense}
                onClose={() => setActiveChatExpense(null)}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-250 bg-slate-50/50 p-6 shadow-xs text-center flex flex-col justify-center items-center h-48 sticky top-24">
              <MessageSquare className="h-8 w-8 text-slate-300 stroke-[1.5] mb-2" />
              <h5 className="text-xs font-extrabold text-slate-500">No Chat Thread Selected</h5>
              <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
                Click "Expense Chat" beside any transaction row to open its real-time text discussion here.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Expense Modal Wizard */}
      <ExpenseModal
        group={group}
        isOpen={isExpenseOpen}
        onClose={() => setIsExpenseOpen(false)}
      />

      {/* Settlement Modal Trigger */}
      <AnimatePresence>
        {isSettleOpen && (
          <div
            id="settle-backdrop"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
          >
            <motion.div
              id="settle-wizard"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-teal-600" />
                  <h3 className="text-lg font-bold text-slate-805">Record Cash Settlement</h3>
                </div>
                <button
                  onClick={() => setIsSettleOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {settleError && (
                <div className="mb-4 rounded-lg bg-orange-50 p-2.5 text-xs font-semibold text-orange-700">
                  {settleError}
                </div>
              )}

              <form onSubmit={handleRecordSettlement} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-550 uppercase tracking-wide mb-1">
                    Payer (Who spent the cash)
                  </label>
                  <select
                    value={settlePayer}
                    onChange={(e) => setSettlePayer(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs bg-white focus:outline-none"
                  >
                    {group.memberIds.map((uid) => (
                      <option key={uid} value={uid}>
                        {users[uid]?.displayName || "Loading..."} {uid === myUid ? "(You)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-550 uppercase tracking-wide mb-1">
                    Payee (Who gets the cash)
                  </label>
                  <select
                    value={settlePayee}
                    onChange={(e) => setSettlePayee(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs bg-white focus:outline-none"
                  >
                    {group.memberIds.map((uid) => (
                      <option key={uid} value={uid}>
                        {users[uid]?.displayName || "Loading..."} {uid === myUid ? "(You)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-550 uppercase tracking-wide mb-1">
                    Cash settlement amount ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-bold focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsSettleOpen(false)}
                    className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 border border-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={settleSubmitting}
                    className="rounded-xl bg-teal-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-teal-500 transition-colors shadow-md cursor-pointer"
                  >
                    {settleSubmitting ? "Settle..." : "Record Payment"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
