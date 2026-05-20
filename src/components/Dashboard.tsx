import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { Activity, Clock, TrendingUp, LogOut, Plus, ChevronDown, ChevronUp, X, Check, Download, Terminal } from 'lucide-react';
import TestRunner from './TestRunner';
import { motion, AnimatePresence } from 'motion/react';
import { json2csv } from 'json-2-csv';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchHistory = () => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    fetch('/api/test/history', { headers })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch history');
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data.history)) {
          setHistory(data.history);
        } else {
          console.error('Invalid history data received:', data);
          setHistory([]);
        }
      })
      .catch(err => {
        console.error('Error fetching history:', err);
        setHistory([]);
      });
  };

  useEffect(() => {
    fetchHistory();
  }, [isTesting]);

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleDownloadData = () => {
    try {
      const flatHistory = history.map(h => {
        let details = h.details;
        if (typeof details === 'string') {
          try { details = JSON.parse(details); } catch (e) {}
        }
        
        return {
          id: h.id,
          date: new Date(h.test_date).toISOString(),
          set: h.set_name,
          cued_score: h.score,
          total_items: h.total_items,
          details_json: JSON.stringify(details)
        };
      });

      const csv = json2csv(flatHistory);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `system_logs_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to generate CSV', err);
      alert('Failed to generate export data');
    }
  };

  if (isTesting) {
    return (
      <div className="min-h-screen bg-stone-50">
        <header className="bg-white border-b border-stone-200 px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-serif font-medium text-stone-900">Assessment in Progress</h1>
          <button 
            onClick={() => setIsTesting(false)}
            className="text-stone-500 hover:text-stone-900 text-sm"
          >
            Cancel
          </button>
        </header>
        <main className="container mx-auto px-4">
          <TestRunner onComplete={() => setIsTesting(false)} />
        </main>
      </div>
    );
  }

  // Ensure history is an array before slicing
  const safeHistory = Array.isArray(history) ? history : [];
  const chartData = safeHistory.slice().reverse().map(h => ({
    date: format(new Date(h.test_date), 'MMM d'),
    score: h.score,
    total: h.total_items
  }));

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      <header className="bg-white border-b border-stone-200 px-6 py-4 sticky top-0 z-10">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-stone-900 rounded-lg flex items-center justify-center shadow-sm">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-serif font-medium text-stone-900">Cognitive Tracker</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-stone-500 hidden sm:inline">Hello, {user?.username}</span>
            <button 
              onClick={logout}
              className="p-2 text-stone-400 hover:text-stone-900 transition-colors rounded-full hover:bg-stone-100"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {user?.username === 'ib_exhibition_demo' && (
          <div className="bg-amber-50/75 border border-amber-200 rounded-2xl p-4 mb-6 flex items-start gap-3 shadow-sm font-sans">
            <span className="text-xl">💡</span>
            <div>
              <h4 className="font-serif text-sm font-semibold text-stone-900">Exhibition Mode Active</h4>
              <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                To test the clinical assessment stages or skip segment timing, click <strong className="font-semibold">"New Assessment"</strong> below. Once the test initiates, the <strong className="font-semibold">Exhibition Phase Jumper menu</strong> will float in the bottom-right corner, allowing you to zip through different phases instantly!
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-stone-400" />
              <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider">Last Assessment</h3>
            </div>
            <p className="text-2xl font-serif text-stone-900">
              {safeHistory.length > 0 ? format(new Date(safeHistory[0].test_date), 'MMMM d, yyyy') : 'No data'}
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-stone-400" />
              <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider">Average Scores</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-stone-500">Free Recall</span>
                <span className="font-serif font-medium text-stone-900">
                  {safeHistory.length > 0 
                    ? (safeHistory.reduce((acc, curr) => {
                        const details = typeof curr.details === 'string' ? JSON.parse(curr.details) : curr.details;
                        return acc + (details?.freeRecallScore || 0);
                      }, 0) / safeHistory.length).toFixed(1)
                    : '-'}
                  <span className="text-stone-400 text-xs ml-1">/ 48</span>
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-stone-500">Cued Recall</span>
                <span className="font-serif font-medium text-stone-900">
                  {safeHistory.length > 0 
                    ? (safeHistory.reduce((acc, curr) => acc + curr.score, 0) / safeHistory.length).toFixed(1) 
                    : '-'} 
                  <span className="text-stone-400 text-xs ml-1">/ 48</span>
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex items-center justify-center group cursor-pointer hover:border-stone-300 transition-colors" onClick={() => setIsTesting(true)}>
            <div className="flex items-center gap-2 text-stone-900 font-medium group-hover:scale-105 transition-transform">
              <div className="w-8 h-8 bg-stone-900 text-white rounded-full flex items-center justify-center">
                <Plus className="w-5 h-5" />
              </div>
              <span>New Assessment</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-stone-200 shadow-sm mb-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-serif text-stone-900">Performance History</h3>
            <button 
              onClick={handleDownloadData}
              className="flex items-center gap-2 text-xs text-stone-400 hover:text-stone-900 uppercase tracking-wider transition-colors"
            >
              <Download className="w-4 h-4" />
              Export Data
            </button>
          </div>
          <div className="h-64 w-full">
            {safeHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E4" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#78716c', fontSize: 12 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#78716c', fontSize: 12 }} 
                    domain={[0, 48]}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#1c1917" 
                    strokeWidth={2} 
                    dot={{ fill: '#1c1917', strokeWidth: 2, r: 4 }} 
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-stone-400 bg-stone-50 rounded-xl">
                Complete your first assessment to see trends.
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-200 bg-stone-50 flex justify-between items-center">
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider">Detailed Logs</h3>
            <span className="text-xs text-stone-400">{safeHistory.length} Entries</span>
          </div>
          <div className="divide-y divide-stone-100">
            {safeHistory.map((h) => (
              <div key={h.id} className="group">
                <div 
                  className="flex items-center justify-between px-6 py-4 hover:bg-stone-50 transition-colors cursor-pointer"
                  onClick={() => toggleExpand(h.id)}
                >
                  <div className="flex items-center gap-6">
                    <div className="w-24 text-sm text-stone-600">
                      {format(new Date(h.test_date), 'MMM d, yyyy')}
                    </div>
                    <div className="w-20 text-sm text-stone-500">
                      {format(new Date(h.test_date), 'HH:mm')}
                    </div>
                    <div className="text-sm text-stone-900 font-medium">
                      {h.set_name}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-sm font-medium text-stone-900 w-16 text-right">
                      {h.score} / {h.total_items}
                    </div>
                    <div className="w-24 text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        h.score >= 10 ? 'bg-emerald-100 text-emerald-800' : 
                        h.score >= 7 ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-red-100 text-red-800'
                      }`}>
                        {h.score >= 10 ? 'Normal' : h.score >= 7 ? 'Borderline' : 'Concern'}
                      </span>
                    </div>
                    <div className="text-stone-400">
                      {expandedId === h.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>
                
                <AnimatePresence>
                  {expandedId === h.id && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-stone-50 border-t border-stone-100"
                    >
                      <div className="px-6 py-4">
                        <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">Item Analysis</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {(() => {
                            try {
                              const parsedDetails = typeof h.details === 'string' ? JSON.parse(h.details) : h.details;
                              const items = Array.isArray(parsedDetails) ? parsedDetails : (parsedDetails?.itemDetails || []);
                              if (!items || !Array.isArray(items) || items.length === 0) {
                                return <p className="text-sm text-stone-400">No details available.</p>;
                              }
                              
                              return items.map((item: any, idx: number) => {
                                const isCorrect = item.isCorrect !== undefined ? item.isCorrect : item.correct;
                                return (
                                  <div key={idx} className={`flex items-center justify-between p-3 rounded-lg border ${
                                    isCorrect ? 'bg-white border-stone-200' : 'bg-red-50 border-red-100'
                                  }`}>
                                    <div>
                                      <div className="text-xs text-stone-500">{item.category}</div>
                                      <div className="text-sm font-medium text-stone-900">{item.term}</div>
                                    </div>
                                    {isCorrect ? (
                                      <Check className="w-4 h-4 text-emerald-500" />
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-red-500 line-through">{item.userAnswer || '(empty)'}</span>
                                        <X className="w-4 h-4 text-red-500" />
                                      </div>
                                    )}
                                  </div>
                                );
                              });
                            } catch (e) {
                              return <p className="text-sm text-stone-400">Error loading details.</p>;
                            }
                          })()}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
            
            {safeHistory.length === 0 && (
              <div className="p-12 text-center">
                <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Activity className="w-6 h-6 text-stone-400" />
                </div>
                <h3 className="text-stone-900 font-medium mb-1">No assessments yet</h3>
                <p className="text-stone-500 text-sm">Complete your first memory test to start tracking.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
