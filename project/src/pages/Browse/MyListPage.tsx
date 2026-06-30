import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import BrowseNavbar from '../../components/Navbar/BrowseNavbar';
import { useAuth } from '../../context/AuthContext';

interface WatchlistItem {
  id: string;
  movieId: number;
  title: string;
  posterPath: string;
  mediaType: 'movie' | 'tv';
  addedAt: string;
}

const STORAGE_KEY = 'netflix_watchlist';

const getWatchlist = (): WatchlistItem[] => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
};

const MyListPage: React.FC = () => {
  const { user } = useAuth();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);

  useEffect(() => {
    setWatchlist(getWatchlist());
  }, [user]);

  const removeFromWatchlist = (id: string) => {
    const updated = watchlist.filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setWatchlist(updated);
  };

  return (
    <motion.div
      className="min-h-screen bg-netflix-black text-white overflow-x-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <BrowseNavbar />

      <motion.div
        className="pt-24 pb-8 px-4 md:px-8"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">My List</h1>
          <p className="text-xl text-gray-300 max-w-2xl">Your personal collection of movies and TV shows.</p>
        </div>
      </motion.div>

      <motion.div
        className="relative z-10 pb-12 px-4 md:px-8"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <div className="max-w-7xl mx-auto">
          {watchlist.length === 0 ? (
            <div className="text-center py-20">
              <h2 className="text-2xl font-semibold mb-4">Your list is empty</h2>
              <p className="text-gray-400">Start adding movies and TV shows to your list.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {watchlist.map((item) => (
                <motion.div key={item.id} className="relative group cursor-pointer" whileHover={{ scale: 1.05 }}>
                  <div className="aspect-[2/3] bg-gray-800 rounded-md overflow-hidden">
                    {item.posterPath ? (
                      <img src={`https://image.tmdb.org/t/p/w500${item.posterPath}`} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm text-center p-2">{item.title}</div>
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button onClick={() => removeFromWatchlist(item.id)} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm">Remove</button>
                    </div>
                  </div>
                  <h3 className="mt-2 text-sm font-medium line-clamp-2">{item.title}</h3>
                  <p className="text-xs text-gray-400">{item.mediaType === 'movie' ? 'Movie' : 'TV Show'}</p>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default MyListPage;
