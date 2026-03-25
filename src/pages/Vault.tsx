import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, Download, Trash2, Archive, X, BookOpen } from 'lucide-react';
import { apiFetch } from '../lib/api';
import ePub from 'epubjs';

interface UploadedBook {
  id: number;
  title: string;
  file_url: string;
  created_at: string;
}

export default function Vault() {
  const [books, setBooks] = useState<UploadedBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeBook, setActiveBook] = useState<UploadedBook | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const epubContainerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<any>(null);

  useEffect(() => {
    fetchVault();
  }, []);

  useEffect(() => {
    if (activeBook && activeBook.file_url.endsWith('.epub') && epubContainerRef.current) {
      const book = ePub(activeBook.file_url);
      const rendition = book.renderTo(epubContainerRef.current, {
        width: '100%',
        height: '100%',
        spread: 'none'
      });
      rendition.display();
      renditionRef.current = rendition;

      return () => {
        book.destroy();
      };
    }
  }, [activeBook]);

  const nextEpubPage = () => {
    if (renditionRef.current) renditionRef.current.next();
  };

  const prevEpubPage = () => {
    if (renditionRef.current) renditionRef.current.prev();
  };

  const fetchVault = async () => {
    try {
      const data = await apiFetch('/api/vault');
      setBooks(data);
    } catch (error) {
      console.error('Failed to fetch vault', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type (basic check)
    const isPdf = file.name.toLowerCase().endsWith('.pdf');
    const isEpub = file.name.toLowerCase().endsWith('.epub');
    if (!isPdf && !isEpub) {
      alert('Only PDF and EPUB files are supported currently.');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', file.name.replace(/\.[^/.]+$/, "")); // Remove extension

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/vault/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!res.ok) throw new Error('Upload failed');
      
      const newBook = await res.json();
      setBooks([...books, newBook]);
      
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error('Upload error', error);
      alert('Failed to upload book');
    } finally {
      setUploading(false);
    }
  };

  const removeBook = async (id: number) => {
    if (!confirm('Are you sure you want to remove this book from your vault?')) return;
    try {
      await apiFetch(`/api/vault/${id}`, { method: 'DELETE' });
      setBooks(books.filter(b => b.id !== id));
    } catch (error) {
      console.error('Failed to remove book', error);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400 mb-2 flex items-center">
            <Archive className="w-8 h-8 mr-3 text-pink-500" /> Personal Vault
          </h1>
          <p className="text-gray-400">Securely store and read your personal EPUBs and PDFs</p>
        </div>
        
        <div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleUpload} 
            accept=".pdf,.epub" 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-full font-medium hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-pink-500/25 disabled:opacity-50"
          >
            <Upload className="w-5 h-5" />
            <span>{uploading ? 'Uploading...' : 'Upload Book'}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
        </div>
      ) : books.length === 0 ? (
        <div className="text-center py-20 bg-purple-950/10 rounded-2xl border border-purple-900/30 border-dashed">
          <Archive className="w-16 h-16 text-purple-800 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-300 mb-2">Your vault is empty</h3>
          <p className="text-gray-500 mb-6">Upload your personal files to keep them safe and accessible anywhere.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {books.map((book, idx) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              key={book.id}
              className="bg-purple-950/20 border border-purple-900/50 rounded-xl p-6 hover:border-pink-500/50 transition-all group relative flex flex-col items-center text-center"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <FileText className="w-8 h-8 text-pink-400" />
              </div>
              
              <h3 className="font-semibold text-white line-clamp-2 mb-2 w-full" title={book.title}>
                {book.title}
              </h3>
              
              <p className="text-xs text-gray-500 mb-6 mt-auto">
                Added {new Date(book.created_at).toLocaleDateString()}
              </p>
              
              <div className="flex space-x-2 w-full">
                <button 
                  onClick={() => setActiveBook(book)}
                  className="flex-1 bg-pink-600/20 hover:bg-pink-600/40 text-pink-400 text-sm font-medium py-2 rounded-lg flex items-center justify-center transition-colors border border-pink-500/30"
                >
                  <BookOpen className="w-4 h-4 mr-1" /> Read
                </button>
                <a 
                  href={book.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-purple-900/30 hover:bg-purple-800/50 text-purple-400 rounded-lg transition-colors border border-purple-500/30"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button 
                  onClick={() => removeBook(book.id)}
                  className="p-2 bg-red-900/20 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors border border-red-500/30"
                  title="Delete from vault"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Reader Modal */}
      <AnimatePresence>
        {activeBook && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 md:p-8"
          >
            <div className="w-full h-full max-w-6xl bg-gray-900 rounded-2xl overflow-hidden flex flex-col border border-purple-900/50 shadow-2xl">
              <div className="flex justify-between items-center p-4 bg-gray-950 border-b border-purple-900/50">
                <h3 className="text-lg font-semibold text-white truncate pr-4">{activeBook.title}</h3>
                <div className="flex items-center space-x-4">
                  {activeBook.file_url.endsWith('.epub') && (
                    <div className="flex space-x-2">
                      <button onClick={prevEpubPage} className="px-3 py-1 bg-purple-900/50 text-white rounded hover:bg-purple-800 transition-colors">Prev</button>
                      <button onClick={nextEpubPage} className="px-3 py-1 bg-purple-900/50 text-white rounded hover:bg-purple-800 transition-colors">Next</button>
                    </div>
                  )}
                  <button 
                    onClick={() => setActiveBook(null)}
                    className="p-2 bg-red-900/20 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 relative bg-white overflow-hidden">
                {activeBook.file_url.endsWith('.pdf') ? (
                  <iframe 
                    src={activeBook.file_url} 
                    className="w-full h-full border-none"
                    title={activeBook.title}
                  />
                ) : activeBook.file_url.endsWith('.epub') ? (
                  <div ref={epubContainerRef} className="w-full h-full absolute inset-0 text-black"></div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    Unsupported format for in-app reading.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
