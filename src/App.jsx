import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, MessageSquare, Clock, User, Trophy, Plus, X, Search, Ban } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

// Initialize Firebase using the environment-provided configuration
const firebaseConfig = {
  apiKey: "AIzaSyCjCtNqkApJGiC12KlykzzBTZ2AsOkXnwo",
  authDomain: "swear-jar-e8069.firebaseapp.com",
  projectId: "swear-jar-e8069",
  storageBucket: "swear-jar-e8069.firebasestorage.app",
  messagingSenderId: "952518136551",
  appId: "1:952518136551:web:b7bc89a067e7d5abdfc842"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "my-swear-jar-app";

export default function SwearJarApp() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [infractions, setInfractions] = useState([]);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    signInAnonymously(auth).catch(error => console.error("Authentication failed:", error));

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Strict Path: /artifacts/{appId}/public/data/{collectionName}
    const infractionsRef = collection(db, 'artifacts', appId, 'public', 'data', 'infractions');
    
    // Fetch all documents without complex queries, sorting in memory per mandatory rules
    const unsubscribe = onSnapshot(infractionsRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort descending by timestamp in memory
      data.sort((a, b) => {
        const timeA = a.timestamp?.toMillis() || 0;
        const timeB = b.timestamp?.toMillis() || 0;
        return timeB - timeA;
      });
      
      setInfractions(data);

      // Auto-recover user's name if they've logged an infraction before in this session
      if (!isJoined && data.length > 0) {
        const myLastInfraction = data.find(inf => inf.userId === user.uid);
        if (myLastInfraction && myLastInfraction.userName) {
          setUserName(myLastInfraction.userName);
          setIsJoined(true);
        }
      }

    }, (error) => {
      console.error("Error fetching infractions:", error);
    });

    return () => unsubscribe();
  }, [user, isJoined]);

  const stats = useMemo(() => {
    const initial = {
      cantCount: 0,
      dontKnowCount: 0,
      userCounts: {}
    };

    return infractions.reduce((acc, curr) => {
      if (curr.type === "Can't") acc.cantCount++;
      if (curr.type === "Don't Know") acc.dontKnowCount++;
      
      if (curr.userName) {
        acc.userCounts[curr.userName] = (acc.userCounts[curr.userName] || 0) + 1;
      }
      return acc;
    }, initial);
  }, [infractions]);

  const topOffender = useMemo(() => {
    if (Object.keys(stats.userCounts).length === 0) return null;
    return Object.entries(stats.userCounts).sort((a, b) => b[1] - a[1])[0];
  }, [stats.userCounts]);

  const handleJoin = (e) => {
    e.preventDefault();
    if (userName.trim()) {
      setIsJoined(true);
    }
  };

  const openLogModal = (type) => {
    setSelectedType(type);
    setNotes('');
    setIsModalOpen(true);
  };

  const submitInfraction = async (e) => {
    e.preventDefault();
    if (!user || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const infractionsRef = collection(db, 'artifacts', appId, 'public', 'data', 'infractions');
      await addDoc(infractionsRef, {
        userId: user.uid,
        userName: userName,
        type: selectedType,
        notes: notes.trim(),
        timestamp: serverTimestamp()
      });
      setIsModalOpen(false);
    } catch (error) {
      console.error("Failed to log infraction:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate();
    const today = new Date();
    
    const timeOptions = { hour: 'numeric', minute: '2-digit' };
    
    if (date.toDateString() === today.toDateString()) {
      return `Today at ${date.toLocaleTimeString([], timeOptions)}`;
    }
    
    const dateOptions = { month: 'short', day: 'numeric' };
    return `${date.toLocaleDateString([], dateOptions)} at ${date.toLocaleTimeString([], timeOptions)}`;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-slate-500 font-medium">Loading Jar...</p>
        </div>
      </div>
    );
  }

  if (!isJoined) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-slate-800">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
          <div className="flex justify-center mb-6">
            <div className="bg-amber-100 p-4 rounded-full">
              <AlertTriangle className="w-12 h-12 text-amber-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">The Swear Jar</h1>
          <p className="text-center text-slate-500 mb-8">
            Accountability for the words "Can't" and "I Don't Know".
          </p>
          
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2" htmlFor="name">
                Enter your display name
              </label>
              <input
                id="name"
                type="text"
                maxLength={20}
                required
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                placeholder="e.g., Jane Doe"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-slate-900 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-800 transition-colors shadow-md"
            >
              Join the Jar
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 pb-12">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
            <h1 className="text-xl font-bold tracking-tight">The Swear Jar</h1>
          </div>
          <div className="flex items-center space-x-2 text-sm font-medium bg-slate-100 py-1.5 px-3 rounded-full">
            <User className="w-4 h-4 text-slate-500" />
            <span>{userName}</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-8 space-y-8">
        
        {/* Action Buttons */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button 
            onClick={() => openLogModal("Can't")}
            className="group relative bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-red-300 transition-all text-left overflow-hidden"
          >
            <div className="absolute top-0 right-0 -mr-4 -mt-4 bg-red-50 rounded-full p-8 transition-transform group-hover:scale-110">
              <Ban className="w-12 h-12 text-red-200" />
            </div>
            <div className="relative z-10">
              <span className="text-sm font-bold text-red-500 tracking-wider uppercase mb-1 block">Oops, I did it</span>
              <h2 className="text-2xl font-black text-slate-900">I said "Can't"</h2>
              <p className="text-slate-500 mt-2 text-sm">Log a failure to find an alternative.</p>
            </div>
          </button>

          <button 
            onClick={() => openLogModal("Don't Know")}
            className="group relative bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-300 transition-all text-left overflow-hidden"
          >
            <div className="absolute top-0 right-0 -mr-4 -mt-4 bg-blue-50 rounded-full p-8 transition-transform group-hover:scale-110">
              <Search className="w-12 h-12 text-blue-200" />
            </div>
            <div className="relative z-10">
              <span className="text-sm font-bold text-blue-500 tracking-wider uppercase mb-1 block">Need to check</span>
              <h2 className="text-2xl font-black text-slate-900">I said "Don't Know"</h2>
              <p className="text-slate-500 mt-2 text-sm">Log a failure to investigate first.</p>
            </div>
          </button>
        </section>

        {/* Stats Row */}
        <section className="grid grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 text-center">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Total "Can'ts"</p>
            <p className="text-3xl font-black text-slate-800">{stats.cantCount}</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 text-center">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Total "Don't Knows"</p>
            <p className="text-3xl font-black text-slate-800">{stats.dontKnowCount}</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1 flex items-center">
              <Trophy className="w-3 h-3 mr-1 text-amber-500" />
              Top Offender
            </p>
            {topOffender ? (
              <p className="text-lg font-bold text-slate-800 truncate w-full text-center" title={topOffender[0]}>
                {topOffender[0]} <span className="text-sm font-normal text-slate-500">({topOffender[1]})</span>
              </p>
            ) : (
              <p className="text-lg font-medium text-slate-400">None yet</p>
            )}
          </div>
        </section>

        {/* Activity Feed */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
            <h3 className="font-bold text-slate-800 flex items-center">
              <Clock className="w-5 h-5 mr-2 text-slate-500" />
              Recent Infractions
            </h3>
          </div>
          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
            {infractions.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <p>No infractions yet. Keep up the good work!</p>
              </div>
            ) : (
              infractions.map((infraction) => (
                <div key={infraction.id} className="p-6 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shadow-inner
                        ${infraction.type === "Can't" ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                        {infraction.userName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-slate-900 font-medium">
                          {infraction.userName}{' '}
                          <span className="text-slate-500 font-normal">said</span>{' '}
                          <span className={`font-bold ${infraction.type === "Can't" ? 'text-red-600' : 'text-blue-600'}`}>
                            "{infraction.type}"
                          </span>
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {formatDate(infraction.timestamp)}
                        </p>
                      </div>
                    </div>
                  </div>
                  {infraction.notes && (
                    <div className="mt-3 ml-13 pl-4 border-l-2 border-slate-200">
                      <p className="text-sm text-slate-600 italic">"{infraction.notes}"</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">
                Logging a "{selectedType}"
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={submitInfraction} className="p-6">
              <div className="mb-6">
                <label htmlFor="notes" className="block text-sm font-semibold text-slate-700 mb-2">
                  Context / Notes (Optional)
                </label>
                <textarea
                  id="notes"
                  rows="3"
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none resize-none transition-all text-sm"
                  placeholder="What was the customer asking about?"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                ></textarea>
              </div>
              
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-white font-bold shadow-md transition-colors
                    ${selectedType === "Can't" ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}
                    ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isSubmitting ? 'Logging...' : 'Confess!'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
