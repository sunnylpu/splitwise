import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { UserProfile } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { X, Users, Mail, Plus, Trash2, Milestone } from "lucide-react";

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ isOpen, onClose }) => {
  const { userProfile, users } = useApp();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [memberEmails, setMemberEmails] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleAddEmail = (e: React.FormEvent) => {
    e.preventDefault();
    const email = emailInput.trim().toLowerCase();
    if (!email) return;

    // Direct simple email check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please input a valid email address structure.");
      return;
    }

    if (userProfile?.email.toLowerCase() === email) {
      setError("You are automatically added as the group creator.");
      return;
    }

    if (memberEmails.includes(email)) {
      setError("This email is already in the invite list.");
      return;
    }

    setMemberEmails((prev) => [...prev, email]);
    setEmailInput("");
    setError(null);
  };

  const handleRemoveEmail = (idx: number) => {
    setMemberEmails((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const groupName = name.trim();
    if (!groupName) {
      setError("A group name is strictly required.");
      return;
    }

    if (!userProfile) {
      setError("You must be logged in to create a group.");
      return;
    }

    setSubmitting(true);

    try {
      // 1. Gather all unique emails (Creator + Invites)
      const allEmails = Array.from(
        new Set([userProfile.email.toLowerCase(), ...memberEmails.map((em) => em.toLowerCase())])
      );

      // 2. Map existing user profile IDs by scanning users lookup dictionary
      const allIds: string[] = [userProfile.uid];
      for (const email of allEmails) {
        const foundUser = (Object.values(users) as UserProfile[]).find(
          (u) => u.email.toLowerCase() === email
        );
        if (foundUser && !allIds.includes(foundUser.uid)) {
          allIds.push(foundUser.uid);
        }
      }

      // 3. Write group document to Firestore
      const groupData = {
        name: groupName,
        description: description.trim(),
        createdById: userProfile.uid,
        memberIds: allIds,
        memberEmails: allEmails,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "groups"), groupData);
      
      // Cleanup states
      setName("");
      setDescription("");
      setMemberEmails([]);
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "groups");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="create-group-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
    >
      <motion.div
        id="create-group-card"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-100"
      >
        <div id="modal-heading-row" className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-600" />
            <h2 className="text-xl font-bold text-slate-800">Create New Group</h2>
          </div>
          <button
            id="close-modal-button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div id="modal-error-message" className="mb-4 rounded-xl bg-orange-50 p-3 text-xs font-medium text-orange-700">
            {error}
          </div>
        )}

        <form id="create-group-form" onSubmit={handleSubmit} className="space-y-4">
          {/* Group Name & Desc */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Group Title
            </label>
            <input
              id="input-group-name"
              type="text"
              required
              placeholder="e.g. Skiing Weekend, Shared Apartment"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Brief Description (Optional)
            </label>
            <textarea
              id="input-group-desc"
              rows={2}
              placeholder="What are these bills related to?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Members invite system */}
          <div className="border-t border-slate-100 pt-4">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Invite Members by Email (Excluding yourself)
            </label>
            
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
                <input
                  id="invite-email-input"
                  type="text"
                  placeholder="friend@email.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <button
                id="add-email-btn"
                type="button"
                onClick={handleAddEmail}
                className="flex items-center justify-center rounded-xl bg-slate-900 px-4 text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>

            {/* Invited email chips */}
            <div id="invited-emails-scroll" className="mt-3 max-h-32 overflow-y-auto space-y-2">
              {memberEmails.length === 0 ? (
                <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">
                  <Milestone className="h-4 w-4 shrink-0 text-slate-400" />
                  <span>No separate member invites built yet. Only you in the group currently.</span>
                </div>
              ) : (
                <AnimatePresence>
                  {memberEmails.map((email, idx) => (
                    <motion.div
                      key={email}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2 border border-slate-100"
                    >
                      <span className="text-xs font-semibold text-slate-700">{email}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveEmail(idx)}
                        className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>

          {/* Action Row */}
          <div id="modal-submit-row" className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              id="cancel-create-btn"
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 border border-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="submit-create-btn"
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-all shadow-md shadow-emerald-600/10 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Processing..." : "Create Group"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
