import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, Clock, User, Trophy, X, Search, Ban, Car, Wrench, Flag, MessageSquare, Send, BarChart3, Medal, Info } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, updateDoc, arrayUnion, onSnapshot, serverTimestamp } from 'firebase/firestore';

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

const PREDEFINED_TAUNTS = [
  "Rookie mistake!",
  "Read the manual!",
  "Skill issue.",
  "Needs more coffee ☕",
  "Did you try turning it off and on?"
];

const ACTION_PHRASES = [
  "got busted for a",
  "was caught red-handed with a",
  "failed spectacularly with a",
  "blundered into a",
  "faceplanted while attempting a",
  "dropped the ball on a",
  "took a massive L with a",
  "was exposed for a",
  "hit a brick wall and logged a",
  "fumbled the bag with a",
  "awkwardly confessed to a",
  "threw in the towel and took a",
  "shamelessly admitted to a",
  "completely whiffed on a",
  "pressed the panic button for a",
  "waved the white flag with a",
  "earned a spot on the wall of shame for a",
  "accidentally leaked a",
  "tripped over their own shoelaces and got a",
  "short-circuited and registered a",
  "gave up the ghost and logged a",
  "folded under pressure and took a",
  "totally blanked and earned a",
  "took the easy way out with a",
  "threw their hands up and claimed a",
  "crashed and burned with a",
  "got caught slacking with a",
  "checked out early with a",
  "completely derailed with a",
  "had a brain malfunction resulting in a",
  "got caught sleepwalking into a",
  "proudly announced their",
  "humbly accepted defeat via a",
  "took a nosedive straight into a",
  "reluctantly coughed up a",
  "got completely stumped and logged a",
  "threw a Hail Mary but still got a",
  "hit the eject button and took a",
  "surrendered their pride for a",
  "got lost in the sauce and logged a",
  "fessed up to a terrible",
  "let down the entire team with a",
  "needs a reboot after a",
  "got publicly shamed for a",
  "confidently walked right into a",
  "somehow managed to get a",
  "completely choked and logged a",
  "needs to read the manual after a",
  "was completely bamboozled into a",
  "ran out of brain cells and took a"
];

const getActionPhrase = (id) => {
  if (!id) return ACTION_PHRASES[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ACTION_PHRASES[Math.abs(hash) % ACTION_PHRASES.length];
};

export default function SwearJarApp() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [infractions, setInfractions] = useState([]);
  const [timeframe, setTimeframe] = useState('all'); // 'all' | 'month' | 'week' | 'day'
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [selectedType, setSelectedType] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Taunt state
  const [activeTauntId, setActiveTauntId] = useState(null);
  const [customTaunt, setCustomTaunt] = useState('');

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
    
    const now = new Date();
    let startDate = new Date(now);
    
    if (timeframe === 'month') {
      startDate.setDate(1);
    } else if (timeframe === 'week') {
      // Calculate start of current week (Monday 12:00 AM)
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startDate.setDate(now.getDate() - diffToMonday);
    }
    
    startDate.setHours(0, 0, 0, 0);

    return infractions.filter(inf => {
      // Local optimistic writes don't have a timestamp immediately, count them as current
      if (!inf.timestamp) return true;
      return inf.timestamp.toDate() >= startDate;
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

  const topOffenders = useMemo(() => {
    if (Object.keys(stats.userCounts).length === 0) return null;
    
    const maxScore = Math.max(...Object.values(stats.userCounts));
    const leaders = Object.entries(stats.userCounts)
      .filter(([_, count]) => count === maxScore)
      .map(([name]) => name);
      
    return {
      names: leaders,
      score: maxScore
    };
  }, [stats.userCounts]);

  const comprehensiveAnalytics = useMemo(() => {
    const total = filteredInfractions.length;
    const cantPct = total ? Math.round((stats.cantCount / total) * 100) : 0;
    const dontKnowPct = total ? Math.round((stats.dontKnowCount / total) * 100) : 0;
    const foulPct = total ? Math.round((stats.personalFoulCount / total) * 100) : 0;

    const userStats = {};
    const tauntStats = {};

    filteredInfractions.forEach(inf => {
      const name = inf.userName;
      if (!userStats[name]) userStats[name] = { cant: 0, dontKnow: 0, foul: 0, total: 0 };
      
      if (inf.type === "Can't") userStats[name].cant++;
      if (inf.type === "Don't Know") userStats[name].dontKnow++;
      if (inf.type === "Personal Foul") userStats[name].foul++;
      userStats[name].total++;

      if (inf.taunts) {
        inf.taunts.forEach(taunt => {
          const tName = taunt.userName;
          tauntStats[tName] = (tauntStats[tName] || 0) + 1;
        });
      }
    });

    const getWinner = (metricFn) => {
      let winner = null;
      let max = 0;
      Object.keys(userStats).forEach(name => {
        const score = metricFn(userStats[name]);
        if (score > max) {
          max = score;
          winner = name;
        } else if (score === max && score > 0) {
          winner = winner ? `${winner}, ${name}` : name;
        }
      });
      return { winner, score: max };
    };

    const brickWall = getWinner(u => u.cant);
    const deer = getWinner(u => u.dontKnow);
    const honestAbe = getWinner(u => u.foul);

    let topHeckler = null;
    let maxTaunts = 0;
    Object.keys(tauntStats).forEach(name => {
      if (tauntStats[name] > maxTaunts) {
        maxTaunts = tauntStats[name];
        topHeckler = name;
      } else if (tauntStats[name] === maxTaunts && maxTaunts > 0) {
        topHeckler += `, ${name}`;
      }
    });

    return {
      total,
      cantPct,
      dontKnowPct,
      foulPct,
      brickWall,
      deer,
      honestAbe,
      heckler: { winner: topHeckler, score: maxTaunts }
    };
  }, [filteredInfractions, stats]);

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
        taunts: [], // Initialize empty taunts array
        timestamp: serverTimestamp()
      });
      setIsModalOpen(false);
    } catch (error) {
      console.error("Failed to log infraction:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitTaunt = async (infractionId, text) => {
    if (!text.trim() || !user) return;
    
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'infractions', infractionId);
      await updateDoc(docRef, {
        taunts: arrayUnion({
          userId: user.uid,
          userName: userName,
          text: text.trim(),
          timestamp: Date.now() // Local timestamp for simple sorting/display
        })
      });
      setCustomTaunt('');
      setActiveTauntId(null);
    } catch (error) {
      console.error("Failed to post taunt:", error);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
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
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm flex-shrink-0">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="bg-slate-100 p-2 rounded-lg border border-slate-200">
              <Car className="w-6 h-6 text-slate-700" />
            </div>
            <h1 className="text-xl font-black tracking-tight">The Swear Jar</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 overflow-x-auto hide-scrollbar">
              <button
                onClick={() => setTimeframe('day')}
                className={`px-3 py-1.5 text-xs sm:text-sm font-bold rounded-md transition-all whitespace-nowrap ${
                  timeframe === 'day' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setTimeframe('week')}
                className={`px-3 py-1.5 text-xs sm:text-sm font-bold rounded-md transition-all whitespace-nowrap ${
                  timeframe === 'week' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                This Week
              </button>
              <button
                onClick={() => setTimeframe('month')}
                className={`px-3 py-1.5 text-xs sm:text-sm font-bold rounded-md transition-all whitespace-nowrap ${
                  timeframe === 'month' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                This Month
              </button>
              <button
                onClick={() => setTimeframe('all')}
                className={`px-3 py-1.5 text-xs sm:text-sm font-bold rounded-md transition-all whitespace-nowrap ${
                  timeframe === 'all' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                All Time
              </button>
            </div>
            
            <button
              onClick={() => setIsAnalyticsOpen(true)}
              className="flex items-center space-x-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 py-1.5 px-3 rounded-lg text-sm font-bold transition-colors shadow-sm whitespace-nowrap"
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Analytics</span>
            </button>
            
            <div className="hidden sm:flex items-center space-x-2 text-sm font-medium bg-slate-100 py-1.5 px-3 rounded-full border border-slate-200">
              <User className="w-4 h-4 text-slate-500" />
              <span>{userName}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-8 space-y-8 flex-1 w-full">
        
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
              <p className="text-slate-500 mt-2 text-sm font-medium">"You can do it Bobby Boucher!"</p>
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
              <p className="text-slate-500 mt-2 text-sm font-medium">"Hold on, let me consult the Magic 8-Ball..."</p>
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
              <p className="text-slate-500 mt-2 text-sm font-medium">Hold yourself accountable. (Spill the juicy details, or take it to the grave!)</p>
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
            {topOffenders ? (
              <div className="relative z-10 text-center w-full">
                <p className="text-lg font-bold truncate w-full" title={topOffenders.names.join(', ')}>
                  {topOffenders.names.length > 1 ? `Tied: ${topOffenders.names.join(', ')}` : topOffenders.names[0]}
                </p>
                <p className="text-sm font-medium text-slate-400">{topOffenders.score} total</p>
              </div>
            ) : (
              <p className="text-lg font-medium text-slate-500 relative z-10">None yet</p>
            )}
          </div>
        </section>

        {/* Activity Feed */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col" style={{ maxHeight: '800px' }}>
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 z-10 rounded-t-2xl">
            <h3 className="font-bold text-slate-800 flex items-center">
              <Clock className="w-5 h-5 mr-2 text-slate-500" />
              Activity Feed
            </h3>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider bg-white px-2 py-1 rounded border border-slate-200">
              {timeframe === 'day' ? 'Today' : timeframe === 'week' ? 'This Week' : timeframe === 'month' ? 'This Month' : 'All Time'}
            </span>
          </div>
          <div className="divide-y divide-slate-100 overflow-y-auto flex-1 p-2 sm:p-0">
            {filteredInfractions.length === 0 ? (
              <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                <Wrench className="w-12 h-12 text-slate-300 mb-3" />
                <p className="font-medium">No infractions found for this timeframe.</p>
                <p className="text-sm text-slate-400 mt-1">Everyone is performing flawlessly!</p>
              </div>
            ) : (
              filteredInfractions.map((infraction) => (
                <div key={infraction.id} className="p-4 sm:p-6 hover:bg-slate-50 transition-colors flex flex-col">
                  {/* Main Infraction Info */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 w-full">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shadow-inner flex-shrink-0 mt-1
                        ${infraction.type === "Can't" ? 'bg-red-100 text-red-600' : 
                          infraction.type === "Personal Foul" ? 'bg-amber-100 text-amber-600' : 
                          'bg-blue-100 text-blue-600'}`}>
                        {infraction.userName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="text-slate-900 font-medium">
                          {infraction.userName}{' '}
                          <span className="text-slate-500 font-normal">{getActionPhrase(infraction.id)}</span>{' '}
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
                        
                        {infraction.notes && (
                          <div className="mt-2 pl-3 border-l-2 border-slate-200">
                            <p className="text-sm text-slate-600 italic">"{infraction.notes}"</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Taunts Display */}
                  {infraction.taunts && infraction.taunts.length > 0 && (
                    <div className="mt-4 ml-13 space-y-2">
                      {infraction.taunts.map((taunt, idx) => (
                        <div key={idx} className="bg-white border border-slate-100 shadow-sm rounded-lg p-3 text-sm flex items-start space-x-2">
                          <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {taunt.userName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-700 mr-2">{taunt.userName}</span>
                            <span className="text-slate-600">{taunt.text}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Taunt Actions (No Self Taunting & Max 1 Taunt Per User) */}
                  {user && infraction.userId !== user.uid && !infraction.taunts?.some(t => t.userId === user.uid) && (
                    <div className="mt-3 ml-13">
                      {activeTauntId === infraction.id ? (
                        <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 animate-in fade-in slide-in-from-top-2">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Quick Taunt</p>
                          <div className="flex flex-wrap gap-2 mb-3">
                            {PREDEFINED_TAUNTS.map(taunt => (
                              <button
                                key={taunt}
                                onClick={() => submitTaunt(infraction.id, taunt)}
                                className="bg-white border border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-slate-700 text-xs font-medium py-1.5 px-3 rounded-full transition-colors shadow-sm"
                              >
                                {taunt}
                              </button>
                            ))}
                          </div>
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Or write your own</p>
                          <div className="flex space-x-2">
                            <input
                              type="text"
                              value={customTaunt}
                              onChange={(e) => setCustomTaunt(e.target.value)}
                              placeholder="Type a custom taunt..."
                              className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500 outline-none"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') submitTaunt(infraction.id, customTaunt);
                              }}
                            />
                            <button
                              onClick={() => submitTaunt(infraction.id, customTaunt)}
                              disabled={!customTaunt.trim()}
                              className="bg-slate-800 hover:bg-slate-900 text-white p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          </div>
                          <button 
                            onClick={() => setActiveTauntId(null)}
                            className="text-xs text-slate-500 hover:text-slate-700 mt-3 font-medium underline"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setActiveTauntId(infraction.id)}
                          className="flex items-center text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors py-1 px-2 -ml-2 rounded hover:bg-slate-100"
                        >
                          <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                          Taunt
                        </button>
                      )}
                    </div>
                  )}

                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Footer Terms & Conditions */}
      <footer className="mt-auto py-8 px-4 text-center text-slate-400 text-xs flex flex-col items-center opacity-70 hover:opacity-100 transition-opacity">
        <Info className="w-5 h-5 mb-2 text-slate-300" />
        <p className="font-bold uppercase tracking-widest text-slate-300 mb-1">Terms & Conditions</p>
        <p className="max-w-md">
          By participating in the Swear Jar, you acknowledge that the slate is officially wiped clean on the 1st of every month (using the "This Month" filter). Sigh a breath of relief and start fresh!
        </p>
      </footer>

      {/* Logging Modal */}
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

      {/* Analytics Modal */}
      {isAnalyticsOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 bg-indigo-50 border-b border-indigo-100">
              <h3 className="text-lg font-black text-indigo-900 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-indigo-600" />
                Comprehensive Statistics
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider bg-white px-2 py-1 rounded border border-indigo-200 shadow-sm">
                  {timeframe === 'day' ? 'Today' : timeframe === 'week' ? 'This Week' : timeframe === 'month' ? 'This Month' : 'All Time'}
                </span>
                <button 
                  onClick={() => setIsAnalyticsOpen(false)}
                  className="text-indigo-400 hover:text-indigo-600 transition-colors p-1 bg-white rounded-md border border-indigo-200 shadow-sm"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {comprehensiveAnalytics.total === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Medal className="w-16 h-16 mx-auto mb-4 text-slate-200" />
                  <p className="text-lg font-medium">No infractions recorded for this timeframe.</p>
                  <p className="text-sm">Check back later when someone messes up!</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Metric Breakdown */}
                  <div>
                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Volume Breakdown</h4>
                    <div className="flex h-6 w-full rounded-full overflow-hidden shadow-inner bg-slate-100 mb-3">
                      <div style={{ width: `${comprehensiveAnalytics.cantPct}%` }} className="bg-red-500 transition-all duration-1000"></div>
                      <div style={{ width: `${comprehensiveAnalytics.dontKnowPct}%` }} className="bg-blue-500 transition-all duration-1000"></div>
                      <div style={{ width: `${comprehensiveAnalytics.foulPct}%` }} className="bg-amber-500 transition-all duration-1000"></div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-sm font-medium">
                      <div className="text-red-600">
                        <span className="text-xs block text-slate-400 uppercase tracking-wide">Can't</span>
                        {comprehensiveAnalytics.cantPct}%
                      </div>
                      <div className="text-blue-600">
                        <span className="text-xs block text-slate-400 uppercase tracking-wide">Don't Know</span>
                        {comprehensiveAnalytics.dontKnowPct}%
                      </div>
                      <div className="text-amber-600">
                        <span className="text-xs block text-slate-400 uppercase tracking-wide">Personal Foul</span>
                        {comprehensiveAnalytics.foulPct}%
                      </div>
                    </div>
                  </div>

                  {/* Funny Awards */}
                  <div>
                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Hall of Fame (or Shame)</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      
                      {/* The Brick Wall */}
                      <div className="bg-white border border-red-100 p-4 rounded-xl shadow-sm relative overflow-hidden group">
                        <div className="absolute -right-6 -bottom-6 opacity-10 group-hover:scale-110 transition-transform">
                          <Ban className="w-24 h-24 text-red-500" />
                        </div>
                        <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-1">The Brick Wall</p>
                        <h5 className="text-lg font-black text-slate-900 mb-1">
                          {comprehensiveAnalytics.brickWall.winner || 'Nobody!'}
                        </h5>
                        <p className="text-sm text-slate-500">
                          {comprehensiveAnalytics.brickWall.score > 0 
                            ? `Logged ${comprehensiveAnalytics.brickWall.score} "Can'ts"` 
                            : 'No "Can\'ts" logged!'}
                        </p>
                      </div>

                      {/* Deer in Headlights */}
                      <div className="bg-white border border-blue-100 p-4 rounded-xl shadow-sm relative overflow-hidden group">
                        <div className="absolute -right-6 -bottom-6 opacity-10 group-hover:scale-110 transition-transform">
                          <Search className="w-24 h-24 text-blue-500" />
                        </div>
                        <p className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-1">Resident in Headlights</p>
                        <h5 className="text-lg font-black text-slate-900 mb-1">
                          {comprehensiveAnalytics.deer.winner || 'Nobody!'}
                        </h5>
                        <p className="text-sm text-slate-500">
                          {comprehensiveAnalytics.deer.score > 0 
                            ? `Logged ${comprehensiveAnalytics.deer.score} "Don't Knows"` 
                            : 'No "Don\'t Knows" logged!'}
                        </p>
                      </div>

                      {/* Honest Abe */}
                      <div className="bg-white border border-amber-100 p-4 rounded-xl shadow-sm relative overflow-hidden group">
                        <div className="absolute -right-6 -bottom-6 opacity-10 group-hover:scale-110 transition-transform">
                          <Flag className="w-24 h-24 text-amber-500" />
                        </div>
                        <p className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-1">The Honest Abe</p>
                        <h5 className="text-lg font-black text-slate-900 mb-1">
                          {comprehensiveAnalytics.honestAbe.winner || 'Nobody!'}
                        </h5>
                        <p className="text-sm text-slate-500">
                          {comprehensiveAnalytics.honestAbe.score > 0 
                            ? `Claimed ${comprehensiveAnalytics.honestAbe.score} Personal Fouls` 
                            : 'No Personal Fouls claimed!'}
                        </p>
                      </div>

                      {/* The Heckler */}
                      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm relative overflow-hidden group">
                        <div className="absolute -right-6 -bottom-6 opacity-5 group-hover:scale-110 transition-transform">
                          <MessageSquare className="w-24 h-24 text-slate-900" />
                        </div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">The Heckler</p>
                        <h5 className="text-lg font-black text-slate-900 mb-1">
                          {comprehensiveAnalytics.heckler.winner || 'Nobody!'}
                        </h5>
                        <p className="text-sm text-slate-500">
                          {comprehensiveAnalytics.heckler.score > 0 
                            ? `Dropped ${comprehensiveAnalytics.heckler.score} Taunts` 
                            : 'No Taunts dropped!'}
                        </p>
                      </div>

                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 text-center">
              <button
                onClick={() => setIsAnalyticsOpen(false)}
                className="w-full sm:w-auto bg-slate-900 text-white font-bold py-2.5 px-8 rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
              >
                Back to Feed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
