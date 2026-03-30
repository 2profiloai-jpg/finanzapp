export interface WorkEntry {
  id: string;
  day: string;
  hours: number;
  hourlyRate: number;
  totalEarned: number;
  note: string;
  createdAt: number;
}

export interface Expense {
  id: string;
  day: string;
  amount: number;
  category: string;
  note: string;
  createdAt: number;
}

export type View = 'dashboard' | 'add-work' | 'add-expense' | 'calendar' | 'settings';
