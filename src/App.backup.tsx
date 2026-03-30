import React, { useState, useEffect, Component } from 'react';
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
  Moon,
  Sun,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { WorkEntry, Expense, View } from './types';
import { db } from './firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc,
  query,
  orderBy
} from 'firebase/firestore';

// Fallback for crypto.randomUUID
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
};

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

// Error Boundary Component
class ErrorBoundary extends Component<any, any> {
  constructor(props: any) {
    super(props);
    (this as any).state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if ((this as any).state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-black p-6 text-center">
          <h2 className="text-[#D4AF37] text-xl font-bold mb-4">Qualcosa è andato storto</h2>
          <p className="text-ivory/60 text-sm mb-6 max-w-xs">{(this as any).state.error?.message || "Errore sconosciuto"}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-[#D4AF37] text-black rounded-xl font-bold"
          >
            Ricarica App
          </button>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

const DAY_NAMES = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

export default function App() {
  const [deviceId, setDeviceId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('aureum_device_id');
    } catch (e) {
      console.error("Error reading deviceId from localStorage:", e);
      return null;
    }
  });
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
    try {
      localStorage.setItem('draft_workHours', workHours);
      localStorage.setItem('draft_workNote', workNote);
    } catch (e) {
      console.error("Error saving work draft to localStorage:", e);
    }
  }, [workHours, workNote]);

  useEffect(() => {
    try {
      localStorage.setItem('draft_expAmount', expAmount);
      localStorage.setItem('draft_expNote', expNote);
    } catch (e) {
      console.error("Error saving expense draft to localStorage:", e);
    }
  }, [expAmount, expNote]);

  // Device ID initialization
  useEffect(() => {
    if (!deviceId) {
      try {
        let id = localStorage.getItem('aureum_device_id');
        if (!id) {
          id = 'device_' + Math.random().toString(36).substring(2, 15);
          localStorage.setItem('aureum_device_id', id);
        }
        setDeviceId(id);
      } catch (e) {
        console.error("Error initializing deviceId:", e);
        // Fallback to memory-only ID if localStorage is blocked
        setDeviceId('mem_' + Math.random().toString(36).substring(2, 15));
      }
    }
  }, [deviceId]);

  // Sync Theme with Body class
  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  // Firestore Listeners
  useEffect(() => {
    if (!deviceId) {
      setIsDataLoading(false);
      return;
    }

    setIsDataLoading(true);

    // Load Settings
    const unsubSettings = onSnapshot(doc(db, 'users', deviceId, 'settings', 'profile'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setDefaultRate(data.defaultRate || 5.0);
        setTheme(data.theme || 'dark');
        setWorkRate(data.defaultRate?.toString() || '5');
      } else {
        // Create default settings
        setDoc(doc(db, 'users', deviceId, 'settings', 'profile'), {
          defaultRate: 5.0,
          theme: 'dark'
        }).catch(err => console.error("Error creating settings:", err));
        setWorkRate('5');
      }
    }, (error) => {
      console.error("Settings listener error:", error);
    });

    // Load Work Entries
    const qWork = query(collection(db, 'users', deviceId, 'workEntries'), orderBy('createdAt', 'desc'));
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
    const qExp = query(collection(db, 'users', deviceId, 'expenses'), orderBy('createdAt', 'desc'));
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
  }, [deviceId]);

  const handleSaveSettings = async (newRate: number, newTheme: 'light' | 'dark') => {
    if (!deviceId) return;
    setDefaultRate(newRate);
    setTheme(newTheme);
    await setDoc(doc(db, 'users', deviceId, 'settings', 'profile'), {
      defaultRate: newRate,
      theme: newTheme
    });
  };

  const calculatedEarnings = (parseFloat(workHours) || 0) * (parseFloat(workRate) || 0);

  const handleSaveWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceId || !workHours || !workRate) return;
    
    const id = generateId();
    const newEntry: WorkEntry = {
      id,
      day: workDay,
      hours: parseFloat(workHours),
      hourlyRate: parseFloat(workRate),
      totalEarned: calculatedEarnings,
      note: workNote,
      createdAt: Date.now()
    };
    
    await setDoc(doc(db, 'users', deviceId, 'workEntries', id), newEntry);
    setWorkHours('');
    setWorkNote('');
    try {
      localStorage.removeItem('draft_workHours');
      localStorage.removeItem('draft_workNote');
    } catch (e) {
      console.error("Error clearing work draft from localStorage:", e);
    }
    setView('calendar');
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceId || !expAmount) return;

    const id = generateId();
    const newExpense: Expense = {
      id,
      day: expDay,
      amount: parseFloat(expAmount),
      category: expCategory,
      note: expNote,
      createdAt: Date.now()
    };

    await setDoc(doc(db, 'users', deviceId, 'expenses', id), newExpense);
    setExpAmount('');
    setExpNote('');
    try {
      localStorage.removeItem('draft_expAmount');
      localStorage.removeItem('draft_expNote');
    } catch (e) {
      console.error("Error clearing expense draft from localStorage:", e);
    }
    setView('dashboard');
  };

  const handleDelete = async (id: string, type: 'work' | 'expense') => {
    if (!deviceId) return;
    const collectionName = type === 'work' ? 'workEntries' : 'expenses';
    await deleteDoc(doc(db, 'users', deviceId, collectionName, id));
  };

  if (!deviceId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black gap-4">
        <div className="w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-[#D4AF37]/60 text-xs uppercase tracking-widest">Inizializzazione...</p>
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
    <ErrorBoundary>
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
          <div className="w-8 h-8 rounded-full overflow-hidden border border-gold-bright/30 flex items-center justify-center bg-gold-bright/10">
            <Briefcase className="w-4 h-4 text-gold-bright" />
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
    </ErrorBoundary>
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
