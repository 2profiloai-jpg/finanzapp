import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  Briefcase, 
  Receipt, 
  Settings,
  TrendingUp, 
  TrendingDown, 
  Trash2,
  Calendar as CalendarIcon,
  Clock,
  Euro,
  Save,
  LogOut,
  Moon,
  Sun,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { WorkEntry, Expense, View } from './types';
import { auth, db } from './firebase';
import { 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User,
  signOut
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc,
  query,
  orderBy
} from 'firebase/firestore';

const DAY_NAMES = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isCheckingRedirect, setIsCheckingRedirect] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [view, setView] = useState<View>('dashboard');
  
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [defaultRate, setDefaultRate] = useState<number>(5.0);
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Form states
  const [workDay, setWorkDay] = useState(DAY_NAMES[0]);
  const [workHours, setWorkHours] = useState<string>('');
  const [workRate, setWorkRate] = useState<string>('');
  const [workNote, setWorkNote] = useState('');

  const [expDay, setExpDay] = useState(DAY_NAMES[0]);
  const [expAmount, setExpAmount] = useState<string>('');
  const [expCategory, setExpCategory] = useState('Materiali');
  const [expNote, setExpNote] = useState('');
  const [isDataLoading, setIsDataLoading] = useState(true);

  // Persistence: Load form data from localStorage
  useEffect(() => {
    const savedWorkHours = localStorage.getItem('draft_workHours');
    const savedWorkNote = localStorage.getItem('draft_workNote');
    const savedExpAmount = localStorage.getItem('draft_expAmount');
    const savedExpNote = localStorage.getItem('draft_expNote');

    if (savedWorkHours) setWorkHours(savedWorkHours);
    if (savedWorkNote) setWorkNote(savedWorkNote);
    if (savedExpAmount) setExpAmount(savedExpAmount);
    if (savedExpNote) setExpNote(savedExpNote);
  }, []);

  // Persistence: Save form data to localStorage
  useEffect(() => {
    localStorage.setItem('draft_workHours', workHours);
    localStorage.setItem('draft_workNote', workNote);
  }, [workHours, workNote]);

  useEffect(() => {
    localStorage.setItem('draft_expAmount', expAmount);
    localStorage.setItem('draft_expNote', expNote);
  }, [expAmount, expNote]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log("Auth state changed:", currentUser?.email);
      setUser(currentUser);
      setIsAuthReady(true);
    });

    // Check for redirect result on mount
    const checkRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          console.log("Redirect login success:", result.user.email);
          setUser(result.user);
        }
      } catch (error: any) {
        console.error("Redirect error details:", error);
        if (error.code === 'auth/unauthorized-domain') {
          setLoginError("Dominio non autorizzato. Aggiungi questo dominio alla console Firebase.");
        } else {
          setLoginError("Errore durante il reindirizzamento. Riprova l'accesso.");
        }
      } finally {
        setIsCheckingRedirect(false);
      }
    };

    checkRedirect();

    return () => unsubscribe();
  }, []);

  // Sync Theme with Body class
  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  // Firestore Listeners
  useEffect(() => {
    if (!isAuthReady || !user) {
      setIsDataLoading(false);
      return;
    }

    setIsDataLoading(true);

    // Load Settings
    const unsubSettings = onSnapshot(doc(db, 'users', user.uid, 'settings', 'profile'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setDefaultRate(data.defaultRate || 5.0);
        setTheme(data.theme || 'dark');
        setWorkRate(data.defaultRate?.toString() || '5');
      } else {
        // Create default settings
        setDoc(doc(db, 'users', user.uid, 'settings', 'profile'), {
          defaultRate: 5.0,
          theme: 'dark'
        }).catch(err => console.error("Error creating settings:", err));
        setWorkRate('5');
      }
    }, (error) => {
      console.error("Settings listener error:", error);
    });

    // Load Work Entries
    const qWork = query(collection(db, 'users', user.uid, 'workEntries'), orderBy('createdAt', 'desc'));
    const unsubWork = onSnapshot(qWork, (snapshot) => {
      const entries: WorkEntry[] = [];
      snapshot.forEach((doc) => {
        entries.push(doc.data() as WorkEntry);
      });
      setWorkEntries(entries);
      setIsDataLoading(false);
    }, (error) => {
      console.error("Work listener error:", error);
      setIsDataLoading(false);
    });

    // Load Expenses
    const qExp = query(collection(db, 'users', user.uid, 'expenses'), orderBy('createdAt', 'desc'));
    const unsubExp = onSnapshot(qExp, (snapshot) => {
      const exps: Expense[] = [];
      snapshot.forEach((doc) => {
        exps.push(doc.data() as Expense);
      });
      setExpenses(exps);
    }, (error) => {
      console.error("Expenses listener error:", error);
    });

    return () => {
      unsubSettings();
      unsubWork();
      unsubExp();
    };
  }, [user, isAuthReady]);

  const handleLogin = async () => {
    setLoginError(null);
    try {
      const provider = new GoogleAuthProvider();
      
      // Check if mobile
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      if (isMobile) {
        await signInWithRedirect(auth, provider);
      } else {
        await signInWithPopup(auth, provider);
      }
    } catch (error: any) {
      console.error("Login error:", error);
      if (error.code === 'auth/popup-blocked') {
        setLoginError("Il browser ha bloccato il popup. Abilita i popup o riprova.");
      } else if (error.code === 'auth/unauthorized-domain') {
        setLoginError("Dominio non autorizzato. Controlla la configurazione Firebase.");
      } else {
        setLoginError("Impossibile accedere. Riprova più tardi.");
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleSaveSettings = async (newRate: number, newTheme: 'light' | 'dark') => {
    if (!user) return;
    setDefaultRate(newRate);
    setTheme(newTheme);
    await setDoc(doc(db, 'users', user.uid, 'settings', 'profile'), {
      defaultRate: newRate,
      theme: newTheme
    });
  };

  const calculatedEarnings = (parseFloat(workHours) || 0) * (parseFloat(workRate) || 0);

  const handleSaveWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !workHours || !workRate) return;
    
    const id = crypto.randomUUID();
    const newEntry: WorkEntry = {
      id,
      day: workDay,
      hours: parseFloat(workHours),
      hourlyRate: parseFloat(workRate),
      totalEarned: calculatedEarnings,
      note: workNote,
      createdAt: Date.now()
    };
    
    await setDoc(doc(db, 'users', user.uid, 'workEntries', id), newEntry);
    setWorkHours('');
    setWorkNote('');
    localStorage.removeItem('draft_workHours');
    localStorage.removeItem('draft_workNote');
    setView('calendar');
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !expAmount) return;

    const id = crypto.randomUUID();
    const newExpense: Expense = {
      id,
      day: expDay,
      amount: parseFloat(expAmount),
      category: expCategory,
      note: expNote,
      createdAt: Date.now()
    };

    await setDoc(doc(db, 'users', user.uid, 'expenses', id), newExpense);
    setExpAmount('');
    setExpNote('');
    localStorage.removeItem('draft_expAmount');
    localStorage.removeItem('draft_expNote');
    setView('dashboard');
  };

  const handleDelete = async (id: string, type: 'work' | 'expense') => {
    if (!user) return;
    const collectionName = type === 'work' ? 'workEntries' : 'expenses';
    await deleteDoc(doc(db, 'users', user.uid, collectionName, id));
  };

  if (!isAuthReady || isCheckingRedirect) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center marble-bg gap-4">
        <div className="w-12 h-12 border-4 border-gold-bright border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gold-bright/60 text-xs uppercase tracking-widest animate-pulse">Verifica accesso...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="marble-bg min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="gold-vein top-1/4 -left-1/4" />
        <div className="gold-vein-alt top-2/3 -right-1/4" />
        
        <div className="glass-card p-8 max-w-sm w-full space-y-8 relative z-10">
          <div>
            <h1 className="text-2xl uppercase tracking-[0.3em] text-gold-bright font-medium mb-2">Aureum</h1>
            <p className="text-sm text-muted">Gestisci i tuoi guadagni e le tue spese con eleganza.</p>
          </div>
          
          <button 
            onClick={handleLogin}
            className="w-full py-4 bg-white text-black font-medium rounded-xl flex items-center justify-center gap-3 hover:bg-gray-100 transition-colors active:scale-95"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Accedi con Google
          </button>

          {loginError && (
            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-red-400 mt-4"
            >
              {loginError}
            </motion.p>
          )}
        </div>
      </div>
    );
  }

  const totalEarned = workEntries.reduce((acc, w) => acc + w.totalEarned, 0);
  const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
  const netBalance = totalEarned - totalExpenses;

  const allHistory = [
    ...workEntries.map(w => ({ ...w, type: 'work' as const })),
    ...expenses.map(e => ({ ...e, type: 'expense' as const }))
  ].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="marble-bg min-h-screen pb-32 font-sans text-normal">
      <div className="gold-vein top-1/4 -left-1/4" />
      <div className="gold-vein top-2/3 -right-1/4" />
      <div className="gold-vein-alt top-1/2 -left-1/3" />
      <div className="gold-vein-alt top-10 -right-1/3" />

      <header className="p-6 pt-12 flex justify-between items-center relative z-10">
        <div>
          <h1 className="text-sm uppercase tracking-[0.3em] text-gold-bright/80 font-medium">Aureum</h1>
          <p className="text-xs text-muted mt-1">Financial & Work Tracker</p>
        </div>
        <div className="flex items-center gap-4">
          {isDataLoading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-4 h-4 border-2 border-gold-bright/40 border-t-gold-bright rounded-full animate-spin"
            />
          )}
          <div className="w-8 h-8 rounded-full overflow-hidden border border-gold-bright/30">
            {user.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full bg-gold-bright/20 flex items-center justify-center text-gold-bright text-xs">
                {user.email?.[0].toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="px-6 relative z-10">
        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <section className="text-center py-6">
                <p className="text-xs uppercase tracking-widest text-gold-bright/60 mb-2">Saldo Netto Reale</p>
                <h2 className="text-5xl sm:text-6xl font-light gold-text-gradient tracking-tighter">
                  €{netBalance.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
                <div className="flex justify-center gap-4 mt-8">
                  <div className="glass-card p-4 flex-1">
                    <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Guadagni</p>
                    <p className="text-xl text-gold-bright">€{totalEarned.toFixed(2)}</p>
                  </div>
                  <div className="glass-card p-4 flex-1">
                    <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Spese</p>
                    <p className="text-xl text-red-500">€{totalExpenses.toFixed(2)}</p>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <h3 className="text-[10px] uppercase tracking-widest text-gold-bright/60">Ultimi Movimenti</h3>
                </div>
                <div className="space-y-3">
                  {allHistory.length === 0 && (
                    <p className="text-center text-muted py-8 text-sm">Nessun dato registrato.</p>
                  )}
                  {allHistory.slice(0, 10).map(item => (
                    <div key={item.id} className="glass-card p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                          item.type === 'expense' ? "bg-red-500/10 text-red-500" : "bg-gold-bright/10 text-gold-bright"
                        )}>
                          {item.type === 'expense' ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {item.type === 'expense' ? item.category : 'Giornata Lavorativa'}
                          </p>
                          <p className="text-[10px] text-muted truncate">
                            {item.day} {item.type === 'work' && `• ${(item as WorkEntry).hours}h`}
                            {item.note && ` • ${item.note}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1 shrink-0 pl-2">
                        <p className={cn(
                          "text-sm font-medium",
                          item.type === 'expense' ? "text-red-500" : "text-gold-bright"
                        )}>
                          {item.type === 'expense' ? '-' : '+'}€
                          {item.type === 'expense' ? (item as Expense).amount.toFixed(2) : (item as WorkEntry).totalEarned.toFixed(2)}
                        </p>
                        <button 
                          onClick={() => handleDelete(item.id, item.type)}
                          className="text-muted hover:text-red-500 transition-colors p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </motion.div>
          )}

          {view === 'calendar' && (
            <motion.div 
              key="calendar"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="glass-card p-6 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold-bright to-transparent opacity-50" />
                <p className="text-xs uppercase tracking-widest text-gold-bright/60 mb-2">Riepilogo Settimana</p>
                <h2 className="text-5xl font-light gold-text-gradient tracking-tighter">
                  €{totalEarned.toFixed(2)}
                </h2>
                <p className="text-sm text-muted mt-3 flex items-center justify-center gap-2">
                  <Clock size={14} /> {workEntries.reduce((acc, w) => acc + w.hours, 0)} ore totali
                </p>
              </div>

              <div className="space-y-3">
                {DAY_NAMES.map(dayName => {
                  const dayEntries = workEntries.filter(w => w.day === dayName);
                  const dayTotal = dayEntries.reduce((acc, w) => acc + w.totalEarned, 0);
                  const dayHours = dayEntries.reduce((acc, w) => acc + w.hours, 0);

                  return (
                    <div 
                      key={dayName} 
                      className="glass-card p-4 flex items-center justify-between transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-16 text-left">
                          <p className="text-xs uppercase font-medium text-gold-bright">{dayName}</p>
                        </div>
                        <div className="w-px h-10 bg-gold-bright/20" />
                        <div>
                          {dayEntries.length > 0 ? (
                            <>
                              <p className="text-lg font-medium text-gold-bright">€{dayTotal.toFixed(2)}</p>
                              <p className="text-[10px] text-muted uppercase tracking-wider">{dayHours}h lavorate</p>
                            </>
                          ) : (
                            <p className="text-xs text-muted italic">Nessun turno</p>
                          )}
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setWorkDay(dayName);
                          setView('add-work');
                        }}
                        className="w-10 h-10 rounded-full bg-gold-bright/10 text-gold-bright flex items-center justify-center hover:bg-gold-bright hover:text-white transition-all gold-glow shrink-0"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {view === 'add-work' && (
            <motion.div 
              key="add-work"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center py-4">
                <p className="text-xs uppercase tracking-widest text-gold-bright/60 mb-2">Guadagno Calcolato</p>
                <h2 className="text-6xl font-light gold-text-gradient tracking-tighter">
                  €{calculatedEarnings.toFixed(2)}
                </h2>
              </div>

              <form onSubmit={handleSaveWork} className="glass-card p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-muted ml-1 flex items-center gap-2">
                    <CalendarIcon size={12} /> Giorno
                  </label>
                  <select 
                    required
                    value={workDay}
                    onChange={e => setWorkDay(e.target.value)}
                    className="input-base"
                  >
                    {DAY_NAMES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-muted ml-1 flex items-center gap-2">
                    <Euro size={12} /> Tariffa Oraria
                  </label>
                  <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
                    {[5, 8, 10, 15, 20, 50].map(rate => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setWorkRate(rate.toString())}
                        className={cn(
                          "px-5 py-3 rounded-xl border whitespace-nowrap transition-all text-sm shrink-0",
                          workRate === rate.toString() 
                            ? "bg-gold-bright text-white border-gold-bright font-bold shadow-[0_0_15px_rgba(212,175,55,0.4)]" 
                            : "bg-transparent border-gold-bright/30 text-gold-bright hover:border-gold-bright/60"
                        )}
                      >
                        €{rate}/h
                      </button>
                    ))}
                  </div>
                  <input 
                    type="number" 
                    step="0.5"
                    min="0"
                    required
                    placeholder="Tariffa personalizzata..."
                    value={workRate}
                    onChange={e => setWorkRate(e.target.value)}
                    className="input-base"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-muted ml-1 flex items-center gap-2">
                    <Clock size={12} /> Ore Lavorate
                  </label>
                  <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
                    {[2, 4, 6, 8, 10].map(h => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setWorkHours(h.toString())}
                        className={cn(
                          "px-5 py-3 rounded-xl border whitespace-nowrap transition-all text-sm shrink-0",
                          workHours === h.toString() 
                            ? "bg-gold-bright text-white border-gold-bright font-bold shadow-[0_0_15px_rgba(212,175,55,0.4)]" 
                            : "bg-transparent border-gold-bright/30 text-gold-bright hover:border-gold-bright/60"
                        )}
                      >
                        {h}h
                      </button>
                    ))}
                  </div>
                  <input 
                    type="number" 
                    step="0.25"
                    min="0"
                    required
                    placeholder="Ore personalizzate (es. 4.5)..."
                    value={workHours}
                    onChange={e => setWorkHours(e.target.value)}
                    className="input-base"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-muted ml-1">Note (Opzionale)</label>
                  <input 
                    type="text" 
                    placeholder="Dettagli giornata..."
                    value={workNote}
                    onChange={e => setWorkNote(e.target.value)}
                    className="input-base"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full mt-6 py-4 bg-gradient-to-r from-gold-dark via-gold-bright to-gold-champagne text-black font-bold rounded-xl gold-glow active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Save size={18} /> Registra Giornata
                </button>
              </form>
            </motion.div>
          )}

          {view === 'add-expense' && (
            <motion.div 
              key="add-expense"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center py-4">
                <p className="text-xs uppercase tracking-widest text-red-500/80 mb-2">Nuova Spesa</p>
                <h2 className="text-6xl font-light text-red-500 tracking-tighter">
                  €{parseFloat(expAmount || '0').toFixed(2)}
                </h2>
              </div>

              <form onSubmit={handleSaveExpense} className="glass-card p-6 space-y-5">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-muted ml-1 flex items-center gap-2">
                    <CalendarIcon size={12} /> Giorno
                  </label>
                  <select 
                    required
                    value={expDay}
                    onChange={e => setExpDay(e.target.value)}
                    className="input-base"
                  >
                    {DAY_NAMES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-muted ml-1 flex items-center gap-2">
                    <Euro size={12} /> Importo
                  </label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    value={expAmount}
                    onChange={e => setExpAmount(e.target.value)}
                    className="input-base"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-muted ml-1">Categoria</label>
                  <select 
                    value={expCategory}
                    onChange={e => setExpCategory(e.target.value)}
                    className="input-base"
                  >
                    <option value="Materiali">Materiali</option>
                    <option value="Trasporti">Trasporti</option>
                    <option value="Pasti">Pasti</option>
                    <option value="Software">Software</option>
                    <option value="Tasse">Tasse</option>
                    <option value="Altro">Altro</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-muted ml-1">Note (Opzionale)</label>
                  <input 
                    type="text" 
                    placeholder="Dettagli spesa..."
                    value={expNote}
                    onChange={e => setExpNote(e.target.value)}
                    className="input-base"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full mt-6 py-4 bg-red-500/20 border border-red-500/50 text-red-500 font-bold rounded-xl hover:bg-red-500/30 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Save size={18} /> Registra Spesa
                </button>
              </form>
            </motion.div>
          )}

          {view === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-8"
            >
              <h2 className="text-xl font-light text-gold-bright">Impostazioni</h2>

              <section className="glass-card p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-muted">Tema Applicazione</label>
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleSaveSettings(defaultRate, 'dark')}
                      className={cn(
                        "flex-1 py-3 rounded-xl border flex items-center justify-center gap-2 transition-all",
                        theme === 'dark' 
                          ? "bg-gold-bright text-white border-gold-bright shadow-[0_0_15px_rgba(212,175,55,0.4)]" 
                          : "bg-transparent border-gold-bright/30 text-gold-bright"
                      )}
                    >
                      <Moon size={18} /> Scuro
                    </button>
                    <button
                      onClick={() => handleSaveSettings(defaultRate, 'light')}
                      className={cn(
                        "flex-1 py-3 rounded-xl border flex items-center justify-center gap-2 transition-all",
                        theme === 'light' 
                          ? "bg-gold-bright text-white border-gold-bright shadow-[0_0_15px_rgba(212,175,55,0.4)]" 
                          : "bg-transparent border-gold-bright/30 text-gold-bright"
                      )}
                    >
                      <Sun size={18} /> Chiaro
                    </button>
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-gold-bright/20">
                  <label className="text-xs uppercase tracking-widest text-muted">Tariffa Oraria Predefinita (€/h)</label>
                  <p className="text-[10px] text-muted">Verrà usata come base quando aggiungi una nuova giornata lavorativa.</p>
                  <input 
                    type="number" 
                    step="0.5"
                    min="0"
                    value={defaultRate}
                    onChange={e => handleSaveSettings(parseFloat(e.target.value) || 0, theme)}
                    className="input-base text-xl text-gold-bright font-medium"
                  />
                </div>
              </section>

              <section className="pt-8 border-t border-gold-bright/20 text-center">
                <button 
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 mx-auto text-red-500/80 text-sm hover:text-red-500 transition-colors"
                >
                  <LogOut size={16} /> Disconnetti Account
                </button>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 h-[88px] pb-safe glass-card rounded-none border-t border-gold-bright/20 border-x-0 border-b-0 px-6 flex items-center justify-between z-50">
        <NavButton active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<Wallet size={20} />} label="Home" />
        <NavButton active={view === 'calendar'} onClick={() => setView('calendar')} icon={<CalendarIcon size={20} />} label="Settimana" />
        <div className="relative -top-6">
          <button 
            onClick={() => {
              setWorkDay(DAY_NAMES[0]);
              setView('add-work');
            }}
            className={cn(
              "w-14 h-14 rounded-full bg-gold-bright text-white flex items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.4)] active:scale-95 transition-all",
              view === 'add-work' && "scale-110"
            )}
          >
            <Briefcase size={24} />
          </button>
        </div>
        <NavButton active={view === 'add-expense'} onClick={() => setView('add-expense')} icon={<Receipt size={20} />} label="Spese" />
        <NavButton active={view === 'settings'} onClick={() => setView('settings')} icon={<Settings size={20} />} label="Impo" />
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 transition-all pt-2",
        active ? "text-gold-bright" : "text-muted hover:text-gold-bright/70"
      )}
    >
      <div className={cn("gold-icon-glow transition-transform", active && "scale-110")}>
        {icon}
      </div>
      <span className="text-[8px] uppercase tracking-widest font-medium">{label}</span>
    </button>
  );
}
