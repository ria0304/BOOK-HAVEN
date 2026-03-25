import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, ArrowLeft, Save, BookOpen, Smile, Frown, Meh, Heart, Zap, Coffee, ExternalLink, Film, ShoppingCart } from 'lucide-react';
import { apiFetch } from '../lib/api';

const MOODS = [
  { emoji: '😊', label: 'Happy', icon: Smile },
  { emoji: '😢', label: 'Sad', icon: Frown },
  { emoji: '😐', label: 'Neutral', icon: Meh },
  { emoji: '❤️', label: 'Loved', icon: Heart },
  { emoji: '⚡', label: 'Excited', icon: Zap },
  { emoji: '☕', label: 'Cozy', icon: Coffee },
];

export default function BookDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState<any>(null);
  const [movies, setMovies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    status: 'want_to_read',
    rating: 0,
    notes: '',
    mood: ''
  });

  useEffect(() => {
    fetchBook();
  }, [id]);

  const fetchBook = async () => {
    try {
      const data = await apiFetch('/api/library');
      const found = data.find((b: any) => b.id === Number(id));
      if (found) {
        setBook(found);
        setFormData({
          status: found.status || 'want_to_read',
          rating: found.rating || 0,
          notes: found.notes || '',
          mood: found.mood || ''
        });
        
        // Fetch movies
        try {
          const movieData = await apiFetch(`/api/movies/search?title=${encodeURIComponent(found.title)}`);
          if (movieData.results) {
            setMovies(movieData.results.slice(0, 3));
          }
        } catch (e) {
          console.error('Failed to fetch movies', e);
        }
      } else {
        navigate('/library');
      }
    } catch (error) {
      console.error('Failed to fetch book', error);
      navigate('/library');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/library/${id}`, {
        method: 'PUT',
        body: JSON.stringify(formData)
      });
      navigate('/library');
    } catch (error) {
      console.error('Failed to save', error);
      alert('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-20 text-pink-500">Loading...</div>;
  if (!book) return null;

  return (
    <div className="max-w-4xl mx-auto">
      <button 
        onClick={() => navigate('/library')}
        className="flex items-center text-gray-400 hover:text-pink-400 transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Library
      </button>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="aspect-[2/3] rounded-2xl overflow-hidden border border-purple-900/50 shadow-2xl shadow-purple-900/20 sticky top-24"
          >
            {book.cover_url ? (
              <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full bg-purple-950/50 flex items-center justify-center">
                <BookOpen className="w-16 h-16 text-purple-800" />
              </div>
            )}
          </motion.div>
        </div>

        <div className="md:col-span-2 space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">{book.title}</h1>
            <p className="text-xl text-gray-400">{book.author}</p>
          </div>

          <div className="bg-purple-950/20 border border-purple-900/50 rounded-2xl p-6 space-y-6">
            {/* Smart Availability */}
            <div className="flex flex-wrap gap-3 pb-6 border-b border-purple-900/50">
              {book.open_library_id && (
                <a 
                  href={`https://openlibrary.org/works/${book.open_library_id}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center text-sm bg-blue-900/30 text-blue-300 px-4 py-2 rounded-lg hover:bg-blue-800/40 transition-colors"
                >
                  <BookOpen className="w-4 h-4 mr-2" /> Read on Open Library
                </a>
              )}
              <a 
                href={`https://archive.org/search.php?query=${encodeURIComponent(book.title)}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center text-sm bg-purple-900/30 text-purple-300 px-4 py-2 rounded-lg hover:bg-purple-800/40 transition-colors"
              >
                <ExternalLink className="w-4 h-4 mr-2" /> Internet Archive
              </a>
              <a 
                href={`https://www.amazon.com/s?k=${encodeURIComponent(book.title + ' kindle')}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center text-sm bg-amber-900/30 text-amber-300 px-4 py-2 rounded-lg hover:bg-amber-800/40 transition-colors"
              >
                <ShoppingCart className="w-4 h-4 mr-2" /> Buy on Kindle
              </a>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Reading Status</label>
              <div className="flex flex-wrap gap-2">
                {['want_to_read', 'reading', 'completed'].map(status => (
                  <button
                    key={status}
                    onClick={() => setFormData({ ...formData, status })}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      formData.status === status 
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-pink-500/25' 
                        : 'bg-purple-900/30 text-gray-400 hover:bg-purple-900/50 hover:text-white'
                    }`}
                  >
                    {status.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Rating */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Your Rating</label>
              <div className="flex space-x-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setFormData({ ...formData, rating: star })}
                    className="focus:outline-none transform hover:scale-110 transition-transform"
                  >
                    <Star 
                      className={`w-8 h-8 ${
                        formData.rating >= star 
                          ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' 
                          : 'text-gray-600 hover:text-amber-400/50'
                      }`} 
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Mood */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Reading Mood</label>
              <div className="flex flex-wrap gap-3">
                {MOODS.map(m => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.emoji}
                      onClick={() => setFormData({ ...formData, mood: m.emoji })}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-full border transition-all ${
                        formData.mood === m.emoji
                          ? 'bg-pink-500/20 border-pink-500 text-pink-300 shadow-[0_0_15px_rgba(236,72,153,0.2)]'
                          : 'bg-purple-950/50 border-purple-900/50 text-gray-400 hover:border-purple-500/50 hover:text-white'
                      }`}
                    >
                      <span className="text-xl">{m.emoji}</span>
                      <span className="text-sm font-medium">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Personal Notes</label>
              <textarea
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="What did you think about this book? Any favorite quotes?"
                className="w-full h-32 bg-black/50 border border-purple-900/50 rounded-xl p-4 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all resize-none"
              />
            </div>

            <div className="pt-4 border-t border-purple-900/50 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-3 rounded-full font-medium hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-pink-500/25 disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>

          {/* Book-to-Movie Mode */}
          {movies.length > 0 && (
            <div className="bg-purple-950/20 border border-purple-900/50 rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                <Film className="w-5 h-5 mr-2 text-pink-400" /> Movie Adaptations
              </h3>
              <div className="space-y-4">
                {movies.map((movie) => (
                  <div key={movie.id} className="flex gap-4 p-4 bg-black/30 rounded-xl border border-purple-800/30">
                    <div className="flex-1">
                      <h4 className="text-white font-medium">{movie.title}</h4>
                      <p className="text-sm text-gray-400 line-clamp-2 mt-1">{movie.overview}</p>
                      <div className="flex items-center gap-4 mt-3 text-xs">
                        <span className="flex items-center text-amber-400">
                          <Star className="w-3 h-3 mr-1 fill-amber-400" /> {movie.vote_average?.toFixed(1) || 'N/A'} / 10
                        </span>
                        <span className="text-gray-500">{movie.release_date?.substring(0, 4)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
