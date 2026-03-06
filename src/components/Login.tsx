import { useState, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Download, X, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { json2csv } from 'json-2-csv';

export default function Login() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  // Maintenance Portal State
  const [showMaintenance, setShowMaintenance] = useState(false);
  const [maintenancePass, setMaintenancePass] = useState('');
  const [maintenanceError, setMaintenanceError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    
    const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        console.error('Non-JSON response:', text);
        throw new Error(`Server error: ${res.status}. Please check backend logs.`);
      }

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }
      
      login(data.user);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleMaintenanceLogin = async (e: FormEvent) => {
    e.preventDefault();
    setMaintenanceError('');

    if (maintenancePass === 'admin123') {
      setMaintenanceSuccess(true);
    } else {
      setMaintenanceError('Invalid Access Code');
    }
  };

  const [maintenanceSuccess, setMaintenanceSuccess] = useState(false);

  const downloadData = (type: 'results' | 'surveys') => {
    const secret = 'researcher-access-key';
    const endpoint = type === 'results' ? '/api/admin/export' : '/api/admin/export-surveys';
    window.location.href = `${endpoint}?secret=${secret}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-2xl shadow-sm border border-stone-200 w-full max-w-md"
      >
        <h1 className="text-3xl font-serif font-medium text-stone-900 mb-2 tracking-tight">
          {isRegistering ? 'Create Account' : 'Welcome Back'}
        </h1>
        <p className="text-stone-500 mb-8 text-sm">
          {isRegistering 
            ? 'Begin your cognitive tracking journey.' 
            : 'Sign in to continue your assessment.'}
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400 transition-all"
              required
            />
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400 transition-all"
              required
            />
          </div>
          
          {error && (
            <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg border border-red-100">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            className="w-full bg-stone-900 text-white py-3.5 rounded-xl font-medium hover:bg-stone-800 transition-colors shadow-sm"
          >
            {isRegistering ? 'Create Account' : 'Sign In'}
          </button>
        </form>
        
        <div className="mt-8 text-center space-y-6">
          <button
            onClick={() => setIsRegistering(!isRegistering)}
            className="block w-full text-stone-500 text-sm hover:text-stone-900 transition-colors"
          >
            {isRegistering ? 'Already have an account? Sign in' : "Don't have an account? Register"}
          </button>
          
          <div className="pt-6 border-t border-stone-100">
            <button 
              onClick={() => setShowMaintenance(true)}
              className="text-xs text-stone-300 hover:text-stone-500 transition-colors flex items-center justify-center gap-2 mx-auto"
            >
              <Lock className="w-3 h-3" />
              <span>Maintenance Portal</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Maintenance Portal Modal */}
      <AnimatePresence>
        {showMaintenance && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/20 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm border border-stone-200"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-serif text-lg text-stone-900">Maintenance Access</h3>
                <button onClick={() => { setShowMaintenance(false); setMaintenanceSuccess(false); setMaintenancePass(''); }} className="text-stone-400 hover:text-stone-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {!maintenanceSuccess ? (
                <form onSubmit={handleMaintenanceLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Access Code</label>
                    <input
                      type="password"
                      value={maintenancePass}
                      onChange={(e) => setMaintenancePass(e.target.value)}
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400 transition-all"
                      placeholder="Enter code..."
                      autoFocus
                    />
                  </div>
                  
                  {maintenanceError && (
                    <div className="text-red-500 text-xs bg-red-50 p-2 rounded-lg">
                      {maintenanceError}
                    </div>
                  )}
                  
                  <button
                    type="submit"
                    className="w-full bg-stone-900 text-white py-3 rounded-xl font-medium hover:bg-stone-800 transition-colors flex items-center justify-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Verify Access</span>
                  </button>
                </form>
              ) : (
                <div className="space-y-3">
                  <p className="text-stone-500 text-sm mb-4">Select the data you wish to export as CSV.</p>
                  <button
                    onClick={() => downloadData('results')}
                    className="w-full bg-stone-900 text-white py-3 rounded-xl font-medium hover:bg-stone-800 transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Test Results</span>
                  </button>
                  <button
                    onClick={() => downloadData('surveys')}
                    className="w-full bg-stone-100 text-stone-900 py-3 rounded-xl font-medium hover:bg-stone-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Download Survey Data</span>
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
