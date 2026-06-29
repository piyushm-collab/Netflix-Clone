import React from 'react';
import { useAuth } from '../../context/AuthContext';
import Banner from '../../components/Banner/Banner';
import Row from '../../components/Row/Row';
import BrowseNavbar from '../../components/Navbar/BrowseNavbar';
import requests from '../../api/requests';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import './BrowsePage.css';

const BrowsePage: React.FC = () => {
  const { user, signOut } = useAuth();

  return (
    <motion.div
      className="min-h-screen bg-netflix-black text-white overflow-x-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <BrowseNavbar />

      <Banner />

      <motion.div
        className="relative z-10 mt-[-20px] pb-12"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Row title="NETFLIX ORIGINALS" fetchURL={requests.fetchNetflixOriginals} isLargeRow />
        <Row title="Trending Now" fetchURL={requests.fetchTrending} />
        <Row title="Top Rated" fetchURL={requests.fetchTopRated} />
        <Row title="Action Movies" fetchURL={requests.fetchActionMovies} />
        <Row title="Comedy Movies" fetchURL={requests.fetchComedyMovies} />
        <Row title="Horror Movies" fetchURL={requests.fetchHorrorMovies} />
        <Row title="Romance Movies" fetchURL={requests.fetchRomanceMovies} />
        <Row title="Documentaries" fetchURL={requests.fetchDocumentaries} />
      </motion.div>

      <motion.div
        className="mt-10 mx-4 md:mx-8 p-6 bg-[#141414] rounded-md shadow-lg mb-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">My Account</h2>
          <button onClick={() => signOut()} className="bg-netflix-red px-4 py-2 rounded-md hover:bg-red-700 transition-colors text-sm">
            Sign Out
          </button>
        </div>
        <p className="text-zinc-400 mb-3">
          Signed in as: <span className="text-white font-semibold">{user?.email}</span>
        </p>
        {user?.subscription ? (
          <p className="text-green-400 text-sm">
            ✓ {user.subscription.planName} plan active —{' '}
            <Link to="/plans" className="underline hover:text-white">change plan</Link>
          </p>
        ) : (
          <p className="text-zinc-400 text-sm">
            No active subscription.{' '}
            <Link to="/plans" className="text-red-400 underline hover:text-white">Choose a plan →</Link>
          </p>
        )}
      </motion.div>
    </motion.div>
  );
};

export default BrowsePage;
