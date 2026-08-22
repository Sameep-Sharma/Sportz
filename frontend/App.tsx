import React, { useEffect, useMemo, useState } from 'react';
import { useMatchData } from './hooks/useMatchData';
import { MatchCard } from './components/MatchCard';
import { LiveFeed } from './components/LiveFeed';
import { StatusIndicator } from './components/StatusIndicator';
import { API_BASE_URL } from './constants';

const App: React.FC = () => {
  const pageSize = 6;
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSport, setSelectedSport] = useState<string>('all');
  const [isSyncing, setIsSyncing] = useState(false);

  const {
    matches,
    isLoading,
    error,
    commentary,
    isCommentaryLoading,
    wsError,
    status,
    activeMatchId,
    newMatchesCount,
    dismissNewMatches,
    watchMatch,
    unwatchMatch,
    reloadMatches,
  } = useMatchData();

  // Filter matches by selected sport tab
  const filteredMatches = useMemo(() => {
    if (selectedSport === 'all') return matches;
    return matches.filter((m) => m.sport.toLowerCase().includes(selectedSport.toLowerCase()));
  }, [matches, selectedSport]);

  const totalPages = Math.max(1, Math.ceil(filteredMatches.length / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedSport]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pagedMatches = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredMatches.slice(startIndex, startIndex + pageSize);
  }, [filteredMatches, currentPage, pageSize]);

  // Counts by sport
  const counts = useMemo(() => {
    const footballCount = matches.filter((m) => m.sport.toLowerCase().includes('football')).length;
    const cricketCount = matches.filter((m) => m.sport.toLowerCase().includes('cricket')).length;
    const basketballCount = matches.filter((m) => m.sport.toLowerCase().includes('basketball')).length;
    return {
      all: matches.length,
      football: footballCount,
      cricket: cricketCount,
      basketball: basketballCount,
    };
  }, [matches]);

  const handleSyncWorldFeeds = async () => {
    setIsSyncing(true);
    try {
      await fetch(`${API_BASE_URL}/sync`, { method: 'POST' });
      reloadMatches();
    } catch (e) {
      console.error('Failed to trigger sync:', e);
    } finally {
      setTimeout(() => setIsSyncing(false), 800);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 font-sans bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-brand-yellow border-2 border-black rounded-2xl p-6 shadow-hard">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-brand-dark mb-1 flex items-center gap-2">
              <span>Spotrz</span>
              <span className="text-xs bg-black text-white px-2.5 py-1 rounded-full font-bold uppercase tracking-widest">
                Global Live
              </span>
            </h1>
            <p className="text-sm font-medium opacity-80">Real-time live scores and play-by-play data from all over the world</p>
          </div>
          <div className="flex flex-col md:items-end gap-3 w-full md:w-auto">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSyncWorldFeeds}
                disabled={isSyncing}
                className={`
                  px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black bg-white hover:bg-gray-100 transition-all shadow-hard-sm flex items-center gap-1.5 active:translate-y-0.5
                  ${isSyncing ? 'opacity-75 cursor-not-allowed' : ''}
                `}
              >
                <span className={isSyncing ? 'animate-spin inline-block' : ''}>⚡</span>
                <span>{isSyncing ? 'Syncing Feeds...' : 'Sync Live Feeds'}</span>
              </button>
              <StatusIndicator status={status} />
            </div>
            {wsError && (
              <span className="text-xs font-mono bg-red-100 text-red-700 border border-red-200 px-2 py-1 rounded">
                WS: {wsError}
              </span>
            )}
          </div>
        </header>

        {/* Sport Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          {[
            { id: 'all', label: 'All Matches', icon: '🌐', count: counts.all },
            { id: 'football', label: 'Football', icon: '⚽', count: counts.football },
            { id: 'cricket', label: 'Cricket', icon: '🏏', count: counts.cricket },
            { id: 'basketball', label: 'Basketball', icon: '🏀', count: counts.basketball },
          ].map((tab) => {
            const isSelected = selectedSport === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedSport(tab.id)}
                className={`
                  px-4 py-2 rounded-xl text-xs font-bold border-2 border-black transition-all flex items-center gap-2 shadow-hard-sm
                  ${isSelected ? 'bg-brand-yellow text-black -translate-y-0.5 shadow-hard' : 'bg-white text-gray-700 hover:bg-gray-100'}
                `}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${isSelected ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 border border-gray-300'}`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Match List */}
          <main className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold border-l-4 border-brand-blue pl-3 flex items-center gap-2">
                <span>Live Fixtures</span>
                <span className="text-xs font-normal text-gray-500">
                  ({filteredMatches.length} {selectedSport === 'all' ? 'matches' : selectedSport})
                </span>
              </h2>
            </div>
            {newMatchesCount > 0 && (
              <div className="flex items-center justify-between gap-3 bg-brand-yellow border-2 border-black rounded-xl px-4 py-3 shadow-hard-sm">
                <span className="text-sm font-bold">
                  {newMatchesCount} new live match{newMatchesCount > 1 ? 'es' : ''} added
                </span>
                <button
                  onClick={dismissNewMatches}
                  className="px-3 py-1 rounded-full text-xs font-bold border-2 border-black bg-white hover:bg-gray-50 transition-all"
                >
                  Dismiss
                </button>
              </div>
            )}

            {isLoading && (
              <div className="p-12 text-center border-2 border-dashed border-gray-300 rounded-2xl bg-white">
                <div className="animate-spin w-8 h-8 border-4 border-brand-yellow border-t-black rounded-full mx-auto mb-4"></div>
                <p className="font-medium text-gray-500">Retrieving live global sports data...</p>
              </div>
            )}

            {error && (
               <div className="bg-red-50 border-2 border-red-500 text-red-900 p-6 rounded-xl text-center shadow-sm">
                  <div className="flex justify-center mb-3 text-red-500">
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  </div>
                  <h3 className="text-lg font-bold mb-1">Connection Error</h3>
                  <p className="font-mono text-sm bg-red-100 py-1 px-2 rounded inline-block mb-4 border border-red-200">{error}</p>
                  <button 
                    onClick={reloadMatches}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm transition-all shadow-md active:translate-y-0.5"
                  >
                    Retry Connection
                  </button>
               </div>
            )}

            {!isLoading && !error && filteredMatches.length === 0 && (
              <div className="p-12 text-center border-2 border-black rounded-2xl bg-white shadow-hard-sm">
                <p className="font-bold text-lg mb-1">No live matches in this category</p>
                <p className="text-sm text-gray-500 mb-4">Click "Sync Live Feeds" or select another sport tab.</p>
                <button
                  onClick={handleSyncWorldFeeds}
                  className="px-4 py-2 rounded-xl text-xs font-bold border-2 border-black bg-brand-yellow hover:bg-yellow-300 transition-all shadow-hard-sm"
                >
                  ⚡ Sync World Feeds
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pagedMatches.map((match) => (
                <MatchCard 
                  key={match.id} 
                  match={match} 
                  // eslint-disable-next-line eqeqeq
                  isActive={activeMatchId == match.id}
                  onWatch={watchMatch}
                  onUnwatch={unwatchMatch}
                />
              ))}
            </div>
            {!isLoading && !error && filteredMatches.length > pageSize && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <span className="text-xs font-medium text-gray-500">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className={`
                      px-3 py-1.5 rounded-lg text-xs font-bold border-2 border-black transition-all shadow-hard-sm
                      ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white hover:bg-gray-50'}
                    `}
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className={`
                      px-3 py-1.5 rounded-lg text-xs font-bold border-2 border-black transition-all shadow-hard-sm
                      ${currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white hover:bg-gray-50'}
                    `}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </main>

          {/* Right Column: Live Commentary Feed */}
          <aside className="lg:col-span-1">
            <div className="sticky top-6 h-[580px] lg:h-[calc(100vh-4.5rem)] lg:max-h-[720px] min-h-[450px] flex flex-col">
              <LiveFeed 
                messages={commentary} 
                isActive={activeMatchId != null}
                isLoading={isCommentaryLoading}
              />
            </div>
          </aside>

        </div>
      </div>
    </div>
  );
};

export default App;
