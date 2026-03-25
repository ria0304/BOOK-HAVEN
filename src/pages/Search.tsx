import React, { useState } from 'react';
import { Search as SearchIcon, Plus, Check, ExternalLink, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import { apiFetch } from '../lib/api';

interface BookResult {
  key: string;
  title: string;
  author_name?: string[];
  cover_url?: string;
  first_sentence?: string[];
  source?: string;
  url?: string;
}

export default function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BookResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [addedBooks, setAddedBooks] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const searchBooks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;
    
    setLoading(true);
    setErrorMsg(null);
    try {
      // Fetch from both APIs concurrently
      const [googleRes, openLibRes] = await Promise.allSettled([
        fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=8`),
        fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8`)
      ]);

      let combinedResults: BookResult[] = [];

      if (googleRes.status === 'fulfilled' && googleRes.value.ok) {
        const data = await googleRes.value.json();
        const mapped = (data.items || []).map((item: any) => ({
          key: item.id,
          title: item.volumeInfo.title,
          author_name: item.volumeInfo.authors || ['Unknown Author'],
          cover_url: item.volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || '',
          first_sentence: item.volumeInfo.description ? [item.volumeInfo.description] : undefined,
          source: 'Google Books',
          url: `https://books.google.com/books?id=${item.id}`
        }));
        combinedResults = [...combinedResults, ...mapped];
      }

      if (openLibRes.status === 'fulfilled' && openLibRes.value.ok) {
        const data = await openLibRes.value.json();
        const mapped = (data.docs || []).map((doc: any) => ({
          key: doc.key,
          title: doc.title,
          author_name: doc.author_name || ['Unknown Author'],
          cover_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : '',
          first_sentence: doc.first_sentence || undefined,
          source: 'Open Library',
          url: `https://openlibrary.org${doc.key}`
        }));
        combinedResults = [...combinedResults, ...mapped];
      }
      
      // Deduplicate by title (simple deduplication)
      const seenTitles = new Set();
      const deduplicated = combinedResults.filter(book => {
        const titleLower = book.title.toLowerCase();
        if (seenTitles.has(titleLower)) return false;
        seenTitles.add(titleLower);
        return true;
      });

      setResults(deduplicated);
    } catch (error) {
      console.error('Search failed', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const addToLibrary = async (book: BookResult) => {
    setErrorMsg(null);
    try {
      await apiFetch('/api/library', {
        method: 'POST',
        body: JSON.stringify({
          title: book.title,
          author: book.author_name?.[0] || 'Unknown Author',
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

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400 mb-4">
          Discover New Worlds
        </h1>
        <p className="text-gray-400">Search millions of books via Google Books & Open Library</p>
      </div>

      {errorMsg && (
        <div className="max-w-2xl mx-auto mb-6 bg-red-900/50 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-center">
          {errorMsg}
        </div>
      )}

      <form onSubmit={searchBooks} className="relative max-w-2xl mx-auto mb-12">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, author, or keyword..."
            className="relative w-full bg-black border border-purple-900/50 rounded-full py-4 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all"
          />
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <button 
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2 rounded-full font-medium hover:from-purple-500 hover:to-pink-500 transition-all"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {results.map((book, idx) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            key={book.key}
            className="bg-purple-950/20 border border-purple-900/50 rounded-xl overflow-hidden hover:border-pink-500/50 transition-all group flex flex-col"
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
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                <a 
                  href={book.url || `https://books.google.com/books?id=${book.key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-white flex items-center hover:text-pink-400 transition-colors"
                >
                  <ExternalLink className="w-3 h-3 mr-1" /> View on {book.source || 'Google Books'}
                </a>
              </div>
            </div>
            
            <div className="p-4 flex-1 flex flex-col">
              <h3 className="font-semibold text-white line-clamp-2 mb-1">{book.title}</h3>
              <p className="text-sm text-gray-400 line-clamp-1 mb-2">
                {book.author_name?.[0] || 'Unknown Author'}
              </p>
              
              {book.first_sentence && book.first_sentence[0] && (
                <p className="text-xs text-gray-500 italic line-clamp-3 mb-4 flex-1">
                  "{book.first_sentence[0]}"
                </p>
              )}
              {!book.first_sentence && (
                <div className="flex-1 mb-4"></div>
              )}
              
              <button
                onClick={() => addToLibrary(book)}
                disabled={addedBooks.has(book.key)}
                className={`w-full py-2 rounded-lg flex items-center justify-center space-x-2 text-sm font-medium transition-all ${
                  addedBooks.has(book.key)
                    ? 'bg-green-900/30 text-green-400 border border-green-500/30'
                    : 'bg-purple-900/30 text-pink-400 border border-purple-500/30 hover:bg-pink-600 hover:text-white hover:border-pink-500'
                }`}
              >
                {addedBooks.has(book.key) ? (
                  <><Check className="w-4 h-4" /> <span>Added</span></>
                ) : (
                  <><Plus className="w-4 h-4" /> <span>Add to Library</span></>
                )}
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
