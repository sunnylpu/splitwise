import React, { useState, useEffect, useRef } from "react";
import { useApp } from "../context/AppContext";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Message, Expense } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { Send, X, Milestone, MessageSquare } from "lucide-react";

interface ExpenseChatProps {
  groupId: string;
  expense: Expense;
  onClose: () => void;
}

export const ExpenseChat: React.FC<ExpenseChatProps> = ({ groupId, expense, onClose }) => {
  const { userProfile } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Synchronise messages list in real-time
  useEffect(() => {
    setLoading(true);
    const messagesRef = collection(
      db,
      "groups",
      groupId,
      "expenses",
      expense.id,
      "messages"
    );
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs: Message[] = [];
        snapshot.forEach((doc) => {
          msgs.push({ id: doc.id, ...doc.data() } as Message);
        });
        setMessages(msgs);
        setLoading(false);
        // Scroll to bottom
        setTimeout(() => {
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `groups/${groupId}/expenses/${expense.id}/messages`);
      }
    );

    return () => unsubscribe();
  }, [groupId, expense]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = text.trim();
    if (!cleanText || !userProfile) return;

    setText("");

    try {
      const messagesRef = collection(
        db,
        "groups",
        groupId,
        "expenses",
        expense.id,
        "messages"
      );

      const payload = {
        senderId: userProfile.uid,
        senderName: userProfile.displayName,
        senderPhoto: userProfile.photoURL,
        text: cleanText,
        createdAt: serverTimestamp(),
      };

      await addDoc(messagesRef, payload);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `groups/${groupId}/expenses/${expense.id}/messages`);
    }
  };

  return (
    <div
      id={`chat-drawer-${expense.id}`}
      className="flex flex-col h-full bg-white border-l border-slate-100 w-full"
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <MessageSquare className="h-4.5 w-4.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 line-clamp-1">
              Discuss: {expense.description}
            </h4>
            <p className="text-[10px] text-slate-400 font-semibold">
              Split: ${expense.amount.toFixed(2)}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-150 hover:text-slate-600 transition-colors cursor-pointer"
        >
          <X className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[500px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            <span className="text-[10px] text-slate-400 font-medium mt-1">Connecting thread...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center p-4">
            <div className="rounded-full bg-slate-100 p-3 text-slate-400 mb-2">
              <MessageSquare className="h-5 w-5" />
            </div>
            <h5 className="text-xs font-bold text-slate-700">Audit Chat Active</h5>
            <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
              Discuss splits, add confirmation comments, or settlement references here.
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((m) => {
              const isMe = m.senderId === userProfile?.uid;
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-start gap-2.5 max-w-[85%] ${
                    isMe ? "ml-auto flex-row-reverse" : "mr-auto"
                  }`}
                >
                  <img
                    src={m.senderPhoto || "https://api.dicebear.com/7.x/initials/svg?seed=user"}
                    alt="avatar"
                    className="h-6.5 w-6.5 rounded-full object-cover ring-1 ring-slate-100"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    {!isMe && (
                      <span className="text-[10px] font-bold text-slate-500 block mb-0.5 ml-1">
                        {m.senderName}
                      </span>
                    )}
                    <div
                      className={`rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                        isMe
                          ? "bg-slate-900 text-white rounded-br-none"
                          : "bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200/40"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Action Form */}
      <form onSubmit={handleSend} className="p-3 border-t border-slate-100 flex gap-2">
        <input
          type="text"
          placeholder="Send text..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 transition-colors disabled:opacity-40 shrink-0 cursor-pointer"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
};
