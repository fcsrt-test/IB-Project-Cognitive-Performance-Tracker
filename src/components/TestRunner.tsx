import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, ArrowRight, Brain, Calculator, Clock, Target, AlertCircle } from 'lucide-react';

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

export default function TestRunner({ onComplete }: TestRunnerProps) {
  const [phase, setPhase] = useState<'intro' | 'encoding' | 'distractor' | 'free-recall' | 'recall' | 'results'>('intro');
  const [screens, setScreens] = useState<Term[][]>([]);
  const [setId, setSetId] = useState<number | null>(null);
  const [currentScreenIndex, setCurrentScreenIndex] = useState(0);
  
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
  const [freeRecallInput, setFreeRecallInput] = useState('');
  const [freeRecallList, setFreeRecallList] = useState<string[]>([]);
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

  useEffect(() => {
    fetch('/api/test/start')
      .then(res => {
        if (!res.ok) throw new Error('Failed to start test');
        return res.json();
      })
      .then(data => {
        if (data.screens && Array.isArray(data.screens) && data.screens.length > 0) {
          setScreens(data.screens);
          setSetId(data.setId);
          
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
    const top = Math.floor(Math.random() * 80) + 10 + '%';
    const left = Math.floor(Math.random() * 80) + 10 + '%';
    setTargetPosition({ top, left });
  };

  const handleTargetClick = () => {
    setDistractorScore(prev => prev + 1);
    moveTarget();
  };

  const handleIdentifyClick = (term: Term) => {
    const currentScreen = screens[currentScreenIndex];
    const targetCategory = currentScreen[currentPromptIndex].category;

    setClickedTerm(term.term);

    if (term.category === targetCategory) {
      setLastClickResult('correct');
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
      if (currentScreenIndex < screens.length - 1) {
        setCurrentScreenIndex(prev => prev + 1);
        setEncodingStep('identify');
        setCurrentPromptIndex(0);
      } else {
        setPhase('distractor');
        moveTarget();
      }
    } else {
      setVerificationError(true);
      setTimeout(() => {
        setVerificationError(false);
        setEncodingStep('identify');
        setCurrentPromptIndex(0);
      }, 2000);
    }
  };

  const handleFreeRecallAdd = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && freeRecallInput.trim()) {
      if (!freeRecallList.includes(freeRecallInput.trim().toLowerCase())) {
        setFreeRecallList(prev => [...prev, freeRecallInput.trim().toLowerCase()]);
      }
      setFreeRecallInput('');
    }
  };

  const submitFreeRecall = () => {
    // Calculate free recall score
    const allTerms = screens.flat().map(t => t.term.toLowerCase());
    let correct = 0;
    freeRecallList.forEach(word => {
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
      await fetch('/api/test/submit', {
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
        <div className="w-16 h-16 bg-zinc-100 flex items-center justify-center mx-auto mb-6">
          <Brain className="w-8 h-8 text-zinc-600" />
        </div>
        <h2 className="text-2xl font-mono font-medium text-zinc-900 mb-4 tracking-tight">Diagnostic Sequence // RI-48</h2>
        <p className="text-zinc-500 mb-8 leading-relaxed font-mono text-sm max-w-lg mx-auto">
          PROTOCOL: 12 sets of 4 items. Identification required. Immediate recall verification. Distraction task. Full recall sequence.
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
          className="bg-zinc-900 text-white px-8 py-3 rounded-none hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed font-mono text-xs uppercase tracking-widest"
        >
          {isLoading ? 'INITIALIZING...' : '[ INITIATE SEQUENCE ]'}
        </button>
      </div>
    );
  }

  // Temporary Navigator for testing
  const DevNavigator = () => (
    <div className="fixed bottom-4 right-4 bg-white border border-zinc-200 p-2 shadow-lg z-50 flex flex-col gap-2 opacity-50 hover:opacity-100 transition-opacity">
      <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Dev Nav</div>
      <button onClick={() => setPhase('intro')} className="text-[10px] text-left hover:text-zinc-900">Intro</button>
      <button onClick={() => setPhase('encoding')} className="text-[10px] text-left hover:text-zinc-900">Encoding</button>
      <button onClick={() => setPhase('distractor')} className="text-[10px] text-left hover:text-zinc-900">Distractor</button>
      <button onClick={() => setPhase('free-recall')} className="text-[10px] text-left hover:text-zinc-900">Free Recall</button>
      <button onClick={() => setPhase('recall')} className="text-[10px] text-left hover:text-zinc-900">Cued Recall</button>
      <button onClick={() => setPhase('results')} className="text-[10px] text-left hover:text-zinc-900">Results</button>
    </div>
  );

  return (
    <>
      <DevNavigator />
      {/* Render phase content */}
      {phase === 'encoding' && (
        // ... encoding content wrapper
        (() => {
          const currentScreen = screens[currentScreenIndex];
          if (!currentScreen) return <div>Error</div>;
          
          if (encodingStep === 'identify') {
            const targetCategory = currentScreen[currentPromptIndex].category;
            return (
              <div className="max-w-3xl mx-auto py-12">
                <div className="text-center mb-12">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-4">
                    Set {currentScreenIndex + 1} / {screens.length}
                  </span>
                  <h3 className="text-xl font-mono text-zinc-900">
                    TARGET: <span className="font-bold border-b-2 border-zinc-900 pb-1">{targetCategory}</span>
                  </h3>
                </div>
                
                <div className="grid grid-cols-2 gap-6 mb-12">
                  {currentScreen.map((t, idx) => {
                    const isClicked = clickedTerm === t.term;
                    let btnClass = "h-32 border-2 text-xl font-mono transition-all duration-200 ";
                    
                    if (isClicked) {
                      if (lastClickResult === 'correct') btnClass += "bg-zinc-900 border-zinc-900 text-white";
                      else if (lastClickResult === 'incorrect') btnClass += "bg-red-500 border-red-500 text-white shake";
                      else btnClass += "bg-white border-zinc-200 text-zinc-900";
                    } else {
                      btnClass += "bg-white border-zinc-200 hover:border-zinc-900 text-zinc-900 hover:shadow-none";
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
                <h3 className="text-xl font-mono text-zinc-900 mb-8 text-center uppercase tracking-widest">Immediate Verification</h3>
                {verificationError && (
                  <div className="mb-6 p-4 bg-red-50 text-red-600 border border-red-100 text-center flex items-center justify-center gap-2 font-mono text-xs">
                    <AlertCircle className="w-4 h-4" />
                    <span>VERIFICATION FAILED. RETRY.</span>
                  </div>
                )}
                <div className="space-y-4">
                  {currentScreen.map((t, idx) => (
                    <div key={idx} className="flex items-center gap-4">
                      <label className="w-1/3 text-right font-mono text-xs text-zinc-500 uppercase tracking-wider">{t.category}:</label>
                      <input
                        type="text"
                        autoComplete="off"
                        className="flex-1 p-3 bg-zinc-50 border border-zinc-200 focus:border-zinc-900 focus:outline-none font-mono text-sm"
                        value={verificationAnswers[t.category] || ''}
                        onChange={e => setVerificationAnswers(prev => ({ ...prev, [t.category]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-8 text-center">
                  <button onClick={handleVerificationSubmit} className="bg-zinc-900 text-white px-8 py-3 hover:bg-zinc-800 font-mono text-xs uppercase tracking-widest">
                    [ Verify ]
                  </button>
                </div>
              </div>
            );
          }
        })()
      )}

      {phase === 'distractor' && (
        <div className="max-w-4xl mx-auto py-12 text-center relative h-[600px] bg-zinc-50 border border-zinc-200 overflow-hidden select-none">
          <div className="absolute top-6 left-0 right-0 z-10">
            <h3 className="text-xl font-mono text-zinc-900 mb-2 uppercase tracking-widest">Cognitive Load Task</h3>
            <p className="text-zinc-500 mb-4 font-mono text-xs">ACQUIRE TARGETS RAPIDLY</p>
            <div className="text-4xl font-mono font-bold text-zinc-900">
              {distractorTimeLeft}s
            </div>
            <div className="text-xs text-zinc-400 mt-2 font-mono">HITS: {distractorScore}</div>
          </div>
          
          <motion.button
            className="absolute w-16 h-16 bg-zinc-900 flex items-center justify-center hover:bg-zinc-800 active:scale-90 transition-transform rounded-none"
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
        <div className="max-w-2xl mx-auto py-12">
          <h3 className="text-xl font-mono text-zinc-900 mb-4 text-center uppercase tracking-widest">Free Recall Phase</h3>
          <p className="text-zinc-500 mb-8 text-center font-mono text-xs">
            ENTER RETAINED ITEMS. SEQUENCE IRRELEVANT.
          </p>
          
          <div className="mb-8">
            <input
              type="text"
              value={freeRecallInput}
              onChange={e => setFreeRecallInput(e.target.value)}
              onKeyDown={handleFreeRecallAdd}
              placeholder="INPUT_TERM..."
              className="w-full p-4 text-lg bg-zinc-50 border border-zinc-200 focus:border-zinc-900 focus:outline-none font-mono"
              autoFocus
            />
          </div>

          <div className="flex flex-wrap gap-2 mb-12 min-h-[100px]">
            {freeRecallList.map((word, idx) => (
              <span key={idx} className="bg-zinc-100 text-zinc-800 px-3 py-1 text-xs font-mono border border-zinc-200">
                {word}
              </span>
            ))}
          </div>

          <div className="text-center">
            <button
              onClick={submitFreeRecall}
              className="bg-zinc-900 text-white px-8 py-3 hover:bg-zinc-800 font-mono text-xs uppercase tracking-widest"
            >
              [ COMPLETE PHASE ]
            </button>
          </div>
        </div>
      )}

      {phase === 'recall' && (
        <div className="max-w-4xl mx-auto py-12">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-mono text-zinc-900 uppercase tracking-widest">Cued Recall Phase</h3>
            <div className="flex items-center gap-2 text-zinc-500">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-mono">UNTIMED</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {Object.keys(recallAnswers).sort().map(cat => (
              <div key={cat} className="bg-white p-6 border border-zinc-200">
                <h4 className="font-bold text-zinc-900 mb-4 font-mono text-sm uppercase tracking-wider">{cat}</h4>
                <div className="space-y-3">
                  {[0, 1, 2, 3].map(i => (
                    <input
                      key={i}
                      type="text"
                      autoComplete="off"
                      placeholder={`ITEM_0${i + 1}`}
                      className="w-full p-2 bg-zinc-50 border border-zinc-200 focus:border-zinc-900 focus:outline-none text-sm font-mono"
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
              className="bg-zinc-900 text-white px-12 py-4 text-sm font-mono uppercase tracking-widest hover:bg-zinc-800 disabled:opacity-50"
            >
              {isSubmitting ? 'PROCESSING...' : '[ SUBMIT DATA ]'}
            </button>
          </div>
        </div>
      )}

      {phase === 'results' && (
        <div className="max-w-2xl mx-auto py-12 text-center">
          <div className={`w-24 h-24 flex items-center justify-center mx-auto mb-6 border-2 ${
            score <= 16 ? 'bg-red-50 border-red-500 text-red-700' : 'bg-zinc-50 border-zinc-900 text-zinc-900'
          }`}>
            <span className="text-4xl font-mono font-bold">{score}</span>
          </div>
          
          <h3 className="text-xl font-mono text-zinc-900 mb-2 uppercase tracking-widest">Sequence Complete</h3>
          <p className="text-sm font-mono mb-8">
            STATUS: {getInterpretation(freeRecallScore, score).status}
          </p>

          <div className="grid grid-cols-2 gap-4 mb-8 text-left">
            <div className="bg-white p-4 border border-zinc-200">
              <div className="text-zinc-400 text-[10px] uppercase tracking-widest mb-1">Free Recall</div>
              <div className="text-2xl font-mono text-zinc-900">{freeRecallScore} / 48</div>
            </div>
            <div className="bg-white p-4 border border-zinc-200">
              <div className="text-zinc-400 text-[10px] uppercase tracking-widest mb-1">Total Recall</div>
              <div className="text-2xl font-mono text-zinc-900">{score} / 48</div>
            </div>
            <div className="bg-white p-4 border border-zinc-200">
              <div className="text-zinc-400 text-[10px] uppercase tracking-widest mb-1">Intrusions</div>
              <div className="text-2xl font-mono text-zinc-900">{intrusionCount}</div>
            </div>
            <div className="bg-white p-4 border border-zinc-200">
              <div className="text-zinc-400 text-[10px] uppercase tracking-widest mb-1">Latency</div>
              <div className="text-2xl font-mono text-zinc-900">{(latency / 1000).toFixed(1)}s</div>
            </div>
          </div>

          <button
            onClick={onComplete}
            className="inline-flex items-center gap-2 bg-zinc-900 text-white px-6 py-3 hover:bg-zinc-800 transition-colors font-mono text-xs uppercase tracking-widest"
          >
            <span>[ Return to Portal ]</span>
          </button>
        </div>
      )}
    </>
  );
}

