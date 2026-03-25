import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, BookHeart, Compass, Brain } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  
  const [step, setStep] = useState(1);
  const [genres, setGenres] = useState<string[]>([]);
  const [frequency, setFrequency] = useState('');
  const [mood, setMood] = useState('');
  const [types, setTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const GENRES = ['Fantasy', 'Sci-Fi', 'Romance', 'Thriller', 'Mystery', 'Non-Fiction', 'Historical', 'Horror', 'Biography'];
  const FREQUENCIES = ['Daily', 'A few times a week', 'Weekly', 'Occasionally'];
  const MOODS = ['Adventurous', 'Relaxed', 'Thought-provoking', 'Dark & Gritty', 'Lighthearted', 'Romantic'];
  const TYPES = ['Fiction', 'Non-Fiction', 'Graphic Novels', 'Audiobooks', 'Poetry'];

  const toggleSelection = (item: string, list: string[], setList: (val: string[]) => void) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      await apiFetch('/api/auth/onboard', {
        method: 'POST',
        body: JSON.stringify({
          favorite_genres: genres,
          reading_frequency: frequency,
          preferred_mood: mood,
          favorite_types: types
        })
      });
      // Update local user state
      if (user) {
        const updatedUser = { ...user, onboarded: 1 };
        login(localStorage.getItem('token') || '', updatedUser);
      }
      navigate('/');
    } catch (error) {
      console.error('Failed to save preferences', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center max-w-2xl mx-auto px-4">
      <motion.div 
        key={step}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="w-full bg-black/40 backdrop-blur-xl p-8 rounded-2xl border border-purple-900/50 shadow-2xl shadow-purple-900/20"
      >
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
            Personalize Your Experience
          </h2>
          <span className="text-gray-400 text-sm">Step {step} of 4</span>
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 text-xl font-medium text-white mb-4">
              <BookHeart className="text-pink-500" />
              What are your favorite genres?
            </div>
            <div className="flex flex-wrap gap-3">
              {GENRES.map(g => (
                <button
                  key={g}
                  onClick={() => toggleSelection(g, genres, setGenres)}
                  className={`px-4 py-2 rounded-full border transition-all ${
                    genres.includes(g) 
                      ? 'bg-pink-500/20 border-pink-500 text-pink-300' 
                      : 'bg-purple-950/30 border-purple-800/50 text-gray-300 hover:border-purple-500'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setStep(2)}
              disabled={genres.length === 0}
              className="w-full mt-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 text-xl font-medium text-white mb-4">
              <Compass className="text-amber-400" />
              How often do you read?
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FREQUENCIES.map(f => (
                <button
                  key={f}
                  onClick={() => setFrequency(f)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    frequency === f 
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300' 
                      : 'bg-purple-950/30 border-purple-800/50 text-gray-300 hover:border-purple-500'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setStep(1)} className="px-6 py-3 border border-purple-800/50 text-gray-300 rounded-lg hover:bg-purple-900/30">Back</button>
              <button 
                onClick={() => setStep(3)}
                disabled={!frequency}
                className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 text-xl font-medium text-white mb-4">
              <Sparkles className="text-purple-400" />
              What's your preferred reading mood?
            </div>
            <div className="grid grid-cols-2 gap-3">
              {MOODS.map(m => (
                <button
                  key={m}
                  onClick={() => setMood(m)}
                  className={`p-4 rounded-xl border text-center transition-all ${
                    mood === m 
                      ? 'bg-purple-500/20 border-purple-500 text-purple-300' 
                      : 'bg-purple-950/30 border-purple-800/50 text-gray-300 hover:border-purple-500'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setStep(2)} className="px-6 py-3 border border-purple-800/50 text-gray-300 rounded-lg hover:bg-purple-900/30">Back</button>
              <button 
                onClick={() => setStep(4)}
                disabled={!mood}
                className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 text-xl font-medium text-white mb-4">
              <Brain className="text-blue-400" />
              What types of books do you prefer?
            </div>
            <div className="flex flex-wrap gap-3">
              {TYPES.map(t => (
                <button
                  key={t}
                  onClick={() => toggleSelection(t, types, setTypes)}
                  className={`px-4 py-2 rounded-full border transition-all ${
                    types.includes(t) 
                      ? 'bg-blue-500/20 border-blue-500 text-blue-300' 
                      : 'bg-purple-950/30 border-purple-800/50 text-gray-300 hover:border-purple-500'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setStep(3)} className="px-6 py-3 border border-purple-800/50 text-gray-300 rounded-lg hover:bg-purple-900/30">Back</button>
              <button 
                onClick={handleComplete}
                disabled={types.length === 0 || loading}
                className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold disabled:opacity-50 flex justify-center items-center"
              >
                {loading ? 'Initializing Algorithm...' : 'Complete Setup'}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
