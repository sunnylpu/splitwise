import React, { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../firebase";
import { Group, Expense, Settlement } from "../types";
import { getSimplifiedDebts } from "../utils";
import { motion } from "motion/react";
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  ArrowRight, 
  Users, 
  ChevronRight, 
  LogOut,
  Sparkles,
  Smile,
  Frown,
  Coins
} from "lucide-react";

interface DashboardProps {
  onSelectGroup: (groupId: string) => void;
  onOpenCreateGroup: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectGroup, onOpenCreateGroup }) => {
  const { userProfile, groups, groupsLoading, logout, users } = useApp();
  
  // Track detailed state per group to calculate global balances
  const [groupExpenses, setGroupExpenses] = useState<Record<string, Expense[]>>({});
  const [groupSettlements, setGroupSettlements] = useState<Record<string, Settlement[]>>({});

  // Listen to expenses of all groups
  useEffect(() => {
    if (groups.length === 0) {
      setGroupExpenses({});
      setGroupSettlements({});
      return;
    }

    const unsubscribes: (() => void)[] = [];

    groups.forEach((group) => {
      // Subscribe to expenses
      const expQuery = collection(db, "groups", group.id, "expenses");
      const expUnsub = onSnapshot(expQuery, (snapshot) => {
        const exps: Expense[] = [];
        snapshot.forEach((doc) => {
          exps.push({ id: doc.id, ...doc.data() } as Expense);
        });
        setGroupExpenses((prev) => ({ ...prev, [group.id]: exps }));
      }, (err) => console.error("Error loading group expenses:", err));

      // Subscribe to settlements
      const setQuery = collection(db, "groups", group.id, "settlements");
      const setUnsub = onSnapshot(setQuery, (snapshot) => {
        const sets: Settlement[] = [];
        snapshot.forEach((doc) => {
          sets.push({ id: doc.id, ...doc.data() } as Settlement);
        });
        setGroupSettlements((prev) => ({ ...prev, [group.id]: sets }));
      }, (err) => console.error("Error loading group settlements:", err));

      unsubscribes.push(expUnsub, setUnsub);
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [groups]);

  // Aggregate user's balances
  const myUid = userProfile?.uid || "";
  let globalYouOwe = 0;
  let globalYouAreOwed = 0;

  // Let's store individual group standing for rendering on group cards
  const groupStandings: Record<string, number> = {};

  groups.forEach((group) => {
    const expenses = groupExpenses[group.id] || [];
    const settlements = groupSettlements[group.id] || [];

    const { netBalances } = getSimplifiedDebts(group.memberIds, expenses, settlements);
    const myBalance = netBalances[myUid] || 0;
    groupStandings[group.id] = myBalance;

    if (myBalance < 0) {
      globalYouOwe += Math.abs(myBalance);
    } else if (myBalance > 0) {
      globalYouAreOwed += myBalance;
    }
  });

  const globalNet = Number((globalYouAreOwed - globalYouOwe).toFixed(2));

  return (
    <div id="dashboard-root" className="min-h-screen bg-slate-50 pb-16 font-sans">
      {/* Top Navbar */}
      <header id="dashboard-navbar" className="h-16 sticky top-0 z-45 bg-white border-b border-slate-200 shadow-sm">
        <div className="mx-auto h-full flex max-w-5xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-white font-bold shadow-sm">
              S
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-800">
              Splitwise <span className="text-teal-700 font-extrabold">Pro</span>
            </span>
          </div>

          <div id="user-navbar-meta" className="flex items-center gap-4">
            <div className="hidden items-center gap-2.5 md:flex text-right">
              <span className="text-xs font-semibold text-slate-700 block">
                {userProfile?.displayName}
              </span>
              <span className="text-[10px] text-slate-400 font-bold block">
                {userProfile?.email}
              </span>
            </div>
            <img
              id="user-profile-avatar"
              src={userProfile?.photoURL || "https://api.dicebear.com/7.x/initials/svg?seed=" + encodeURIComponent(userProfile?.displayName || "user")}
              alt="Avatar"
              className="h-8 w-8 rounded-full border border-slate-200 object-cover shadow-xs"
              referrerPolicy="no-referrer"
            />
            <button
              id="logout-button"
              onClick={logout}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors cursor-pointer"
              title="Logout"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        
        {/* Intro greeting */}
        <section id="greeting-section" className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">
              Welcome back, {userProfile?.displayName?.split(" ")[0]}!
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Here is your joint billing and split expenses snapshot today.
            </p>
          </div>
          <button
            id="create-group-btn"
            onClick={onOpenCreateGroup}
            className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-lg font-semibold text-xs transition-all shadow-sm active:scale-97 cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            Make a group ledger
          </button>
        </section>

        {/* Aggregate Balance Cockpit */}
        <section id="balance-section" className="mb-8 grid gap-6 grid-cols-1 md:grid-cols-3">
          {/* Net standing */}
          <div
            id="net-balance-card"
            className={`bg-white border border-slate-200 p-6 rounded-xl shadow-sm flex flex-col justify-between transition-all ${
              globalNet > 0
                ? "border-emerald-200 bg-emerald-50/20"
                : globalNet < 0
                ? "border-rose-200 bg-rose-50/20"
                : ""
            }`}
          >
            <div>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Total balance</p>
              <h2 className={`text-2xl font-bold mt-1 ${globalNet > 0 ? "text-emerald-600" : globalNet < 0 ? "text-rose-500" : "text-slate-700"}`}>
                {globalNet > 0 ? `+$${globalNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : globalNet < 0 ? `-$${Math.abs(globalNet).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "$0.00"}
              </h2>
            </div>
            <div className="mt-4 flex items-center gap-2 text-[11px] font-bold">
              {globalNet > 0 ? (
                <>
                  <Smile className="h-4 w-4 text-emerald-600" />
                  <span className="text-emerald-700">Awesome! People owe you money.</span>
                </>
              ) : globalNet < 0 ? (
                <>
                  <Frown className="h-4 w-4 text-rose-600" />
                  <span className="text-rose-700">Heads up, you have active debts.</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-teal-600" />
                  <span className="text-teal-700">Perfectly settled up!</span>
                </>
              )}
            </div>
          </div>

          {/* Owed column */}
          <div id="owed-balance-card" className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm flex justify-between items-center transition-all hover:border-slate-300">
            <div>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">You are owed</p>
              <span className="text-2xl font-bold text-emerald-600 mt-1 block">
                ${globalYouAreOwed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-600">
              <TrendingUp className="h-5 w-5 stroke-[2]" />
            </div>
          </div>

          {/* Owe column */}
          <div id="owe-balance-card" className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm flex justify-between items-center transition-all hover:border-slate-300">
            <div>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">You owe</p>
              <span className="text-2xl font-bold text-rose-500 mt-1 block">
                ${globalYouOwe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="rounded-lg bg-rose-50 p-2.5 text-rose-500">
              <TrendingDown className="h-5 w-5 stroke-[2]" />
            </div>
          </div>
        </section>

        {/* Groups Listing and Pro Tip Banner */}
        <section id="groups-list-section" className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Layers className="h-4 w-4 text-slate-400" />
              Your Split Groups
            </h3>
            <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
              {groups.length} active
            </span>
          </div>

          {groupsLoading ? (
            <div id="groups-loading" className="flex flex-col items-center justify-center p-12 text-center bg-white border border-slate-200 rounded-xl shadow-sm">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
              <p className="mt-2 text-xs text-slate-400 font-medium">Loading groups ledger...</p>
            </div>
          ) : groups.length === 0 ? (
            <div
              id="groups-empty-state"
              className="flex flex-col items-center justify-center border border-dashed border-slate-200 bg-white rounded-xl p-10 text-center"
            >
              <div className="mb-3 rounded-full bg-slate-50 p-4 text-slate-400">
                <Users className="h-6 w-6" />
              </div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">No active groups yet</h4>
              <p className="mt-1.5 text-xs text-slate-400 max-w-sm leading-relaxed">
                Splitwise Pro is best enjoyed with others. Create a group to start logging trip bills, rent checks, or shared dinner splits!
              </p>
              <button
                id="create-first-group-btn"
                onClick={onOpenCreateGroup}
                className="mt-4 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-xs"
              >
                Create your first group
              </button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-3 items-start">
              {/* Groups grid takes 2/3 space on large displays, Pro Tip takes 1/3 */}
              <div id="groups-grid" className="md:col-span-2 grid gap-4 sm:grid-cols-2">
                {groups.map((group) => {
                  const balance = groupStandings[group.id] || 0;
                  
                  return (
                    <motion.div
                      key={group.id}
                      id={`group-card-${group.id}`}
                      whileHover={{ scale: 1.01, y: -2 }}
                      className="group relative flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:shadow-md transition-all cursor-pointer"
                      onClick={() => onSelectGroup(group.id)}
                    >
                      <div>
                        <div className="flex items-start justify-between">
                          <span className="inline-flex items-center gap-1 rounded bg-slate-50 px-2 py-0.5 text-[9px] font-bold text-slate-500 uppercase tracking-wide border border-slate-100">
                            {group.memberIds.length} members
                          </span>
                          
                          {/* Interactive balance badge */}
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                              balance > 0
                                ? "bg-teal-50 text-teal-700 border-teal-200"
                                : balance < 0
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-slate-50 text-slate-500 border-slate-100"
                            }`}
                          >
                            {balance > 0
                              ? `+$${balance.toFixed(2)}`
                              : balance < 0
                              ? `-$${Math.abs(balance).toFixed(2)}`
                              : "Settled"}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-slate-800 mt-4 group-hover:text-teal-650 transition-colors">
                          {group.name}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          {group.description || "No billing description specified."}
                        </p>
                      </div>

                      <div className="mt-5 flex items-center justify-between border-t border-slate-50 pt-3">
                        {/* Member list preview dots */}
                        <div className="flex -space-x-1.5 overflow-hidden">
                          {group.memberIds.slice(0, 5).map((mId) => {
                            const mProfile = users[mId];
                            return (
                              <img
                                key={mId}
                                src={mProfile?.photoURL || "https://api.dicebear.com/7.x/initials/svg?seed=" + encodeURIComponent(mId)}
                                alt={mProfile?.displayName || "User"}
                                className="inline-block h-6 w-6 rounded-full ring-2 ring-white object-cover border border-slate-100"
                                title={mProfile?.displayName || "User"}
                              />
                            );
                          })}
                          {group.memberIds.length > 5 && (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 ring-2 ring-white text-[9px] font-bold text-slate-500">
                              +{group.memberIds.length - 5}
                            </div>
                          )}
                        </div>

                        <span className="flex items-center gap-1 text-[11px] font-bold text-teal-600 group-hover:underline">
                          Open ledger
                          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Side Pro Tip Widget matching mockup */}
              <div className="space-y-4">
                <div className="bg-teal-700 rounded-xl p-5 text-white shadow-md relative overflow-hidden">
                  <div className="relative z-10">
                    <p className="text-[10px] font-bold text-teal-200 uppercase tracking-widest mb-1">Pro Tip</p>
                    <h4 className="font-bold mb-2 text-sm">Simplify Ledger Debts</h4>
                    <p className="text-xs text-teal-100 opacity-90 leading-relaxed">
                      Splitwise Pro runs an integrated greedy debt minimizer algorithm to calculate the absolute smallest pool of cash transfers required to settle up your entire billing group roster.
                    </p>
                    <button 
                      onClick={onOpenCreateGroup}
                      className="mt-4 bg-white text-teal-800 hover:bg-teal-50 px-3.5 py-2 rounded text-xs font-bold transition-all cursor-pointer"
                    >
                      Audit Group Roster
                    </button>
                  </div>
                  <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-teal-600 rounded-full opacity-40"></div>
                </div>

                <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm text-center">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">Active Server Nodes</span>
                  <div className="flex items-center justify-center gap-1.5 mt-2.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-xs font-bold text-slate-700">Firestore Real-time Hub Connected</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
