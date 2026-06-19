import React, { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { Group, SplitType } from "../types";
import { calculateSplits } from "../utils";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { motion, AnimatePresence } from "motion/react";
import { X, Receipt, Check, AlertCircle, Sparkles, AlertTriangle, ScanLine } from "lucide-react";
import { GoogleGenAI } from "@google/genai";

interface ExpenseModalProps {
  group: Group;
  isOpen: boolean;
  onClose: () => void;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({ group, isOpen, onClose }) => {
  const { userProfile, users } = useApp();

  // Basic fields
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Other");
  const [amountInput, setAmountInput] = useState("");
  const [paidById, setPaidById] = useState("");
  const [splitType, setSplitType] = useState<SplitType>("equal");

  // Dynamic values per member
  const [participants, setParticipants] = useState<string[]>([]); // active who partake in split (for equal split checkboxes)
  const [memberSplits, setMemberSplits] = useState<Record<string, number>>({}); // holds raw weights/percents/amounts per UID

  const [currency, setCurrency] = useState<"USD" | "EUR" | "INR">("USD");
  const currencyRates = { USD: 1, EUR: 0.92, INR: 83.5 };

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);

  // Request Notification Permissions
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Initialize
  useEffect(() => {
    if (isOpen) {
      setDescription("");
      setCategory("Other");
      setAmountInput("");
      setIsRecurring(false);
      setPaidById(userProfile?.uid || group.memberIds[0] || "");
      setSplitType("equal");
      setParticipants(group.memberIds);
      
      // Seed default splits values
      const initialSplits: Record<string, number> = {};
      group.memberIds.forEach((uid) => {
        initialSplits[uid] = 0;
      });
      setMemberSplits(initialSplits);
      setFormError(null);
    }
  }, [isOpen, group, userProfile]);

  if (!isOpen) return null;

  const totalAmount = parseFloat(amountInput) || 0;

  // Track state calculations
  const handleScanReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setFormError(null);

    try {
      // 1. Read file as base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          // Extract just the base64 part, split by comma
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const base64Image = await base64Promise;

      // 2. Initialize Gemini
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "mock";

      if (apiKey === "mock") {
        setTimeout(() => {
          setAmountInput("42.50");
          setDescription("Dinner at Local Restaurant");
          setCategory("Food");
          setIsScanning(false);
        }, 1500);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: "Analyze this receipt. Extract the purchased items as a comma-separated list, extract the total amount as a number, and provide a short description of the venue. Also suggest a category from this list: Food, Travel, Utilities, Shopping, Other. Return ONLY a JSON object in this exact format, with no markdown formatting: {\"amount\": 0.00, \"description\": \"Venue Name (Items: item1, item2)\", \"category\": \"Category\"}"
              },
              {
                inlineData: {
                  data: base64Image,
                  mimeType: file.type
                }
              }
            ]
          }
        ]
      });

      const resultText = response.text;
      if (resultText) {
        const parsed = JSON.parse(resultText.replace(/```json/g, "").replace(/```/g, "").trim());
        if (parsed.amount) setAmountInput(String(parsed.amount));
        if (parsed.description) setDescription(parsed.description);
        if (parsed.category) setCategory(parsed.category);
      }
    } catch (err: any) {
      console.error("Scanning Error:", err);
      setFormError("Failed to scan receipt. Please enter details manually.");
    } finally {
      setIsScanning(false);
      e.target.value = "";
    }
  };

  const handleSplitValueChange = (uid: string, val: number) => {
    setMemberSplits((prev) => ({
      ...prev,
      [uid]: val < 0 ? 0 : val, // prevent negative values
    }));
  };

  const toggleParticipant = (uid: string) => {
    setParticipants((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleSplitTypeChange = (type: SplitType) => {
    setSplitType(type);
    setFormError(null);

    // Initial default resets
    const initialSplits: Record<string, number> = {};
    group.memberIds.forEach((uid) => {
      if (type === "shares") {
        initialSplits[uid] = 1; // Default to 1 share each
      } else if (type === "percentage") {
        initialSplits[uid] = Number((100 / group.memberIds.length).toFixed(2)); // Equal percent initially
      } else {
        initialSplits[uid] = 0;
      }
    });
    setMemberSplits(initialSplits);
  };

  // Validations & sums
  const getValidationIssues = () => {
    if (totalAmount <= 0) {
      return "Expense amount must be a positive number greater than zero.";
    }

    if (splitType === "equal") {
      if (participants.length === 0) {
        return "You must check at least one participant to share the bill.";
      }
    } else if (splitType === "unequal") {
      const sum = (Object.values(memberSplits) as number[]).reduce((a, b) => a + b, 0);
      const diff = Math.abs(totalAmount - sum);
      if (diff > 0.05) {
        return `Unequal amounts must sum exactly to the bill: $${totalAmount.toFixed(2)}. Currently: $${sum.toFixed(2)} (Diff: $${(totalAmount - sum).toFixed(2)}).`;
      }
    } else if (splitType === "percentage") {
      const sum = (Object.values(memberSplits) as number[]).reduce((a, b) => a + b, 0);
      if (Math.abs(100 - sum) > 0.05) {
        return `Percentages must sum exactly to 100%. Currently: ${sum.toFixed(1)}%.`;
      }
    } else if (splitType === "shares") {
      const totalShares = (Object.values(memberSplits) as number[]).reduce((a, b) => a + b, 0);
      if (totalShares <= 0) {
        return "Total of shares weights must be greater than zero.";
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const validationMsg = getValidationIssues();
    if (validationMsg) {
      setFormError(validationMsg);
      return;
    }

    if (!userProfile) return;
    setIsSubmitting(true);

    try {
      // 1. Convert to base USD if a foreign currency was selected
      const baseAmount = totalAmount / currencyRates[currency];

      const baseMemberSplits = { ...memberSplits };
      if (splitType === "unequal") {
        for (const [k, v] of Object.entries(baseMemberSplits)) {
          baseMemberSplits[k] = (v as number) / currencyRates[currency];
        }
      }

      // 2. Resolve participants depending on split mode
      const activeParts = splitType === "equal" ? participants : group.memberIds;

      // 3. Perform the split calculation in BASE USD
      const calculatedAmounts = calculateSplits(
        baseAmount,
        splitType,
        activeParts,
        baseMemberSplits
      );

      // Verify no NaN values
      for (const [k, v] of Object.entries(calculatedAmounts)) {
        if (isNaN(v)) {
          calculatedAmounts[k] = 0;
        }
      }

      // 4. Save inside group expenses (as Base USD)
      const expenseData = {
        groupId: group.id,
        description: description.trim() || "Unspecified bill",
        category,
        isRecurring,
        amount: baseAmount,
        paidById: paidById,
        splitType: splitType,
        splits: baseMemberSplits,
        calculatedAmounts: calculatedAmounts,
        createdById: userProfile.uid,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "groups", group.id, "expenses"), expenseData);

      // Trigger browser push notification
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("New Expense Added!", {
          body: `Added ${description.trim() || "Unspecified bill"} to ${group.name}`,
          icon: "https://api.dicebear.com/7.x/shapes/svg?seed=expense"
        });
      }

      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `groups/${group.id}/expenses`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper values for reactive feedback in the modal UI
  const unequalTotalSum = (Object.values(memberSplits) as number[]).reduce((a, b) => a + b, 0);
  const percentageTotalSum = (Object.values(memberSplits) as number[]).reduce((a, b) => a + b, 0);

  return (
    <div
      id="expense-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
    >
      <motion.div
        id="expense-modal-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto"
      >
        <div id="expense-modal-header" className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-emerald-600" />
            <h2 className="text-xl font-bold text-slate-800">Add an Expense</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative overflow-hidden cursor-pointer group">
              <input
                type="file"
                accept="image/*"
                onChange={handleScanReceipt}
                disabled={isScanning}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                title="Scan Receipt with AI"
              />
              <button
                type="button"
                disabled={isScanning}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-colors border border-indigo-100 text-[11px] font-bold"
              >
                <ScanLine className={`h-3.5 w-3.5 ${isScanning ? "animate-pulse" : ""}`} />
                {isScanning ? "Scanning..." : "Scan Receipt"}
              </button>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {formError && (
          <div className="mb-4 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 flex items-start gap-2 border border-rose-100">
            <AlertCircle className="h-4.5 w-4.5 shrink-0 text-rose-600 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Main Details block */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Description
              </label>
              <div className="flex gap-2">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-1/3 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none bg-white cursor-pointer"
                >
                  <option value="Food">🍔 Food</option>
                  <option value="Travel">✈️ Travel</option>
                  <option value="Utilities">💡 Utilities</option>
                  <option value="Shopping">🛍️ Shopping</option>
                  <option value="Other">📝 Other</option>
                </select>
                <input
                  type="text"
                  required
                  placeholder="e.g. Uber, Groceries, Flight Ticket"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-2/3 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Amount Paid
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-800">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="cursor-pointer"
                  />
                  Monthly recurring
                </label>
              </div>
              <div className="flex gap-2">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as "USD" | "EUR" | "INR")}
                  className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-bold bg-slate-50 text-slate-600 focus:outline-none cursor-pointer"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="INR">INR (₹)</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Who Paid?
              </label>
              <select
                value={paidById}
                onChange={(e) => setPaidById(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none bg-white cursor-pointer"
              >
                {group.memberIds.map((uid) => {
                  const prof = users[uid];
                  return (
                    <option key={uid} value={uid}>
                      {prof?.displayName || "Loading member..."} {prof?.uid === userProfile?.uid ? "(You)" : ""}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Split Tactic
              </label>
              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-50 border border-slate-200/60 rounded-xl">
                {(["equal", "unequal", "percentage", "shares"] as SplitType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleSplitTypeChange(type)}
                    className={`rounded-lg py-1.5 text-[10px] font-bold capitalize transition-colors cursor-pointer ${
                      splitType === type
                        ? "bg-slate-900 text-white shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Core Dynamic Splits Config Area */}
          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-600 block uppercase tracking-wide">
                Split Allocation Matrix
              </span>

              {/* Helpful inline status summaries */}
              {splitType === "unequal" && (
                <span
                  className={`text-xs font-bold ${
                    Math.abs(totalAmount - unequalTotalSum) < 0.05
                      ? "text-emerald-600"
                      : "text-amber-500"
                  }`}
                >
                  Sum: ${unequalTotalSum.toFixed(2)} / ${totalAmount.toFixed(2)}
                </span>
              )}
              {splitType === "percentage" && (
                <span
                  className={`text-xs font-bold ${
                    Math.abs(100 - percentageTotalSum) < 0.05
                      ? "text-emerald-600"
                      : "text-amber-500"
                  }`}
                >
                  Sum: {percentageTotalSum.toFixed(1)}% / 100%
                </span>
              )}
            </div>

            <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-3 space-y-2.5 max-h-56 overflow-y-auto">
              {group.memberIds.map((uid) => {
                const memberProfile = users[uid];
                const isSelected = participants.includes(uid);
                const val = memberSplits[uid] || 0;

                return (
                  <div key={uid} className="flex items-center justify-between gap-4 py-1 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-2">
                      {splitType === "equal" && (
                        <button
                          type="button"
                          onClick={() => toggleParticipant(uid)}
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all cursor-pointer ${
                            isSelected
                              ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                              : "border-slate-350 bg-white"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3 stroke-[2.5]" />}
                        </button>
                      )}
                      
                      <img
                        src={memberProfile?.photoURL || "https://api.dicebear.com/7.x/initials/svg?seed=user"}
                        alt="Avatar"
                        className="h-6.5 w-6.5 rounded-full object-cover"
                      />
                      <span className="text-xs font-bold text-slate-700">
                        {memberProfile?.displayName || "Group Member"}
                        {memberProfile?.uid === userProfile?.uid ? " (You)" : ""}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {splitType === "equal" && (
                        <span className="text-xs text-slate-400 font-semibold italic">
                          {isSelected ? `$${(totalAmount / participants.length || 0).toFixed(2)}` : "Excluded"}
                        </span>
                      )}

                      {splitType === "unequal" && (
                        <div className="relative rounded-lg flex items-center">
                          <span className="text-xs text-slate-400 font-bold absolute left-2">$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={val || ""}
                            placeholder="0.00"
                            onChange={(e) => handleSplitValueChange(uid, parseFloat(e.target.value) || 0)}
                            className="w-24 rounded-lg border border-slate-250 bg-white pl-5 pr-2 py-1.5 text-xs text-right font-medium focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      )}

                      {splitType === "percentage" && (
                        <div className="relative rounded-lg flex items-center">
                          <input
                            type="number"
                            step="0.1"
                            value={val || ""}
                            placeholder="0"
                            onChange={(e) => handleSplitValueChange(uid, parseFloat(e.target.value) || 0)}
                            className="w-20 rounded-lg border border-slate-250 bg-white px-2 py-1.5 text-xs text-right font-bold focus:outline-none focus:border-emerald-500"
                          />
                          <span className="text-xs text-slate-400 font-bold ml-1">%</span>
                        </div>
                      )}

                      {splitType === "shares" && (
                        <div className="relative rounded-lg flex items-center gap-2">
                          <input
                            type="number"
                            step="1"
                            value={val || ""}
                            placeholder="1"
                            onChange={(e) => handleSplitValueChange(uid, parseInt(e.target.value) || 0)}
                            className="w-16 rounded-lg border border-slate-250 bg-white px-2 py-1.5 text-xs text-center font-bold focus:outline-none focus:border-emerald-500"
                          />
                          <span className="text-xs text-slate-400 font-semibold">{val === 1 ? "share" : "shares"}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Submit Row */}
          <div id="expense-modal-save" className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              onClick={onClose}
              type="button"
              className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 border border-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? "Processing..." : "Add Bill"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
