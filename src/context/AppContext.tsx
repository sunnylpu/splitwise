import React, { createContext, useContext, useState, useEffect } from "react";
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile
} from "firebase/auth";
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  onSnapshot,
  getDocs,
  serverTimestamp 
} from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "../firebase";
import { UserProfile, Group } from "../types";

interface AppContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  users: Record<string, UserProfile>; // UID -> user profile dictionary for easy rendering
  groups: Group[];
  groupsLoading: boolean;
  loginWithGoogle: () => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  reloadCurrentUser: () => Promise<void>;
  logout: () => Promise<void>;
  syncUserProfile: (user: User) => Promise<UserProfile>;
  refreshUsers: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<Record<string, UserProfile>>({});
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);

  // Sync users list to lookup profiles
  const refreshUsers = async () => {
    try {
      const snap = await getDocs(collection(db, "users"));
      const dict: Record<string, UserProfile> = {};
      snap.forEach((doc) => {
        const u = doc.data() as UserProfile;
        dict[u.uid] = u;
      });
      setUsers(dict);
    } catch (e) {
      console.error("Failed to load user list:", e);
    }
  };

  // Profile saver
  const syncUserProfile = async (user: User): Promise<UserProfile> => {
    const userDocRef = doc(db, "users", user.uid);
    try {
      const userDoc = await getDoc(userDocRef);
      const profileData: UserProfile = {
        uid: user.uid,
        email: user.email || "",
        displayName: user.displayName || user.email?.split("@")[0] || "User",
        photoURL: user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.email || "user")}`,
        createdAt: userDoc.exists() ? userDoc.data().createdAt : serverTimestamp()
      };
      
      // Update/Create user record
      await setDoc(userDocRef, profileData, { merge: true });
      setUserProfile(profileData);
      
      // Refresh user dictionary so others are displayed
      await refreshUsers();
      return profileData;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (user) {
        setCurrentUser(user);
        await syncUserProfile(user);
      } else {
        setCurrentUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Set up clean real-time listener for user's groups
  useEffect(() => {
    if (!currentUser) {
      setGroups([]);
      return;
    }

    setGroupsLoading(true);
    const q = query(
      collection(db, "groups"),
      where("memberIds", "array-contains", currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const gList: Group[] = [];
        snapshot.forEach((doc) => {
          gList.push({ id: doc.id, ...doc.data() } as Group);
        });
        
        // Sort groups by custom createdAt or name
        gList.sort((a, b) => {
          const t1 = a.createdAt?.seconds || 0;
          const t2 = b.createdAt?.seconds || 0;
          return t2 - t1; // Descending
        });
        
        setGroups(gList);
        setGroupsLoading(false);

        // Auto-refresh users to make sure we have any newly added user info
        refreshUsers();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "groups");
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Google Login popup flow
  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    // Prompt Google signin popups as recommended
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error("Popup signature auth login failed:", e);
    }
  };

  const signUpWithEmail = async (email: string, password: string, name: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      // update display name & photo with initials
      await updateProfile(user, {
        displayName: name,
        photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`
      });
      // reload user to apply profile name
      await user.reload();
      const updatedUser = auth.currentUser;
      if (updatedUser) {
        setCurrentUser(updatedUser);
        await syncUserProfile(updatedUser);
        // Dispatch verification email
        await sendEmailVerification(updatedUser);
      }
    } catch (e) {
      console.error("Sign up failed:", e);
      throw e;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      setCurrentUser(userCredential.user);
    } catch (e) {
      console.error("Sign in failed:", e);
      throw e;
    }
  };

  const sendPasswordReset = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (e) {
      console.error("Password reset link generation failed:", e);
      throw e;
    }
  };

  const resendVerificationEmail = async () => {
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
      } else {
        throw new Error("No logging session active to send verification email");
      }
    } catch (e) {
      console.error("Resending verification email failed:", e);
      throw e;
    }
  };

  const reloadCurrentUser = async () => {
    try {
      if (auth.currentUser) {
        const user = auth.currentUser;
        await user.reload();
        // Create an exact prototype clone of the user to force React state engine update
        const fakeUserClone = Object.assign(
          Object.create(Object.getPrototypeOf(user)),
          user
        );
        setCurrentUser(fakeUserClone);
      }
    } catch (e) {
      console.error("Reloading current user failed:", e);
      throw e;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Logout process failed:", e);
    }
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        users,
        groups,
        groupsLoading,
        loginWithGoogle,
        signUpWithEmail,
        signInWithEmail,
        sendPasswordReset,
        resendVerificationEmail,
        reloadCurrentUser,
        logout,
        syncUserProfile,
        refreshUsers,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be utilized inside an AppProvider wrapper");
  }
  return context;
};
