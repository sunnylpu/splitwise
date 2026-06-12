import { useState, useEffect } from "react";
import { AppProvider, useApp } from "./context/AppContext";
import { LoginScreen } from "./components/LoginScreen";
import { EmailVerificationScreen } from "./components/EmailVerificationScreen";
import { Dashboard } from "./components/Dashboard";
import { GroupDetail } from "./components/GroupDetail";
import { CreateGroupModal } from "./components/CreateGroupModal";
import { Coins, Moon, Sun } from "lucide-react";

function AppContent() {
  const { currentUser, loading } = useApp();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  // Global Loader
  if (loading) {
    return (
      <div
        id="global-loading"
        className="flex min-h-screen flex-col items-center justify-center bg-slate-50 font-sans p-6"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 mb-4 animate-bounce">
          <Coins className="h-8 w-8" />
        </div>
        <div className="h-2 w-32 bg-slate-200 rounded-full overflow-hidden relative">
          <div className="absolute top-0 left-0 bottom-0 bg-emerald-600 w-1/2 rounded-full animate-infinite-slide" />
        </div>
        <p className="mt-3 text-xs font-bold text-slate-500 uppercase tracking-widest animate-pulse">
          Starting Splitwise Ledger...
        </p>
      </div>
    );
  }

  // Auth Guard Gate
  if (!currentUser) {
    return <LoginScreen />;
  }

  // Email Verification Guard Gate
  if (!currentUser.emailVerified) {
    return <EmailVerificationScreen />;
  }

  // Primary Routing Navigation Setup
  return (
    <div id="app-view-container" className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={() => setIsDark(!isDark)}
          className="p-2 rounded-full bg-white dark:bg-slate-800 shadow-md text-slate-800 dark:text-white cursor-pointer"
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </div>

      {selectedGroupId ? (
        <GroupDetail
          groupId={selectedGroupId}
          onBack={() => setSelectedGroupId(null)}
        />
      ) : (
        <Dashboard
          onSelectGroup={(id) => setSelectedGroupId(id)}
          onOpenCreateGroup={() => setIsCreateGroupOpen(true)}
        />
      )}

      {/* Persistent overlay modals */}
      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
