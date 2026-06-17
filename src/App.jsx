import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, Clock, User, Trophy, X, Search, Ban, Car, Wrench, Flag, MessageSquare, Send, BarChart3, Medal, Info, Scale, CheckCircle2, Gavel } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, updateDoc, arrayUnion, arrayRemove, onSnapshot, serverTimestamp } from 'firebase/firestore';

// Initialize Firebase
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
  "got busted for a", "was caught red-handed with a", "failed spectacularly with a", "blundered into a",
  "faceplanted while attempting a", "dropped the ball on a", "took a massive L with a", "was exposed for a",
  "hit a brick wall and logged a", "fumbled the bag with a", "awkwardly confessed to a", "threw in the towel and took a",
  "shamelessly admitted to a", "completely whiffed on a", "pressed the panic button for a", "waved the white flag with a",
  "earned a spot on the wall of shame for a", "accidentally leaked a", "tripped over their own shoelaces and got a",
  "short-circuited and registered a", "gave up the ghost and logged a", "folded under pressure and took a",
  "totally blanked and earned a", "took the easy way out with a", "threw their hands up and claimed a",
  "crashed and burned with a", "got caught slacking with a", "checked out early with a", "completely derailed with a",
  "had a brain malfunction resulting in a", "got caught sleepwalking into a", "proudly announced their",
  "humbly accepted defeat via a", "took a nosedive straight into a", "reluctantly coughed up a",
  "got completely stumped and logged a", "threw a Hail Mary but still got a", "hit the eject button and took a",
  "surrendered their pride for a", "got lost in the sauce and logged a", "fessed up to a terrible",
  "let down the entire team with a", "needs a reboot after a", "got publicly shamed for a",
  "confidently walked right into a", "somehow managed to get a", "completely choked and logged a",
  "needs to read the manual after a", "was completely bamboozled into a", "ran out of brain cells and took a"
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
  const [punishments, setPunishments] = useState([]);
  
  const [timeframe, setTimeframe] = useState('all');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isJudgmentOpen, setIsJudgmentOpen] = useState(false);
  
  const [selectedType, setSelectedType] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [activeTauntId, setActiveTauntId] = useState(null);
  const [customTaunt, setCustomTaunt] = useState('');
  const [newPunishment, setNewPunishment] = useState('');

  // ----------------------------------------------------
  // Judgment Timing Logic
  // ----------------------------------------------------
  const today = new Date();
  const currentDate = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  // Voting is open from the 28th of the month to the 3rd of the new month
  const isVotingOpen = currentDate >= 28 || currentDate <= 3;
  
  let targetMonth, targetYear, monthName;
  if (currentDate <= 3) {
    targetMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    targetYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  } else {
    targetMonth = currentMonth;
    targetYear = currentYear;
  }

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  monthName = monthNames[targetMonth];
  const judgmentId = `judgment_${targetYear}_${targetMonth}`;

  // Find the loser for the target month
  const judgmentLoser = useMemo(() => {
    const targetInfractions = infractions.filter(inf => {
      if (!inf.timestamp) return false;
      const d = inf.timestamp.toDate();
      return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
    });

    const targetStats = targetInfractions.reduce((acc, curr) => {
      if (curr.userName) acc[curr.userName] = (acc[curr.userName] || 0) + 1;
      return acc;
    }, {});

    if (Object.keys(targetStats).length === 0) return null;

    let loser = null;
    let max = 0;
    Object.keys(targetStats).forEach(name => {
      if (targetStats[name] > max) {
        max = targetStats[name];
        loser = name;
      } else if (targetStats[name] === max && max > 0) {
        loser += ` & ${name}`; // Handle ties
      }
    });

    return { names: loser, score: max };
  }, [infractions, targetMonth, targetYear]);

  // Calculate Voting Stats
  const totalVotes = punishments.reduce((sum, p) => sum + (p.voters?.length || 0), 0);
  const enhancedPunishments = useMemo(() => {
    return punishments.map(p => {
      const votes = p.voters?.length || 0;
      const pct = totalVotes === 0 ? 0 : Math.round((votes / totalVotes) * 100);
      // Require at least 2 total votes globally to declare anything unanimous
      const isUnanimous = pct === 100 && totalVotes >= 2;
      return { ...p, votes, pct, isUnanimous };
    }).sort((a, b) => b.votes - a.votes);
  }, [punishments, totalVotes]);


  useEffect(() => {
    signInAnonymously(auth).catch(error => console.error("Authentication failed:", error));
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Listen for infractions
    const infractionsRef = collection(db, 'artifacts', appId, 'public', 'data', 'infractions');
    const unsubscribeInfractions = onSnapshot(infractionsRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => {
        const timeA = a.timestamp?.toMillis() || 0;
        const timeB = b.timestamp?.toMillis() || 0;
        return timeB - timeA;
      });
      setInfractions(data);

      if (!isJoined && data.length > 0) {
        const myLast = data.find(inf => inf.userId === user.uid);
        if (myLast && myLast.userName) {
          setUserName(myLast.userName);
          setIsJoined(true);
        }
      }
    });

    // Listen for punishments for the active judgmentId
    const pRef = collection(db, 'artifacts', appId, 'public', 'data', 'punishments', judgmentId, 'proposals');
    const unsubscribePunishments = onSnapshot(pRef, (snapshot) => {
      const pData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPunishments(pData);
    });

    return () => {
      unsubscribeInfractions();
      unsubscribePunishments();
    };
  }, [user, isJoined, judgmentId]);

  const filteredInfractions = useMemo(() => {
    if (timeframe === 'all') return infractions;
    
    const now = new Date();
    let startDate = new Date(now);
    
    if (timeframe === 'month') {
      startDate.setDate(1);
    } else if (timeframe === 'week') {
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startDate.setDate(now.getDate() - diffToMonday);
    }
    
    startDate.setHours(0, 0, 0, 0);

    return infractions.filter(inf => {
      if (!inf.timestamp) return true;
      return inf.timestamp.toDate() >= startDate;
    });
  }, [infractions, timeframe]);

  const stats = useMemo(() => {
    const initial = { cantCount: 0, dontKnowCount: 0, personalFoulCount: 0, userCounts: {} };
    return filteredInfractions.reduce((acc, curr) => {
      if (curr.type === "Can't") acc.cantCount++;
      if (curr.type === "Don't Know") acc.dontKnowCount++;
      if (curr.type === "Personal Foul") acc.personalFoulCount++;
      if (curr.userName) acc.userCounts[curr.userName] = (acc.userCounts[curr.userName] || 0) + 1;
      return acc;
    }, initial);
  }, [filteredInfractions]);

  const topOffenders = useMemo(() => {
    if (Object.keys(stats.userCounts).length === 0) return null;
    const maxScore = Math.max(...Object.values(stats.userCounts));
    const leaders = Object.entries(stats.userCounts).filter(([_, c]) => c === maxScore).map(([name]) => name);
    return { names: leaders, score: maxScore };
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

    return {
      total, cantPct, dontKnowPct, foulPct,
      brickWall: getWinner(u => u.cant),
      deer: getWinner(u => u.dontKnow),
      honestAbe: getWinner(u => u.foul),
      heckler: (() => {
        let top = null, maxT = 0;
        Object.keys(tauntStats).forEach(name => {
          if (tauntStats[name] > maxT) { maxT = tauntStats[name]; top = name; } 
          else if (tauntStats[name] === maxT && maxT > 0) { top += `, ${name}`; }
        });
        return { winner: top, score: maxT };
      })()
    };
  }, [filteredInfractions, stats]);

  const submitInfraction = async (e) => {
    e.preventDefault();
    if (!user || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'infractions'), {
        userId: user.uid, userName, type: selectedType, notes: notes.trim(), taunts: [], timestamp: serverTimestamp()
      });
      setIsModalOpen(false);
    } catch (e) { console.error(e); } 
    finally { setIsSubmitting(false); }
  };

  const submitTaunt = async (infractionId, text) => {
    if (!text.trim() || !user) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'infractions', infractionId), {
        taunts: arrayUnion({ userId: user.uid, userName, text: text.trim(), timestamp: Date.now() })
      });
      setCustomTaunt('');
      setActiveTauntId(null);
    } catch (e) { console.error(e); }
  };

  const submitPunishment = async (e) => {
    e.preventDefault();
    if (!newPunishment.trim() || !user) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'punishments', judgmentId, 'proposals'), {
        text: newPunishment.trim(), authorName: userName, authorId: user.uid, voters: [], timestamp: serverTimestamp()
      });
      setNewPunishment('');
    } catch (e) { console.error(e); }
  };

  const castVote = async (proposalId) => {
    if (!user) return;
    try {
      // Find if user voted for something else already
      const prevVoted = punishments.find(p => p.voters?.includes(user.uid) && p.id !== proposalId);
      
      // Vote for new
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'punishments', judgmentId, 'proposals', proposalId), {
        voters: arrayUnion(user.uid)
      });

      // Remove vote from old
      if (prevVoted) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'punishments', judgmentId, 'proposals', prevVoted.id), {
          voters: arrayRemove(user.uid)
        });
      }
    } catch (e) { console.error(e); }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const today = new Date();
    const timeOptions = { hour: 'numeric', minute: '2-digit' };
    if (date.toDateString() === today.toDateString()) return `Today at ${date.toLocaleTimeString([], timeOptions)}`;
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${date.toLocaleTimeString([], timeOptions)}`;
  };

  if (authLoading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
      <div className="w-12 h-12 border-4 border-slate-800 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!isJoined) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-slate-800">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
        <div className="flex justify-center mb-6"><div className="bg-slate-100 p-4 rounded-full"><Car className="w-12 h-12 text-slate-700" /></div></div>
        <h1 className="text-2xl font-black text-center mb-2">Service Accountability</h1>
        <p className="text-center text-slate-500 mb-8">The Swear Jar for "Can't", "Don't Know", and Personal Fouls.</p>
        <form onSubmit={(e) => { e.preventDefault(); if (userName.trim()) setIsJoined(true); }} className="space-y-4">
          <input type="text" maxLength={20} required className="w-full px-4 py-3 rounded-lg border outline-none" placeholder="Enter display name" value={userName} onChange={(e) => setUserName(e.target.value)} />
          <button type="submit" className="w-full bg-slate-900 text-white font-bold py-3 rounded-lg">Start Your Shift</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm flex-shrink-0">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="bg-slate-100 p-2 rounded-lg"><Car className="w-6 h-6 text-slate-700" /></div>
            <h1 className="text-xl font-black tracking-tight">The Swear Jar</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            
            {isVotingOpen && (
              <button
                onClick={() => setIsJudgmentOpen(true)}
                className="flex items-center space-x-1.5 bg-red-600 hover:bg-red-700 text-white py-1.5 px-3 rounded-lg text-sm font-bold shadow-md animate-pulse"
              >
                <Gavel className="w-4 h-4" />
                <span>Judgment ⚖️</span>
              </button>
            )}

            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 overflow-x-auto hide-scrollbar">
              {['day', 'week', 'month', 'all'].map(t => (
                <button
                  key={t} onClick={() => setTimeframe(t)}
                  className={`px-3 py-1.5 text-xs sm:text-sm font-bold rounded-md capitalize ${timeframe === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                >{t === 'day' ? 'Today' : t === 'week' ? 'This Week' : t === 'month' ? 'This Month' : 'All Time'}</button>
              ))}
            </div>
            
            <button
              onClick={() => setIsAnalyticsOpen(true)}
              className="flex items-center space-x-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 py-1.5 px-3 rounded-lg text-sm font-bold shadow-sm"
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
        {/* Main Action Buttons */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button onClick={() => { setSelectedType("Can't"); setNotes(''); setIsModalOpen(true); }} className="group relative bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:border-red-300 text-left overflow-hidden">
            <div className="absolute top-0 right-0 -mr-4 -mt-4 bg-red-50 rounded-full p-8 group-hover:scale-110 transition-transform"><Ban className="w-12 h-12 text-red-200" /></div>
            <div className="relative z-10">
              <span className="text-sm font-bold text-red-500 uppercase mb-1 block">Oops, I did it</span>
              <h2 className="text-2xl font-black text-slate-900">I said "Can't"</h2>
              <p className="text-slate-500 mt-2 text-sm">"You can do it Bobby Boucher!"</p>
            </div>
          </button>
          <button onClick={() => { setSelectedType("Don't Know"); setNotes(''); setIsModalOpen(true); }} className="group relative bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:border-blue-300 text-left overflow-hidden">
            <div className="absolute top-0 right-0 -mr-4 -mt-4 bg-blue-50 rounded-full p-8 group-hover:scale-110 transition-transform"><Search className="w-12 h-12 text-blue-200" /></div>
            <div className="relative z-10">
              <span className="text-sm font-bold text-blue-500 uppercase mb-1 block">Deer in headlights</span>
              <h2 className="text-2xl font-black text-slate-900">I said "Don't Know"</h2>
              <p className="text-slate-500 mt-2 text-sm">"Hold on, let me consult the Magic 8-Ball..."</p>
            </div>
          </button>
          <button onClick={() => { setSelectedType("Personal Foul"); setNotes(''); setIsModalOpen(true); }} className="group relative bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:border-amber-300 text-left overflow-hidden">
            <div className="absolute top-0 right-0 -mr-4 -mt-4 bg-amber-50 rounded-full p-8 group-hover:scale-110 transition-transform"><Flag className="w-12 h-12 text-amber-200" /></div>
            <div className="relative z-10">
              <span className="text-sm font-bold text-amber-500 uppercase mb-1 block">My Bad</span>
              <h2 className="text-2xl font-black text-slate-900">Personal Foul</h2>
              <p className="text-slate-500 mt-2 text-sm">Hold yourself accountable. (Spill the juicy details, or take it to the grave!)</p>
            </div>
          </button>
        </section>

        {/* Top Offenders Mini-Board */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border text-center"><p className="text-xs text-slate-500 font-bold uppercase mb-1">Total "Can'ts"</p><p className="text-3xl font-black">{stats.cantCount}</p></div>
          <div className="bg-white p-4 rounded-xl shadow-sm border text-center"><p className="text-xs text-slate-500 font-bold uppercase mb-1">Total "Don't Knows"</p><p className="text-3xl font-black">{stats.dontKnowCount}</p></div>
          <div className="bg-white p-4 rounded-xl shadow-sm border text-center"><p className="text-xs text-slate-500 font-bold uppercase mb-1">Personal Fouls</p><p className="text-3xl font-black">{stats.personalFoulCount}</p></div>
          <div className="bg-slate-900 p-4 rounded-xl shadow-sm flex flex-col items-center justify-center text-white relative overflow-hidden">
            <Trophy className="absolute -right-4 -bottom-4 w-24 h-24 text-slate-800 opacity-50" />
            <p className="text-xs text-amber-400 font-bold uppercase mb-1 relative z-10">Top Offender</p>
            {topOffenders ? (
              <div className="relative z-10 text-center w-full"><p className="text-lg font-bold truncate">{topOffenders.names.length > 1 ? `Tied: ${topOffenders.names.join(', ')}` : topOffenders.names[0]}</p><p className="text-sm text-slate-400">{topOffenders.score} total</p></div>
            ) : <p className="text-lg font-medium text-slate-500 relative z-10">None yet</p>}
          </div>
        </section>

        {/* Activity Feed */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col" style={{ maxHeight: '800px' }}>
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 z-10 rounded-t-2xl">
            <h3 className="font-bold text-slate-800 flex items-center"><Clock className="w-5 h-5 mr-2 text-slate-500" /> Activity Feed</h3>
            <span className="text-xs font-bold text-slate-400 uppercase bg-white px-2 py-1 rounded border">{timeframe === 'day' ? 'Today' : timeframe === 'week' ? 'This Week' : timeframe === 'month' ? 'This Month' : 'All Time'}</span>
          </div>
          <div className="divide-y divide-slate-100 overflow-y-auto flex-1 p-2 sm:p-0">
            {filteredInfractions.length === 0 ? (
              <div className="p-12 text-center text-slate-500"><Wrench className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="font-medium">No infractions found.</p></div>
            ) : (
              filteredInfractions.map((infraction) => (
                <div key={infraction.id} className="p-4 sm:p-6 hover:bg-slate-50 transition-colors flex flex-col">
                  <div className="flex items-start space-x-3 w-full">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0 mt-1 ${infraction.type === "Can't" ? 'bg-red-100 text-red-600' : infraction.type === "Personal Foul" ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                      {infraction.userName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-slate-900 font-medium">
                        {infraction.userName} <span className="text-slate-500 font-normal">{getActionPhrase(infraction.id)}</span> <span className={`font-bold ${infraction.type === "Can't" ? 'text-red-600' : infraction.type === "Personal Foul" ? 'text-amber-600' : 'text-blue-600'}`}>"{infraction.type}"</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatDate(infraction.timestamp)}</p>
                      {infraction.notes && <div className="mt-2 pl-3 border-l-2 border-slate-200"><p className="text-sm text-slate-600 italic">"{infraction.notes}"</p></div>}
                    </div>
                  </div>

                  {infraction.taunts && infraction.taunts.length > 0 && (
                    <div className="mt-4 ml-13 space-y-2">
                      {infraction.taunts.map((taunt, idx) => (
                        <div key={idx} className="bg-white border shadow-sm rounded-lg p-3 text-sm flex items-start space-x-2">
                          <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs">{taunt.userName.charAt(0).toUpperCase()}</div>
                          <div><span className="font-bold text-slate-700 mr-2">{taunt.userName}</span><span className="text-slate-600">{taunt.text}</span></div>
                        </div>
                      ))}
                    </div>
                  )}

                  {user && infraction.userId !== user.uid && !infraction.taunts?.some(t => t.userId === user.uid) && (
                    <div className="mt-3 ml-13">
                      {activeTauntId === infraction.id ? (
                        <div className="bg-slate-100 p-3 rounded-xl border">
                          <div className="flex flex-wrap gap-2 mb-3">
                            {PREDEFINED_TAUNTS.map(t => <button key={t} onClick={() => submitTaunt(infraction.id, t)} className="bg-white border hover:bg-slate-50 text-xs font-medium py-1.5 px-3 rounded-full">{t}</button>)}
                          </div>
                          <div className="flex space-x-2">
                            <input type="text" value={customTaunt} onChange={(e) => setCustomTaunt(e.target.value)} placeholder="Type a custom taunt..." className="flex-1 px-3 py-2 text-sm rounded-lg border outline-none" onKeyDown={(e) => e.key === 'Enter' && submitTaunt(infraction.id, customTaunt)} />
                            <button onClick={() => submitTaunt(infraction.id, customTaunt)} disabled={!customTaunt.trim()} className="bg-slate-800 text-white p-2 rounded-lg disabled:opacity-50"><Send className="w-4 h-4" /></button>
                          </div>
                          <button onClick={() => setActiveTauntId(null)} className="text-xs text-slate-500 hover:text-slate-700 mt-3 font-medium underline">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setActiveTauntId(infraction.id)} className="flex items-center text-xs font-bold text-slate-500 hover:text-slate-800 py-1 px-2 -ml-2 rounded hover:bg-slate-100"><MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Taunt</button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      <footer className="mt-auto py-8 px-4 text-center text-slate-400 text-xs flex flex-col items-center opacity-70 hover:opacity-100">
        <Info className="w-5 h-5 mb-2 text-slate-300" />
        <p className="font-bold uppercase tracking-widest text-slate-300 mb-1">Terms & Conditions</p>
        <p className="max-w-md">By participating, you acknowledge that the slate is officially wiped clean on the 1st of every month (using the "This Month" filter). Sigh a breath of relief and start fresh!</p>
      </footer>

      {/* Judgment Modal */}
      {isJudgmentOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-red-600 p-6 text-white text-center relative overflow-hidden flex-shrink-0">
              <Scale className="absolute -right-6 -bottom-6 w-32 h-32 text-red-700 opacity-50" />
              <h2 className="text-3xl font-black relative z-10 tracking-tight uppercase">The Judgment Zone</h2>
              <p className="text-red-100 font-medium relative z-10 mt-1">Voting closes on the 3rd of the month!</p>
              <button onClick={() => setIsJudgmentOpen(false)} className="absolute top-4 right-4 text-red-200 hover:text-white p-1 bg-red-700 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 overflow-y-auto bg-slate-50">
              <div className="bg-white rounded-2xl border border-red-200 p-6 shadow-sm text-center mb-6">
                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">{monthName} Top Offender(s)</p>
                <h3 className="text-3xl font-black text-slate-900">{judgmentLoser?.names || "No Loser Found"}</h3>
                <p className="text-slate-500 font-medium mt-1">Total Infractions: {judgmentLoser?.score || 0}</p>
              </div>

              {judgmentLoser?.score > 0 && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-bold text-slate-800">Proposed Punishments</h4>
                    <span className="text-xs font-bold text-slate-400 uppercase bg-slate-200 px-2 py-1 rounded-full">{totalVotes} Total Votes Cast</span>
                  </div>

                  <div className="space-y-3 mb-6">
                    {enhancedPunishments.length === 0 ? (
                      <p className="text-center text-slate-500 py-6 italic">No punishments proposed yet. Be merciless!</p>
                    ) : (
                      enhancedPunishments.map(p => (
                        <div key={p.id} className={`bg-white rounded-xl border p-4 shadow-sm relative overflow-hidden transition-all ${p.isUnanimous ? 'border-green-500 ring-2 ring-green-200' : 'border-slate-200 hover:border-slate-300'}`}>
                          {p.isUnanimous && (
                            <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl shadow-sm flex items-center">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Unanimous Winner!
                            </div>
                          )}
                          <div className="flex gap-4 items-center">
                            <div className="flex-1 pr-16">
                              <p className="text-slate-900 font-bold text-lg mb-1">{p.text}</p>
                              <p className="text-xs text-slate-400">Proposed by {p.authorName}</p>
                            </div>
                            <div className="flex flex-col items-center">
                              <button 
                                onClick={() => castVote(p.id)}
                                className={`w-12 h-12 rounded-full flex flex-col items-center justify-center font-black transition-all ${p.voters?.includes(user?.uid) ? 'bg-red-600 text-white shadow-md scale-110' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                              >
                                <span className="text-sm">{p.pct}%</span>
                              </button>
                            </div>
                          </div>
                          {/* Progress Bar */}
                          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
                            <div className={`h-full transition-all duration-1000 ${p.isUnanimous ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${p.pct}%` }}></div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <form onSubmit={submitPunishment} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex gap-3">
                    <input 
                      type="text" 
                      placeholder="Propose a new punishment..." 
                      className="flex-1 outline-none font-medium text-slate-800"
                      value={newPunishment}
                      onChange={(e) => setNewPunishment(e.target.value)}
                    />
                    <button type="submit" disabled={!newPunishment.trim()} className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold disabled:opacity-50 text-sm">Submit</button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Logging Modal - unchanged logic, compacted */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-bold">Logging a "{selectedType}"</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={submitInfraction} className="p-6">
              {selectedType === "Personal Foul" && (
                <div className="bg-amber-50 border border-amber-100 text-amber-800 p-4 rounded-xl mb-6 text-sm font-medium flex"><AlertTriangle className="w-5 h-5 mr-2" /><p>Personal accountability. Details optional!</p></div>
              )}
              <textarea rows="4" className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-slate-800 outline-none resize-none mb-6 text-sm" placeholder="Context / Notes (Optional)" value={notes} onChange={(e) => setNotes(e.target.value)}></textarea>
              <div className="flex space-x-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl border font-semibold hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={isSubmitting} className={`flex-1 px-4 py-3 rounded-xl text-white font-bold ${selectedType === "Can't" ? 'bg-red-500' : selectedType === "Personal Foul" ? 'bg-amber-500' : 'bg-blue-500'}`}>Confess!</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Analytics Modal - existing logic, compacted */}
      {isAnalyticsOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 bg-indigo-50 border-b border-indigo-100">
              <h3 className="text-lg font-black text-indigo-900 flex"><BarChart3 className="w-5 h-5 mr-2" /> Statistics</h3>
              <button onClick={() => setIsAnalyticsOpen(false)} className="bg-white border rounded-md p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto">
              {comprehensiveAnalytics.total === 0 ? (
                <div className="text-center py-12 text-slate-400"><Medal className="w-16 h-16 mx-auto mb-4" /><p className="text-lg font-medium">No infractions recorded.</p></div>
              ) : (
                <div className="space-y-8">
                  <div>
                    <h4 className="text-sm font-bold text-slate-500 uppercase mb-4 border-b pb-2">Volume Breakdown</h4>
                    <div className="flex h-6 rounded-full overflow-hidden mb-3"><div style={{ width: `${comprehensiveAnalytics.cantPct}%` }} className="bg-red-500"></div><div style={{ width: `${comprehensiveAnalytics.dontKnowPct}%` }} className="bg-blue-500"></div><div style={{ width: `${comprehensiveAnalytics.foulPct}%` }} className="bg-amber-500"></div></div>
                    <div className="grid grid-cols-3 text-center text-sm font-medium"><div className="text-red-600">Can't: {comprehensiveAnalytics.cantPct}%</div><div className="text-blue-600">Don't Know: {comprehensiveAnalytics.dontKnowPct}%</div><div className="text-amber-600">Foul: {comprehensiveAnalytics.foulPct}%</div></div>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-500 uppercase mb-4 border-b pb-2">Hall of Fame (or Shame)</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="border p-4 rounded-xl"><p className="text-xs font-bold text-red-500 uppercase">The Brick Wall</p><h5 className="text-lg font-black">{comprehensiveAnalytics.brickWall.winner || 'Nobody!'}</h5></div>
                      <div className="border p-4 rounded-xl"><p className="text-xs font-bold text-blue-500 uppercase">Resident in Headlights</p><h5 className="text-lg font-black">{comprehensiveAnalytics.deer.winner || 'Nobody!'}</h5></div>
                      <div className="border p-4 rounded-xl"><p className="text-xs font-bold text-amber-500 uppercase">The Honest Abe</p><h5 className="text-lg font-black">{comprehensiveAnalytics.honestAbe.winner || 'Nobody!'}</h5></div>
                      <div className="border p-4 rounded-xl"><p className="text-xs font-bold text-slate-500 uppercase">The Heckler</p><h5 className="text-lg font-black">{comprehensiveAnalytics.heckler.winner || 'Nobody!'}</h5></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-50 text-center border-t"><button onClick={() => setIsAnalyticsOpen(false)} className="bg-slate-900 text-white font-bold py-2 px-8 rounded-lg">Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
