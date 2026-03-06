import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, ArrowRight, ArrowLeft, Heart, Clock, Lightbulb, MessageSquare } from 'lucide-react';

interface SurveyProps {
  resultId?: number;
  onComplete: () => void;
}

type Section = 'intro' | 'demographics' | 'experience' | 'feedback' | 'thanks';

export default function Survey({ resultId, onComplete }: SurveyProps) {
  const [section, setSection] = useState<Section>('intro');
  const [formData, setFormData] = useState({
    age_group: '',
    previous_test: '',
    q_instructions: 0,
    q_tasks: 0,
    q_comfort: 0,
    q_length: 0,
    q_language: 0,
    q_visuals: 0,
    q_comparison: 0,
    q_recommend: 0,
    test_duration: '',
    liked_most: '',
    liked_least: '',
    suggestions: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (field: keyof typeof formData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await fetch('/api/survey/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, result_id: resultId }),
      });
      setSection('thanks');
    } catch (error) {
      console.error('Failed to submit survey', error);
      // Still show thanks to not block user
      setSection('thanks');
    } finally {
      setIsSubmitting(false);
    }
  };

  const LikertScale = ({ label, field, icon: Icon }: { label: string, field: keyof typeof formData, icon: any }) => (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-stone-400" />
        <label className="text-stone-700 font-medium">{label}</label>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((val) => (
          <button
            key={val}
            onClick={() => updateField(field, val)}
            className={`py-3 rounded-xl border-2 transition-all ${
              formData[field] === val
                ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                : 'bg-white border-stone-100 text-stone-400 hover:border-stone-200'
            }`}
          >
            <span className="block text-lg font-bold">{val}</span>
            <span className="text-[10px] uppercase tracking-tighter opacity-60">
              {val === 1 ? 'Disagree' : val === 5 ? 'Agree' : ''}
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderSection = () => {
    switch (section) {
      case 'intro':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-8"
          >
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <MessageSquare className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-serif font-medium text-stone-900 mb-4">Your Thoughts Matter</h2>
            <p className="text-stone-600 mb-8 leading-relaxed">
              Thank you for completing the memory screening test! Your honest answers will help improve it for others. This short survey takes about 3–5 minutes.
            </p>
            <button
              onClick={() => setSection('demographics')}
              className="w-full py-4 bg-stone-900 text-white rounded-2xl font-medium hover:bg-stone-800 transition-colors flex items-center justify-center gap-2"
            >
              Start Survey <ArrowRight className="w-4 h-4" />
            </button>
            <button 
              onClick={onComplete}
              className="mt-4 text-stone-400 hover:text-stone-600 text-sm font-medium"
            >
              Skip for now
            </button>
          </motion.div>
        );

      case 'demographics':
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
            <h3 className="text-xl font-serif font-medium text-stone-900">Section 1: About You</h3>
            
            <div>
              <label className="block text-sm font-semibold text-stone-500 uppercase tracking-wider mb-4">What is your age group?</label>
              <div className="grid grid-cols-1 gap-2">
                {['Under 40', '40–59', '60–74', '75 or older', 'Prefer not to say'].map(age => (
                  <button
                    key={age}
                    onClick={() => updateField('age_group', age)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      formData.age_group === age
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                        : 'bg-white border-stone-100 text-stone-600 hover:border-stone-200'
                    }`}
                  >
                    {age}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-stone-500 uppercase tracking-wider mb-4">Have you ever taken a standard memory test before (like MMSE or MoCA)?</label>
              <div className="grid grid-cols-1 gap-2">
                {['Yes', 'No', 'Not sure'].map(ans => (
                  <button
                    key={ans}
                    onClick={() => updateField('previous_test', ans)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      formData.previous_test === ans
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                        : 'bg-white border-stone-100 text-stone-600 hover:border-stone-200'
                    }`}
                  >
                    {ans}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setSection('intro')}
                className="flex-1 py-4 border-2 border-stone-100 text-stone-600 rounded-2xl font-medium hover:bg-stone-50 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={() => setSection('experience')}
                disabled={!formData.age_group || !formData.previous_test}
                className="flex-[2] py-4 bg-stone-900 text-white rounded-2xl font-medium hover:bg-stone-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                Next Section <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        );

      case 'experience':
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-2"
          >
            <h3 className="text-xl font-serif font-medium text-stone-900 mb-6">Section 2: Your Experience</h3>
            <p className="text-stone-500 text-sm mb-8">Rate from 1 (Strongly Disagree) to 5 (Strongly Agree)</p>
            
            <LikertScale label="The instructions were clear and easy to understand." field="q_instructions" icon={Lightbulb} />
            <LikertScale label="The questions and tasks were easy to follow and complete." field="q_tasks" icon={CheckCircle2} />
            <LikertScale label="The test felt comfortable and not too stressful." field="q_comfort" icon={Heart} />
            <LikertScale label="The test was shorter and quicker than I expected." field="q_length" icon={Clock} />
            <LikertScale label="The language used was simple and straightforward." field="q_language" icon={MessageSquare} />
            <LikertScale label="The visual aids helped me understand and complete the test." field="q_visuals" icon={Lightbulb} />
            <LikertScale label="Overall, this test was easier than standard memory tests." field="q_comparison" icon={CheckCircle2} />
            <LikertScale label="I would feel okay taking this again or recommending it." field="q_recommend" icon={Heart} />

            <div className="flex gap-3 pt-8">
              <button
                onClick={() => setSection('demographics')}
                className="flex-1 py-4 border-2 border-stone-100 text-stone-600 rounded-2xl font-medium hover:bg-stone-50 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={() => setSection('feedback')}
                disabled={!formData.q_instructions || !formData.q_tasks || !formData.q_comfort || !formData.q_length || !formData.q_language || !formData.q_visuals || !formData.q_comparison || !formData.q_recommend}
                className="flex-[2] py-4 bg-stone-900 text-white rounded-2xl font-medium hover:bg-stone-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                Next Section <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        );

      case 'feedback':
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
            <h3 className="text-xl font-serif font-medium text-stone-900">Section 3: Open Feedback</h3>
            
            <div>
              <label className="block text-sm font-semibold text-stone-500 uppercase tracking-wider mb-4">About how long did the test take you?</label>
              <div className="grid grid-cols-1 gap-2">
                {['Less than 5 minutes', '5–10 minutes', '10–15 minutes', 'More than 15 minutes'].map(time => (
                  <button
                    key={time}
                    onClick={() => updateField('test_duration', time)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      formData.test_duration === time
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                        : 'bg-white border-stone-100 text-stone-600 hover:border-stone-200'
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-stone-500 uppercase tracking-wider mb-2">What did you like MOST about this test?</label>
              <textarea
                value={formData.liked_most}
                onChange={(e) => updateField('liked_most', e.target.value)}
                placeholder="e.g., The pictures made it fun, It was short..."
                className="w-full p-4 rounded-xl border-2 border-stone-100 focus:border-stone-300 focus:outline-none min-h-[100px] text-stone-700"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-stone-500 uppercase tracking-wider mb-2">What did you like LEAST or find confusing?</label>
              <textarea
                value={formData.liked_least}
                onChange={(e) => updateField('liked_least', e.target.value)}
                placeholder="e.g., One question was hard to remember..."
                className="w-full p-4 rounded-xl border-2 border-stone-100 focus:border-stone-300 focus:outline-none min-h-[100px] text-stone-700"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-stone-500 uppercase tracking-wider mb-2">Any other suggestions? (Optional)</label>
              <textarea
                value={formData.suggestions}
                onChange={(e) => updateField('suggestions', e.target.value)}
                placeholder="How can we make this even better?"
                className="w-full p-4 rounded-xl border-2 border-stone-100 focus:border-stone-300 focus:outline-none min-h-[100px] text-stone-700"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setSection('experience')}
                className="flex-1 py-4 border-2 border-stone-100 text-stone-600 rounded-2xl font-medium hover:bg-stone-50 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !formData.test_duration}
                className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? 'Submitting...' : 'Complete Survey'}
              </button>
            </div>
          </motion.div>
        );

      case 'thanks':
        return (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-12"
          >
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-3xl font-serif font-medium text-stone-900 mb-4">Thank You!</h2>
            <p className="text-stone-600 mb-10 leading-relaxed max-w-sm mx-auto">
              Thank you so much for your time and feedback! Your input is helping create better tools for early memory screening in our community.
            </p>
            <button
              onClick={onComplete}
              className="w-full py-4 bg-stone-900 text-white rounded-2xl font-medium hover:bg-stone-800 transition-colors"
            >
              Return to Dashboard
            </button>
          </motion.div>
        );
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-stone-100">
        {section !== 'intro' && section !== 'thanks' && (
          <div className="mb-12">
            <div className="flex justify-between text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3">
              <span>Progress</span>
              <span>{section === 'demographics' ? '33%' : section === 'experience' ? '66%' : '90%'}</span>
            </div>
            <div className="h-1.5 w-full bg-stone-50 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-emerald-500"
                initial={{ width: 0 }}
                animate={{ 
                  width: section === 'demographics' ? '33%' : section === 'experience' ? '66%' : '100%' 
                }}
              />
            </div>
          </div>
        )}
        
        <AnimatePresence mode="wait">
          {renderSection()}
        </AnimatePresence>
      </div>
    </div>
  );
}
