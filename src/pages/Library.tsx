import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Star, MoreVertical, Edit3, Trash2, ExternalLink, Search } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { Link } from 'react-router-dom';

interface LibraryBook {
  id: number;
  book_id: number;
  title: string;
  author: string;
  cover_url: string;
  status: 'want_to_read' | 'reading' | 'completed';
  rating: number | null;
  notes: string | null;
  mood: string | null;
  open_library_id: string;
}

export default function Library() {
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'want_to_read' | 'reading' | 'completed'>('all');

  useEffect(() => {
    fetchLibrary();
  }, []);

  const fetchLibrary = async () => {
    try {
      const data = await apiFetch('/api/library');
      setBooks(data);
    } catch (error) {
      console.error('Failed to fetch library', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      await apiFetch(`/api/library/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      fetchLibrary();
    } catch (error) {
      console.error('Failed to update status', error);
    }
  };

  const removeBook = async (id: number) => {
    if (!confirm('Are you sure you want to remove this book?')) return;
    try {
      await apiFetch(`/api/library/${id}`, { method: 'DELETE' });
      setBooks(books.filter(b => b.id !== id));
    } catch (error) {
      console.error('Failed to remove book', error);
    }
  };

  const filteredBooks = filter === 'all' ? books : books.filter(b => b.status === filter);

  const tabs = [
    { id: 'all', label: 'All Books' },
    { id: 'want_to_read', label: 'Want to Read' },
    { id: 'reading', label: 'Currently Reading' },
    { id: 'completed', label: 'Completed' }
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400 mb-2">
            My Collection
          </h1>
          <p className="text-gray-400">Track your reading journey and moods</p>
        </div>
        
        <div className="flex space-x-2 bg-purple-950/30 p-1 rounded-xl border border-purple-900/50 overflow-x-auto max-w-full">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                filter === tab.id 
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-pink-500/25' 
                  : 'text-gray-400 hover:text-white hover:bg-purple-900/30'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
        </div>
      ) : filteredBooks.length === 0 ? (
        <div className="text-center py-20 bg-purple-950/10 rounded-2xl border border-purple-900/30 border-dashed">
          <BookOpen className="w-16 h-16 text-purple-800 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-300 mb-2">Your library is empty</h3>
          <p className="text-gray-500 mb-6">Start discovering new books to add to your collection.</p>
          <Link 
            to="/search" 
            className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-full font-medium hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-pink-500/25"
          >
            <Search className="w-4 h-4" />
            <span>Find Books</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredBooks.map((book, idx) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              key={book.id}
              className="bg-purple-950/20 border border-purple-900/50 rounded-xl overflow-hidden hover:border-pink-500/50 transition-all group relative"
            >
              <div className="aspect-[2/3] bg-purple-900/20 relative overflow-hidden">
                {book.cover_url ? (
                  <img 
                    src={book.cover_url} 
                    alt={book.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-purple-700">
                    <BookOpen className="w-12 h-12 opacity-50" />
                  </div>
                )}
                
                {/* Status Badge */}
                <div className="absolute top-3 right-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-md ${
                    book.status === 'completed' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                    book.status === 'reading' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                    'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  }`}>
                    {book.status.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Hover Actions */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex space-x-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star 
                          key={star} 
                          className={`w-4 h-4 ${(book.rating || 0) >= star ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}`} 
                        />
                      ))}
                    </div>
                    {book.mood && <span className="text-xl" title="Mood">{book.mood}</span>}
                  </div>
                  
                  <div className="flex space-x-2 mt-2">
                    <Link 
                      to={`/book/${book.id}`}
                      className="flex-1 bg-pink-600/80 hover:bg-pink-500 text-white text-xs font-medium py-2 rounded-lg flex items-center justify-center transition-colors backdrop-blur-sm"
                    >
                      <Edit3 className="w-3 h-3 mr-1" /> Edit Log
                    </Link>
                    <button 
                      onClick={() => removeBook(book.id)}
                      className="p-2 bg-red-900/50 hover:bg-red-500/80 text-white rounded-lg transition-colors backdrop-blur-sm"
                      title="Remove from library"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="p-4">
                <h3 className="font-semibold text-white line-clamp-1 mb-1" title={book.title}>{book.title}</h3>
                <p className="text-sm text-gray-400 line-clamp-1">{book.author}</p>
                
                <div className="mt-4 pt-4 border-t border-purple-900/30 flex justify-between items-center">
                  <select 
                    value={book.status}
                    onChange={(e) => updateStatus(book.id, e.target.value)}
                    className="bg-transparent text-xs text-gray-300 focus:outline-none focus:ring-0 cursor-pointer hover:text-pink-400 transition-colors"
                  >
                    <option value="want_to_read" className="bg-purple-950 text-white">Want to Read</option>
                    <option value="reading" className="bg-purple-950 text-white">Currently Reading</option>
                    <option value="completed" className="bg-purple-950 text-white">Completed</option>
                  </select>
                  
                  {book.open_library_id && (
                    <a 
                      href={`https://openlibrary.org${book.open_library_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 hover:text-pink-400 transition-colors"
                      title="View on Open Library"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
