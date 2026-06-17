import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, Clock, User, Trophy, X, Search, Ban, Car, Wrench, Flag, CalendarDays } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
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
  const [timeframe, setTimeframe] = useState('all'); // 'all' | 'week'
  
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
    
    // Fetch all documents
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

  const filteredInfractions = useMemo(() => {
    if (timeframe === 'all') return infractions;
    
    // Calculate start of current week (Sunday 12:00 AM)
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    return infractions.filter(inf => {
      // Local optimistic writes don't have a timestamp immediately, count them as current
      if (!inf.timestamp) return true;
      return inf.timestamp.toDate() >= startOfWeek;
    });
  }, [infractions, timeframe]);

  const stats = useMemo(() => {
    const initial = {
      cantCount: 0,
      dontKnowCount: 0,
      personalFoulCount: 0,
      userCounts: {}
    };

    return filteredInfractions.reduce((acc, curr) => {
      if (curr.type === "Can't") acc.cantCount++;
      if (curr.type === "Don't Know") acc.dontKnowCount++;
      if (curr.type === "Personal Foul") acc.personalFoulCount++;
      
      if (curr.userName) {
        acc.userCounts[curr.userName] = (acc.userCounts[curr.userName] || 0) + 1;
      }
      return acc;
    }, initial);
  }, [filteredInfractions]);

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
          <div className="w-12 h-12 border-4 border-slate-800 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-slate-500 font-medium">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isJoined) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-slate-800">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
          <div className="flex justify-center mb-6">
            <div className="bg-slate-100 p-4 rounded-full border border-slate-200 shadow-inner">
              <Car className="w-12 h-12 text-slate-700" />
            </div>
          </div>
          <h1 className="text-2xl font-black text-center mb-2 tracking-tight">Service Accountability</h1>
          <p className="text-center text-slate-500 mb-8">
            The Swear Jar for "Can't", "Don't Know", and Personal Fouls.
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
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-800 focus:border-slate-800 outline-none transition-all"
                placeholder="e.g., Jane Doe"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-slate-900 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-800 transition-colors shadow-md"
            >
              Start Your Shift
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
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="bg-slate-100 p-2 rounded-lg border border-slate-200">
              <Car className="w-6 h-6 text-slate-700" />
            </div>
            <h1 className="text-xl font-black tracking-tight">The Swear Jar</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                onClick={() => setTimeframe('week')}
                className={`px-3 py-1.5 text-sm font-bold rounded-md transition-all ${
                  timeframe === 'week' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                This Week
              </button>
              <button
                onClick={() => setTimeframe('all')}
                className={`px-3 py-1.5 text-sm font-bold rounded-md transition-all ${
                  timeframe === 'all' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                All Time
              </button>
            </div>
            <div className="hidden sm:flex items-center space-x-2 text-sm font-medium bg-slate-100 py-1.5 px-3 rounded-full border border-slate-200">
              <User className="w-4 h-4 text-slate-500" />
              <span>{userName}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-8 space-y-8">
        
        {/* Action Buttons */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <p className="text-slate-500 mt-2 text-sm font-medium">Logged a failure to find an alternative.</p>
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
              <span className="text-sm font-bold text-blue-500 tracking-wider uppercase mb-1 block">Deer in headlights</span>
              <h2 className="text-2xl font-black text-slate-900">I said "Don't Know"</h2>
              <p className="text-slate-500 mt-2 text-sm font-medium">Logged a failure to investigate first.</p>
            </div>
          </button>

          <button 
            onClick={() => openLogModal("Personal Foul")}
            className="group relative bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-amber-300 transition-all text-left overflow-hidden"
          >
            <div className="absolute top-0 right-0 -mr-4 -mt-4 bg-amber-50 rounded-full p-8 transition-transform group-hover:scale-110">
              <Flag className="w-12 h-12 text-amber-200" />
            </div>
            <div className="relative z-10">
              <span className="text-sm font-bold text-amber-500 tracking-wider uppercase mb-1 block">My Bad</span>
              <h2 className="text-2xl font-black text-slate-900">Personal Foul</h2>
              <p className="text-slate-500 mt-2 text-sm font-medium">Hold yourself accountable for a mistake.</p>
            </div>
          </button>
        </section>

        {/* Stats Row */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 text-center flex flex-col justify-center">
            <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Total "Can'ts"</p>
            <p className="text-3xl font-black text-slate-800">{stats.cantCount}</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 text-center flex flex-col justify-center">
            <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Total "Don't Knows"</p>
            <p className="text-3xl font-black text-slate-800">{stats.dontKnowCount}</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 text-center flex flex-col justify-center">
            <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Personal Fouls</p>
            <p className="text-3xl font-black text-slate-800">{stats.personalFoulCount}</p>
          </div>
          <div className="bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-800 flex flex-col items-center justify-center text-white relative overflow-hidden">
            <Trophy className="absolute -right-4 -bottom-4 w-24 h-24 text-slate-800 opacity-50" />
            <p className="text-[10px] sm:text-xs text-amber-400 font-bold uppercase tracking-wider mb-1 flex items-center relative z-10">
              Top Offender
            </p>
            {topOffender ? (
              <div className="relative z-10 text-center w-full">
                <p className="text-lg font-bold truncate w-full" title={topOffender[0]}>
                  {topOffender[0]}
                </p>
                <p className="text-sm font-medium text-slate-400">{topOffender[1]} total</p>
              </div>
            ) : (
              <p className="text-lg font-medium text-slate-500 relative z-10">None yet</p>
            )}
          </div>
        </section>

        {/* Activity Feed */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col" style={{ maxHeight: '600px' }}>
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 z-10">
            <h3 className="font-bold text-slate-800 flex items-center">
              <Clock className="w-5 h-5 mr-2 text-slate-500" />
              Activity Feed
            </h3>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider bg-white px-2 py-1 rounded border border-slate-200">
              {timeframe === 'week' ? 'This Week' : 'All Time'}
            </span>
          </div>
          <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
            {filteredInfractions.length === 0 ? (
              <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                <Wrench className="w-12 h-12 text-slate-300 mb-3" />
                <p className="font-medium">No infractions found for this timeframe.</p>
                <p className="text-sm text-slate-400 mt-1">Everyone is performing flawlessly!</p>
              </div>
            ) : (
              filteredInfractions.map((infraction) => (
                <div key={infraction.id} className="p-6 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shadow-inner flex-shrink-0
                        ${infraction.type === "Can't" ? 'bg-red-100 text-red-600' : 
                          infraction.type === "Personal Foul" ? 'bg-amber-100 text-amber-600' : 
                          'bg-blue-100 text-blue-600'}`}>
                        {infraction.userName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-slate-900 font-medium">
                          {infraction.userName}{' '}
                          <span className="text-slate-500 font-normal">said / committed</span>{' '}
                          <span className={`font-bold ${
                            infraction.type === "Can't" ? 'text-red-600' : 
                            infraction.type === "Personal Foul" ? 'text-amber-600' : 
                            'text-blue-600'}`}>
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
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 flex items-center">
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
              
              {selectedType === "Personal Foul" && (
                <div className="bg-amber-50 border border-amber-100 text-amber-800 p-4 rounded-xl mb-6 text-sm font-medium flex items-start">
                  <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0 text-amber-500" />
                  <p>This is for your personal accountability. You can add your infraction details in the notes or leave it blank—it's up to you!</p>
                </div>
              )}

              <div className="mb-6">
                <label htmlFor="notes" className="block text-sm font-semibold text-slate-700 mb-2">
                  Context / Notes (Optional)
                </label>
                <textarea
                  id="notes"
                  rows="4"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-slate-800 focus:border-slate-800 outline-none resize-none transition-all text-sm shadow-sm"
                  placeholder={selectedType === "Personal Foul" ? "What happened?" : "What was the customer asking about?"}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                ></textarea>
              </div>
              
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`flex-1 px-4 py-3 rounded-xl text-white font-bold shadow-md transition-colors
                    ${selectedType === "Can't" ? 'bg-red-500 hover:bg-red-600' : 
                      selectedType === "Personal Foul" ? 'bg-amber-500 hover:bg-amber-600' : 
                      'bg-blue-500 hover:bg-blue-600'}
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
