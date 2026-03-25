import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, PieChart, TrendingUp, BookOpen, Clock, Star, Brain, Sparkles, Compass, Plus, Check } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { Link } from 'react-router-dom';

// Mood Picker Component
function MoodPicker({ onMoodSelect, currentMood }: { onMoodSelect: (mood: string) => void; currentMood?: string }) {
  const [selectedMood, setSelectedMood] = useState(currentMood || '');
  
  const moods = [
    { emoji: '😊', label: 'Happy', color: 'bg-yellow-500/20', hoverColor: 'hover:bg-yellow-500/30' },
    { emoji: '😢', label: 'Sad', color: 'bg-blue-500/20', hoverColor: 'hover:bg-blue-500/30' },
    { emoji: '😐', label: 'Neutral', color: 'bg-gray-500/20', hoverColor: 'hover:bg-gray-500/30' },
    { emoji: '❤️', label: 'Loved', color: 'bg-red-500/20', hoverColor: 'hover:bg-red-500/30' },
    { emoji: '⚡', label: 'Excited', color: 'bg-purple-500/20', hoverColor: 'hover:bg-purple-500/30' },
    { emoji: '☕', label: 'Cozy', color: 'bg-amber-500/20', hoverColor: 'hover:bg-amber-500/30' },
    { emoji: '🤔', label: 'Thoughtful', color: 'bg-indigo-500/20', hoverColor: 'hover:bg-indigo-500/30' },
    { emoji: '🎉', label: 'Celebratory', color: 'bg-pink-500/20', hoverColor: 'hover:bg-pink-500/30' },
    { emoji: '😴', label: 'Tired', color: 'bg-slate-500/20', hoverColor: 'hover:bg-slate-500/30' },
    { emoji: '🤯', label: 'Mind-blown', color: 'bg-orange-500/20', hoverColor: 'hover:bg-orange-500/30' },
    { emoji: '😍', label: 'Obsessed', color: 'bg-rose-500/20', hoverColor: 'hover:bg-rose-500/30' },
    { emoji: '🤗', label: 'Grateful', color: 'bg-teal-500/20', hoverColor: 'hover:bg-teal-500/30' },
  ];

  const handleMoodSelect = (emoji: string) => {
    setSelectedMood(emoji);
    onMoodSelect(emoji);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {moods.map((mood) => (
          <button
            key={mood.emoji}
            onClick={() => handleMoodSelect(mood.emoji)}
            className={`flex flex-col items-center p-3 rounded-xl transition-all transform hover:scale-105 ${
              selectedMood === mood.emoji
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-pink-500/25'
                : `${mood.color} ${mood.hoverColor} border border-purple-800/30`
            }`}
          >
            <span className="text-2xl mb-1">{mood.emoji}</span>
            <span className="text-xs font-medium">{mood.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [drpa, setDrpa] = useState<any>(null);
  const [moodRecs, setMoodRecs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updatingObsession, setUpdatingObsession] = useState(false);
  const [addedBooks, setAddedBooks] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loggingMood, setLoggingMood] = useState(false);

  const obsessionOptions = [
    'Dark Romance',
    'Dark Fantasy',
    'Cyberpunk',
    'Historical Fiction',
    'Sci-Fi Thriller',
    'Cozy Mystery',
    'Epic Fantasy',
    'Romantasy',
    'True Crime',
    'Literary Fiction',
    'Psychological Thriller',
    'Contemporary Romance',
    'Spicy Romance',
    'Gothic Horror',
    'Young Adult Fantasy',
    'Mystery'
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [analyticsData, drpaData, moodData] = await Promise.all([
        apiFetch('/api/analytics'),
        apiFetch('/api/recommendations/drpa'),
        apiFetch('/api/recommendations/mood')
      ]);
      setAnalytics(analyticsData);
      setDrpa(drpaData);
      setMoodRecs(moodData);
    } catch (error) {
      console.error('Failed to fetch dashboard data', error);
    } finally {
      setLoading(false);
    }
  };

  const handleObsessionChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newObsession = e.target.value;
    
    setUpdatingObsession(true);
    try {
      await apiFetch('/api/preferences/obsession', {
        method: 'PUT',
        body: JSON.stringify({ obsession: newObsession || null })
      });
      await fetchData(); // Refresh data to get new recommendations
    } catch (error) {
      console.error('Failed to update obsession', error);
    } finally {
      setUpdatingObsession(false);
    }
  };

  const logMood = async (mood: string) => {
    setLoggingMood(true);
    try {
      await apiFetch('/api/preferences/mood', {
        method: 'POST',
        body: JSON.stringify({ mood })
      });
      // Refresh analytics to show the new mood
      const analyticsData = await apiFetch('/api/analytics');
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Failed to log mood', error);
    } finally {
      setLoggingMood(false);
    }
  };

  const addToLibrary = async (book: any) => {
    setErrorMsg(null);
    try {
      await apiFetch('/api/library', {
        method: 'POST',
        body: JSON.stringify({
          title: book.title,
          author: book.author || 'Unknown Author',
          cover_url: book.cover_url || '',
          open_library_id: book.key,
          status: 'want_to_read'
        })
      });
      setAddedBooks(prev => new Set(prev).add(book.key));
    } catch (error: any) {
      console.error('Failed to add book', error);
      if (error.message.includes('Already in library')) {
        setErrorMsg(`"${book.title}" is already in your library!`);
      } else {
        setErrorMsg('Failed to add book. Please try again.');
      }
    }
  };

  if (loading) return <div className="text-center py-20 text-pink-500">Loading insights...</div>;

  const totalBooks = analytics?.statusCounts?.reduce((acc: number, curr: any) => acc + curr.count, 0) || 0;
  const completedBooks = analytics?.statusCounts?.find((s: any) => s.status === 'completed')?.count || 0;
  const readingBooks = analytics?.statusCounts?.find((s: any) => s.status === 'reading')?.count || 0;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-12">
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400 mb-2">
          Reading Insights
        </h1>
        <p className="text-gray-400">Analyze your reading habits and moods</p>
      </div>

      {errorMsg && (
        <div className="max-w-2xl mx-auto mb-6 bg-red-900/50 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-center">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-purple-950/20 border border-purple-900/50 p-6 rounded-2xl flex items-center space-x-4"
        >
          <div className="w-12 h-12 bg-pink-500/20 rounded-full flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-pink-400" />
          </div>
          <div>
            <p className="text-sm text-gray-400 font-medium">Total Books</p>
            <h3 className="text-3xl font-bold text-white">{totalBooks}</h3>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-purple-950/20 border border-purple-900/50 p-6 rounded-2xl flex items-center space-x-4"
        >
          <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
            <Star className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <p className="text-sm text-gray-400 font-medium">Completed</p>
            <h3 className="text-3xl font-bold text-white">{completedBooks}</h3>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-purple-950/20 border border-purple-900/50 p-6 rounded-2xl flex items-center space-x-4"
        >
          <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center">
            <Clock className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <p className="text-sm text-gray-400 font-medium">Currently Reading</p>
            <h3 className="text-3xl font-bold text-white">{readingBooks}</h3>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-purple-950/20 border border-purple-900/50 p-8 rounded-2xl"
        >
          <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
            <Brain className="w-5 h-5 mr-2 text-pink-400" /> Reader Personality
          </h3>
          <div className="flex items-center justify-center p-8 bg-black/30 rounded-xl border border-purple-800/30">
            <div className="text-center">
              <Sparkles className="w-12 h-12 text-amber-400 mx-auto mb-4 animate-pulse" />
              <h4 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500">
                {drpa?.personality || 'The Explorer'}
              </h4>
              <p className="text-gray-400 mt-2 text-sm">Based on your reading behavior and preferences</p>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-purple-950/20 border border-purple-900/50 p-8 rounded-2xl relative"
        >
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-xl font-semibold text-white flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-pink-400" /> Current Obsession
            </h3>
            <select 
              className="bg-black/50 border border-purple-800/50 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-pink-500"
              onChange={handleObsessionChange}
              disabled={updatingObsession}
              value={drpa?.preferences?.current_obsession || ''}
            >
              <option value="">Auto-detect</option>
              {obsessionOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-center p-8 bg-black/30 rounded-xl border border-purple-800/30 h-[200px]">
            <div className="text-center">
              <Compass className="w-12 h-12 text-blue-400 mx-auto mb-4" />
              <h4 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-blue-500">
                {drpa?.obsession || 'Discovering new worlds'}
              </h4>
              <p className="text-gray-400 mt-2 text-sm">Your most frequent reading pattern</p>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-purple-950/20 border border-purple-900/50 p-8 rounded-2xl"
        >
          <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
            <PieChart className="w-5 h-5 mr-2 text-pink-400" /> Reading Status
          </h3>
          
          <div className="space-y-4">
            {analytics?.statusCounts?.map((stat: any) => {
              const percentage = totalBooks > 0 ? (stat.count / totalBooks) * 100 : 0;
              const color = stat.status === 'completed' ? 'bg-green-500' : 
                            stat.status === 'reading' ? 'bg-amber-500' : 'bg-purple-500';
              
              return (
                <div key={stat.status}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300 capitalize">{stat.status.replace(/_/g, ' ')}</span>
                    <span className="text-gray-400">{stat.count} ({percentage.toFixed(0)}%)</span>
                  </div>
                  <div className="w-full bg-purple-900/30 rounded-full h-2">
                    <div className={`${color} h-2 rounded-full`} style={{ width: `${percentage}%` }}></div>
                  </div>
                </div>
              );
            })}
            {!analytics?.statusCounts?.length && <p className="text-gray-500 text-sm">No data available yet.</p>}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-purple-950/20 border border-purple-900/50 p-8 rounded-2xl"
        >
          <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-amber-400" /> Mood Tracker
          </h3>
          
          {/* Mood Picker */}
          <div className="mb-8">
            <p className="text-sm text-gray-400 mb-3">How are you feeling today?</p>
            <MoodPicker onMoodSelect={logMood} />
            {loggingMood && (
              <p className="text-xs text-pink-400 mt-2 text-center">Logging your mood...</p>
            )}
          </div>
          
          {/* Mood Stats */}
          <div>
            <p className="text-sm text-gray-400 mb-3">Your reading moods</p>
            <div className="flex flex-wrap gap-4">
              {analytics?.moodCounts?.map((mood: any) => (
                <div key={mood.mood} className="bg-purple-900/30 border border-purple-800/50 rounded-xl p-4 flex flex-col items-center justify-center min-w-[100px]">
                  <span className="text-4xl mb-2">{mood.mood}</span>
                  <span className="text-xl font-bold text-white">{mood.count}</span>
                  <span className="text-xs text-gray-400 uppercase tracking-wider mt-1">Books</span>
                </div>
              ))}
              {!analytics?.moodCounts?.length && (
                <p className="text-gray-500 text-sm">No mood data yet. Pick a mood above to get started!</p>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {drpa?.recommendations && drpa.recommendations.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-purple-950/20 border border-purple-900/50 p-8 rounded-2xl mb-12"
        >
          <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
            <Star className="w-5 h-5 mr-2 text-amber-400" /> DRPA Recommendations
          </h3>
          <p className="text-gray-400 mb-6 text-sm">Curated based on your current obsession: <span className="text-pink-400 font-medium">{drpa?.obsession}</span></p>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {drpa.recommendations.map((book: any) => (
              <div key={book.key} className="group flex flex-col items-center relative">
                <div className="w-full aspect-[2/3] bg-black/50 rounded-lg overflow-hidden border border-purple-800/30 group-hover:border-pink-500/50 transition-colors mb-3 relative">
                  {book.cover_url ? (
                    <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600">
                      <BookOpen className="w-8 h-8" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => addToLibrary(book)}
                      disabled={addedBooks.has(book.key)}
                      className="bg-pink-600 hover:bg-pink-500 text-white p-2 rounded-full transform hover:scale-110 transition-all disabled:opacity-50 disabled:hover:scale-100 disabled:bg-green-600"
                      title={addedBooks.has(book.key) ? "Added to Library" : "Add to Library"}
                    >
                      {addedBooks.has(book.key) ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <h4 className="text-sm font-medium text-white text-center line-clamp-2 group-hover:text-pink-400 transition-colors">{book.title}</h4>
                <p className="text-xs text-gray-400 text-center line-clamp-1">{book.author}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {moodRecs?.recommendations && moodRecs.recommendations.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-purple-950/20 border border-purple-900/50 p-8 rounded-2xl mb-12"
        >
          <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
            <Sparkles className="w-5 h-5 mr-2 text-pink-400" /> Mood Matcher
          </h3>
          <p className="text-gray-400 mb-6 text-sm">Because you recently felt {moodRecs.mood}</p>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {moodRecs.recommendations.map((book: any) => (
              <div key={book.key} className="group flex flex-col items-center relative">
                <div className="w-full aspect-[2/3] bg-black/50 rounded-lg overflow-hidden border border-purple-800/30 group-hover:border-pink-500/50 transition-colors mb-3 relative">
                  {book.cover_url ? (
                    <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600">
                      <BookOpen className="w-8 h-8" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => addToLibrary(book)}
                      disabled={addedBooks.has(book.key)}
                      className="bg-pink-600 hover:bg-pink-500 text-white p-2 rounded-full transform hover:scale-110 transition-all disabled:opacity-50 disabled:hover:scale-100 disabled:bg-green-600"
                      title={addedBooks.has(book.key) ? "Added to Library" : "Add to Library"}
                    >
                      {addedBooks.has(book.key) ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <h4 className="text-sm font-medium text-white text-center line-clamp-2 group-hover:text-pink-400 transition-colors">{book.title}</h4>
                <p className="text-xs text-gray-400 text-center line-clamp-1">{book.author}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
