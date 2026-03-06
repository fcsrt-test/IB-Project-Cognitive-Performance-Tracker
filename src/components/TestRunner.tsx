import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, Target, Clock, AlertCircle, CheckCircle2, XCircle, Sparkles, MessageSquare } from 'lucide-react';
import Survey from './Survey';

interface Term {
  category: string;
  term: string;
}

interface TestRunnerProps {
  onComplete: () => void;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0)
  );

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

function isCloseEnough(input: string, target: string): boolean {
  const cleanInput = input.trim().toLowerCase();
  const cleanTarget = target.trim().toLowerCase();
  if (!cleanInput || !cleanTarget) return false;
  if (cleanInput === cleanTarget) return true;
  
  const distance = levenshteinDistance(cleanInput, cleanTarget);
  if (cleanTarget.length > 6) return distance <= 2;
  if (cleanTarget.length > 3) return distance <= 1;
  return false;
}

function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

const playSound = (type: 'correct' | 'incorrect' | 'celebration' | 'jumpscare') => {
  try {
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'correct') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.1); // C6
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'incorrect') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'celebration') {
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
        g.gain.setValueAtTime(0.05, ctx.currentTime + i * 0.1);
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.3);
        o.start(ctx.currentTime + i * 0.1);
        o.stop(ctx.currentTime + i * 0.1 + 0.3);
      });
    } else if (type === 'jumpscare') {
      // Clanging pipes / metallic crash sound
      const duration = 2.0;
      const sampleRate = ctx.sampleRate;
      const bufferSize = sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        // White noise mixed with some metallic resonance
        const t = i / sampleRate;
        const noise = Math.random() * 2 - 1;
        const resonance = Math.sin(2 * Math.PI * 440 * t) * Math.exp(-5 * t) +
                          Math.sin(2 * Math.PI * 880 * t) * Math.exp(-10 * t);
        data[i] = (noise * 0.5 + resonance * 0.5) * Math.exp(-2 * t);
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const jumpscareGain = ctx.createGain();
      jumpscareGain.gain.setValueAtTime(1.0, ctx.currentTime); // LOUD
      source.connect(jumpscareGain);
      jumpscareGain.connect(ctx.destination);
      source.start();
    }
  } catch (e) {
    console.warn('Audio feedback failed', e);
  }
};

export default function TestRunner({ onComplete }: TestRunnerProps) {
  const [phase, setPhase] = useState<'intro' | 'encoding' | 'distractor' | 'free-recall' | 'recall' | 'results' | 'survey'>('intro');
  const [screens, setScreens] = useState<Term[][]>([]);
  const [setId, setSetId] = useState<number | null>(null);
  const [resultId, setResultId] = useState<number | null>(null);
  const [currentScreenIndex, setCurrentScreenIndex] = useState(0);
  const [promptOrder, setPromptOrder] = useState<number[]>([0, 1, 2, 3]);
  
  // Encoding Phase State
  const [encodingStep, setEncodingStep] = useState<'identify' | 'verify'>('identify');
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [verificationAnswers, setVerificationAnswers] = useState<Record<string, string>>({});
  const [verificationError, setVerificationError] = useState(false);
  const [lastClickResult, setLastClickResult] = useState<'correct' | 'incorrect' | null>(null);
  const [clickedTerm, setClickedTerm] = useState<string | null>(null);

  // Distractor Phase State
  const [distractorTimeLeft, setDistractorTimeLeft] = useState(20);
  const [distractorScore, setDistractorScore] = useState(0);
  const [targetPosition, setTargetPosition] = useState({ top: '50%', left: '50%' });

  // Free Recall Phase State
  const [freeRecallList, setFreeRecallList] = useState<string[]>(Array(48).fill(''));
  const [freeRecallScore, setFreeRecallScore] = useState(0);

  // Recall Phase State
  const [recallAnswers, setRecallAnswers] = useState<Record<string, string[]>>({}); // Category -> Array of 4 answers
  const [recallStartTime, setRecallStartTime] = useState<number>(0);
  const [latency, setLatency] = useState<number>(0);

  // General State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState(0); // Cued recall score
  const [intrusionCount, setIntrusionCount] = useState(0);

  // Easter Egg State
  const [powerupActive, setPowerupActive] = useState(false);
  const [showJumpscare, setShowJumpscare] = useState(false);
  const [konamiIndex, setKonamiIndex] = useState(0);
  const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === konamiCode[konamiIndex]) {
        const nextIndex = konamiIndex + 1;
        if (nextIndex === konamiCode.length) {
          setPowerupActive(true);
          setKonamiIndex(0);
          playSound('celebration');
          setFeedback({
            id: ++feedbackIdCounter.current,
            type: 'streak',
            text: 'POWERUP ACTIVATED ⚡'
          });
          setTimeout(() => setFeedback(null), 2000);
        } else {
          setKonamiIndex(nextIndex);
        }
      } else {
        setKonamiIndex(0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [konamiIndex]);

  useEffect(() => {
    if (powerupActive && !showJumpscare && (phase === 'encoding' || phase === 'distractor')) {
      const triggerJumpscare = () => {
        setShowJumpscare(true);
        playSound('jumpscare');
        setTimeout(() => setShowJumpscare(false), 800);
      };

      // Randomly trigger every 15-45 seconds
      const timeout = setTimeout(triggerJumpscare, Math.random() * 30000 + 15000);
      return () => clearTimeout(timeout);
    }
  }, [powerupActive, showJumpscare, phase]);

  // Feedback State
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState<{ id: number; type: 'correct' | 'incorrect' | 'streak'; text: string } | null>(null);
  const feedbackIdCounter = useRef(0);

  const triggerFeedback = (type: 'correct' | 'incorrect') => {
    if (type === 'correct') {
      const newStreak = streak + 1;
      setStreak(newStreak);
      playSound('correct');
      
      if (newStreak > 0 && newStreak % 4 === 0) {
        playSound('celebration');
        setFeedback({
          id: ++feedbackIdCounter.current,
          type: 'streak',
          text: `${newStreak} IN A ROW! 🔥`
        });
      } else {
        const compliments = ['Great!', 'Nice!', 'Awesome!', 'Spot on!', 'Perfect!'];
        setFeedback({
          id: ++feedbackIdCounter.current,
          type: 'correct',
          text: compliments[Math.floor(Math.random() * compliments.length)]
        });
      }
    } else {
      setStreak(0);
      playSound('incorrect');
      setFeedback({
        id: ++feedbackIdCounter.current,
        type: 'incorrect',
        text: 'Not quite'
      });
    }

    setTimeout(() => setFeedback(null), 1500);
  };

  useEffect(() => {
    fetch('/api/test/start')
      .then(res => {
        if (!res.ok) throw new Error('Failed to start test');
        return res.json();
      })
      .then(data => {
        if (data.screens && Array.isArray(data.screens) && data.screens.length > 0) {
          // Shuffle terms within each screen
          const shuffledScreens = data.screens.map((screen: Term[]) => shuffleArray(screen));
          setScreens(shuffledScreens);
          setSetId(data.setId);
          
          // Initialize prompt order for the first screen
          setPromptOrder(shuffleArray([0, 1, 2, 3]));
          
          // Initialize recall answers structure
          const cats: Record<string, string[]> = {};
          data.screens.flat().forEach((t: Term) => {
            if (!cats[t.category]) cats[t.category] = ['', '', '', ''];
          });
          setRecallAnswers(cats);
        } else {
          throw new Error('Invalid test data received');
        }
      })
      .catch(err => {
        console.error(err);
        setError('Failed to load assessment. Please try again.');
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Distractor Timer & Game Logic
  useEffect(() => {
    if (phase === 'distractor') {
      const timer = setInterval(() => {
        setDistractorTimeLeft(prev => {
          if (prev <= 1) {
            // Only proceed if score is sufficient (e.g. > 5 clicks)
            // But we can't block indefinitely if they are just slow. 
            // Let's just reset timer if score is too low? Or just proceed.
            // Prompt says "do not continue until the user participates enough".
            // We'll check score in the interval.
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [phase]);

  // Check distractor completion
  useEffect(() => {
    if (phase === 'distractor' && distractorTimeLeft === 0) {
      if (distractorScore >= 5) {
        setPhase('free-recall');
      } else {
        // Reset timer to force participation
        setDistractorTimeLeft(10);
        alert("Please participate in the task! Click the targets.");
      }
    }
  }, [distractorTimeLeft, phase, distractorScore]);

  const moveTarget = () => {
    // Avoid top 30% where header is, and keep away from edges
    const top = Math.floor(Math.random() * 50) + 40 + '%'; 
    const left = Math.floor(Math.random() * 80) + 10 + '%';
    setTargetPosition({ top, left });
  };

  const handleTargetClick = () => {
    setDistractorScore(prev => prev + 1);
    moveTarget();
  };

  const handleIdentifyClick = (term: Term) => {
    const currentScreen = screens[currentScreenIndex];
    const targetCategory = currentScreen[promptOrder[currentPromptIndex]].category;

    setClickedTerm(term.term);

    if (term.category === targetCategory) {
      setLastClickResult('correct');
      triggerFeedback('correct');
      setTimeout(() => {
        setLastClickResult(null);
        setClickedTerm(null);
        if (currentPromptIndex < 3) {
          setCurrentPromptIndex(prev => prev + 1);
        } else {
          setEncodingStep('verify');
          setVerificationAnswers({});
          setVerificationError(false);
        }
      }, 500);
    } else {
      setLastClickResult('incorrect');
      triggerFeedback('incorrect');
      setTimeout(() => {
        setLastClickResult(null);
        setClickedTerm(null);
      }, 500);
    }
  };

  const handleVerificationSubmit = () => {
    const currentScreen: Term[] = screens[currentScreenIndex];
    let allCorrect = true;

    currentScreen.forEach(t => {
      const ans = verificationAnswers[t.category] || '';
      if (!isCloseEnough(ans, t.term)) {
        allCorrect = false;
      }
    });

    if (allCorrect) {
      triggerFeedback('correct');
      if (currentScreenIndex < screens.length - 1) {
        setCurrentScreenIndex(prev => prev + 1);
        setPromptOrder(shuffleArray([0, 1, 2, 3]));
        setEncodingStep('identify');
        setCurrentPromptIndex(0);
      } else {
        setPhase('distractor');
        moveTarget();
      }
    } else {
      setVerificationError(true);
      triggerFeedback('incorrect');
      setTimeout(() => {
        setVerificationError(false);
        setEncodingStep('identify');
        setCurrentPromptIndex(0);
      }, 2000);
    }
  };

  const submitFreeRecall = () => {
    // Calculate free recall score
    const allTerms = screens.flat().map(t => t.term.toLowerCase());
    let correct = 0;
    const uniqueAnswers = Array.from(new Set(freeRecallList.map(w => w.trim().toLowerCase()).filter(w => w !== '')));
    
    uniqueAnswers.forEach((word: string) => {
      if (allTerms.some(term => isCloseEnough(word, term))) correct++;
    });
    setFreeRecallScore(correct);
    setPhase('recall');
    setRecallStartTime(Date.now());
  };

  const handleFinalSubmit = async () => {
    const endTime = Date.now();
    const totalLatency = endTime - recallStartTime;
    setLatency(totalLatency);

    let correctCount = 0;
    let intrusions = 0;
    const details: any[] = [];
    
    const allTermsData = screens.flat();
    
    Object.entries(recallAnswers).forEach(([category, answers]: [string, string[]]) => {
      answers.forEach(ans => {
        const cleanAns = ans.trim().toLowerCase();
        if (!cleanAns) return;

        // Find if this answer matches any term in the correct category
        const targetTermsInCategory = allTermsData.filter(t => t.category === category);
        const matchedTerm = targetTermsInCategory.find(t => isCloseEnough(cleanAns, t.term));

        if (matchedTerm) {
          correctCount++;
          details.push({ term: matchedTerm.term, category, isCorrect: true, userAnswer: cleanAns });
        } else {
          // Check if it's a term from another category
          const crossCategoryMatch = allTermsData.find(t => isCloseEnough(cleanAns, t.term));
          if (crossCategoryMatch) {
            details.push({ term: crossCategoryMatch.term, category, isCorrect: false, note: 'Wrong category', userAnswer: cleanAns });
          } else {
            intrusions++;
            details.push({ term: cleanAns, category, isCorrect: false, note: 'Intrusion', userAnswer: cleanAns });
          }
        }
      });
    });

    setScore(correctCount);
    setIntrusionCount(intrusions);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/test/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setId,
          score: correctCount,
          totalItems: 48,
          details,
          latency: totalLatency,
          intrusionCount: intrusions,
          freeRecallScore
        })
      });
      const data = await res.json();
      if (data.id) setResultId(data.id);
      setPhase('results');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInterpretation = (free: number, total: number) => {
    if (total <= 16) return { status: 'Impaired Total Recall (Amnestic MCI)', color: 'text-red-700', bg: 'bg-red-100' };
    if (total <= 43) return { status: 'Borderline Total Recall (Preclinical Risk)', color: 'text-yellow-700', bg: 'bg-yellow-100' };
    if (free <= 24) return { status: 'Impaired Free Recall (Retrieval Deficit)', color: 'text-orange-700', bg: 'bg-orange-100' };
    return { status: 'Normal Memory Function', color: 'text-emerald-700', bg: 'bg-emerald-100' };
  };

  if (isLoading) return <div className="py-12 text-center">Loading assessment...</div>;
  if (error) return <div className="py-12 text-center text-red-600">{error}</div>;

  if (phase === 'intro') {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="w-16 h-16 bg-stone-100 flex items-center justify-center mx-auto mb-6 rounded-2xl">
          <Brain className="w-8 h-8 text-stone-600" />
        </div>
        <h2 className="text-3xl font-serif font-medium text-stone-900 mb-4 tracking-tight">Memory Assessment (RI-48)</h2>
        <p className="text-stone-500 mb-8 leading-relaxed text-sm max-w-lg mx-auto">
          This assessment consists of 12 sets of 4 items. You will be asked to identify items by category, verify them, and later recall them after a brief distraction task.
        </p>
        <button
          onClick={() => {
            if (screens.length > 0) {
              setPhase('encoding');
            } else {
              setError('Assessment data not loaded. Please refresh.');
            }
          }}
          disabled={isLoading || !!error}
          className="bg-stone-900 text-white px-10 py-4 rounded-xl hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all shadow-sm"
        >
          {isLoading ? 'Loading...' : 'Start Assessment'}
        </button>
      </div>
    );
  }

  // Temporary Navigator for testing
  const DevNavigator = () => (
    <div className="fixed bottom-4 right-4 bg-white border border-stone-200 p-3 shadow-xl z-50 flex flex-col gap-2 opacity-30 hover:opacity-100 transition-opacity rounded-xl">
      <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Debug Menu</div>
      <button onClick={() => setPhase('intro')} className="text-[10px] text-left hover:text-stone-900">Intro</button>
      <button onClick={() => setPhase('encoding')} className="text-[10px] text-left hover:text-stone-900">Encoding</button>
      <button onClick={() => setPhase('distractor')} className="text-[10px] text-left hover:text-stone-900">Distractor</button>
      <button onClick={() => setPhase('free-recall')} className="text-[10px] text-left hover:text-stone-900">Free Recall</button>
      <button onClick={() => setPhase('recall')} className="text-[10px] text-left hover:text-stone-900">Cued Recall</button>
      <button onClick={() => setPhase('results')} className="text-[10px] text-left hover:text-stone-900">Results</button>
    </div>
  );

  return (
    <>
      <DevNavigator />
      
      {/* Jumpscare Overlay */}
      <AnimatePresence>
        {showJumpscare && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black flex items-center justify-center overflow-hidden"
          >
            <img 
              src="https://picsum.photos/seed/nightmare/1920/1080?grayscale" 
              className="w-full h-full object-cover filter contrast-200 brightness-150"
              alt="Jumpscare"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feedback Overlay */}
      <AnimatePresence mode="wait">
        {feedback && (
          <motion.div
            key={feedback.id}
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: -40, scale: 1.2 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] pointer-events-none"
          >
            <div className={`
              px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 font-serif text-2xl font-bold
              ${feedback.type === 'streak' ? 'bg-amber-500 text-white ring-4 ring-amber-200' : 
                feedback.type === 'correct' ? 'bg-stone-900 text-white' : 
                'bg-stone-100 text-stone-500 border border-stone-200'}
            `}>
              {feedback.type === 'streak' && <Sparkles className="w-8 h-8 animate-pulse" />}
              {feedback.type === 'correct' && <CheckCircle2 className="w-8 h-8 text-emerald-400" />}
              {feedback.type === 'incorrect' && <XCircle className="w-8 h-8 text-stone-400" />}
              <span>{feedback.text}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Render phase content */}
      {phase === 'encoding' && (
        // ... encoding content wrapper
        (() => {
          const currentScreen = screens[currentScreenIndex];
          if (!currentScreen) return <div>Error</div>;
          
          if (encodingStep === 'identify') {
            const targetCategory = currentScreen[promptOrder[currentPromptIndex]].category;
            return (
              <div className="max-w-3xl mx-auto py-12">
                <div className="text-center mb-12">
                  <span className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-4">
                    Set {currentScreenIndex + 1} of {screens.length}
                  </span>
                  <h3 className="text-2xl font-serif text-stone-900">
                    Please identify the: <span className="font-bold border-b-2 border-stone-900 pb-1">{targetCategory}</span>
                  </h3>
                </div>
                
                <div className="grid grid-cols-2 gap-6 mb-12">
                  {currentScreen.map((t, idx) => {
                    const isClicked = clickedTerm === t.term;
                    let btnClass = "h-32 border-2 text-2xl font-serif transition-all duration-200 rounded-2xl ";
                    
                    if (isClicked) {
                      if (lastClickResult === 'correct') btnClass += "bg-stone-900 border-stone-900 text-white";
                      else if (lastClickResult === 'incorrect') btnClass += "bg-red-500 border-red-500 text-white shake";
                      else btnClass += "bg-white border-stone-200 text-stone-900";
                    } else {
                      btnClass += "bg-white border-stone-200 hover:border-stone-900 text-stone-900 hover:shadow-md";
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => handleIdentifyClick(t)}
                        className={btnClass}
                      >
                        {t.term}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          }
          
          if (encodingStep === 'verify') {
             return (
              <div className="max-w-xl mx-auto py-12">
                <h3 className="text-2xl font-serif text-stone-900 mb-8 text-center">Immediate Verification</h3>
                {verificationError && (
                  <div className="mb-6 p-4 bg-red-50 text-red-600 border border-red-100 rounded-xl text-center flex items-center justify-center gap-2 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>Verification failed. Please try again.</span>
                  </div>
                )}
                <div className="space-y-4">
                  {currentScreen.map((t, idx) => (
                    <div key={idx} className="flex items-center gap-4">
                      <label className="w-1/3 text-right text-sm text-stone-500 font-medium">{t.category}:</label>
                      <input
                        type="text"
                        autoComplete="off"
                        className="flex-1 p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400 focus:outline-none text-sm"
                        value={verificationAnswers[t.category] || ''}
                        onChange={e => setVerificationAnswers(prev => ({ ...prev, [t.category]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-8 text-center">
                  <button onClick={handleVerificationSubmit} className="bg-stone-900 text-white px-10 py-3 rounded-xl hover:bg-stone-800 font-medium transition-all shadow-sm">
                    Verify Answers
                  </button>
                </div>
              </div>
            );
          }
        })()
      )}

      {phase === 'distractor' && (
        <div className="max-w-4xl mx-auto py-12 text-center relative h-[600px] bg-stone-50 border border-stone-200 rounded-3xl shadow-inner overflow-hidden select-none">
          <div className="absolute top-8 left-0 right-0 z-10">
            <h3 className="text-2xl font-serif text-stone-900 mb-2">Focus Task</h3>
            <p className="text-stone-500 mb-4 text-sm">Please click the targets as they appear.</p>
            <div className="text-5xl font-serif font-bold text-stone-900">
              {distractorTimeLeft}s
            </div>
            <div className="text-sm text-stone-400 mt-2 font-medium">Score: {distractorScore}</div>
          </div>
          
          <motion.button
            className="absolute w-16 h-16 bg-stone-900 flex items-center justify-center hover:bg-stone-800 active:scale-90 transition-transform rounded-2xl shadow-lg z-20"
            style={{ top: targetPosition.top, left: targetPosition.left }}
            onClick={handleTargetClick}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Target className="w-8 h-8 text-white" />
          </motion.button>
        </div>
      )}

      {phase === 'free-recall' && (
        <div className="max-w-4xl mx-auto py-12">
          <h3 className="text-3xl font-serif text-stone-900 mb-4 text-center">Free Recall</h3>
          <p className="text-stone-500 mb-8 text-center text-sm">
            Please enter as many items as you can remember in any order.
          </p>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-12">
            {freeRecallList.map((word, idx) => (
              <div key={idx} className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-stone-300 font-mono">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <input
                  type="text"
                  value={word}
                  onChange={e => {
                    const newList = [...freeRecallList];
                    newList[idx] = e.target.value;
                    setFreeRecallList(newList);
                  }}
                  className="w-full pl-8 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400 focus:outline-none text-sm"
                  autoComplete="off"
                />
              </div>
            ))}
          </div>

          <div className="text-center">
            <button
              onClick={submitFreeRecall}
              className="bg-stone-900 text-white px-10 py-4 rounded-xl hover:bg-stone-800 font-medium transition-all shadow-sm"
            >
              Finish Free Recall
            </button>
          </div>
        </div>
      )}

      {phase === 'recall' && (
        <div className="max-w-4xl mx-auto py-12">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-3xl font-serif text-stone-900">Cued Recall</h3>
            <div className="flex items-center gap-2 text-stone-500">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Untimed</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {Object.keys(recallAnswers).sort().map(cat => (
              <div key={cat} className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
                <h4 className="font-bold text-stone-900 mb-4 text-sm uppercase tracking-wider">{cat}</h4>
                <div className="space-y-3">
                  {[0, 1, 2, 3].map(i => (
                    <input
                      key={i}
                      type="text"
                      autoComplete="off"
                      placeholder={`Item ${i + 1}`}
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400 focus:outline-none text-sm"
                      value={recallAnswers[cat][i]}
                      onChange={e => {
                        const newAns = [...recallAnswers[cat]];
                        newAns[i] = e.target.value;
                        setRecallAnswers(prev => ({ ...prev, [cat]: newAns }));
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center pb-12">
            <button
              onClick={handleFinalSubmit}
              disabled={isSubmitting}
              className="bg-stone-900 text-white px-12 py-4 rounded-xl font-medium hover:bg-stone-800 disabled:opacity-50 transition-all shadow-md"
            >
              {isSubmitting ? 'Processing...' : 'Submit Assessment'}
            </button>
          </div>
        </div>
      )}

      {phase === 'results' && (
        <div className="max-w-2xl mx-auto py-12 text-center">
          <div className={`w-24 h-24 flex items-center justify-center mx-auto mb-6 rounded-3xl border-2 shadow-lg ${
            score <= 16 ? 'bg-red-50 border-red-500 text-red-700' : 'bg-stone-50 border-stone-900 text-stone-900'
          }`}>
            <span className="text-4xl font-serif font-bold">{score}</span>
          </div>
          
          <h3 className="text-3xl font-serif text-stone-900 mb-2">Assessment Complete</h3>
          <p className="text-lg font-medium mb-8 text-stone-600">
            {getInterpretation(freeRecallScore, score).status}
          </p>

          <div className="grid grid-cols-2 gap-4 mb-8 text-left">
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
              <div className="text-stone-400 text-xs font-bold uppercase tracking-widest mb-1">Free Recall</div>
              <div className="text-2xl font-serif text-stone-900">{freeRecallScore} / 48</div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
              <div className="text-stone-400 text-xs font-bold uppercase tracking-widest mb-1">Total Recall</div>
              <div className="text-2xl font-serif text-stone-900">{score} / 48</div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
              <div className="text-stone-400 text-xs font-bold uppercase tracking-widest mb-1">Intrusions</div>
              <div className="text-2xl font-serif text-stone-900">{intrusionCount}</div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
              <div className="text-stone-400 text-xs font-bold uppercase tracking-widest mb-1">Latency</div>
              <div className="text-2xl font-serif text-stone-900">{(latency / 1000).toFixed(1)}s</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => setPhase('survey')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-stone-900 text-white px-8 py-4 rounded-xl hover:bg-stone-800 transition-all font-medium shadow-md"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Provide Feedback</span>
            </button>
            <button
              onClick={onComplete}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-stone-600 border border-stone-200 px-8 py-4 rounded-xl hover:bg-stone-50 transition-all font-medium"
            >
              <span>Return to Dashboard</span>
            </button>
          </div>
        </div>
      )}

      {phase === 'survey' && (
        <div className="py-12">
          <Survey resultId={resultId || undefined} onComplete={onComplete} />
        </div>
      )}
    </>
  );
}

