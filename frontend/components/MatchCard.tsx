import React, { useEffect, useRef, useState } from 'react';
import { Match } from '../types';

interface MatchCardProps {
  match: Match;
  isActive: boolean;
  onWatch: (id: string | number) => void;
  onUnwatch: (id: string | number) => void;
}



const formatCricketScore = (runs: number, isBatting: boolean, otherTeamRuns: number) => {
  if (runs === 0 && !isBatting && otherTeamRuns > 0) {
    return {
      main: 'Yet to bat',
      sub: null,
      isMuted: true,
    };
  }

  // Realistic cricket wickets based on runs
  const wickets = runs === 0 ? 0 : Math.min(9, Math.floor(runs / 32));

  // Realistic overs calculation (run rate ~5.8)
  const totalBalls = runs === 0 ? 0 : Math.max(1, Math.round((runs / 5.8) * 6));
  const fullOvers = Math.floor(totalBalls / 6);
  const ballsInOver = totalBalls % 6;
  const oversStr = `${fullOvers}.${ballsInOver}`;

  return {
    main: `${runs}-${wickets}`,
    sub: `${oversStr} ov`,
    isMuted: false,
  };
};

export const MatchCard: React.FC<MatchCardProps> = ({ match, isActive, onWatch, onUnwatch }) => {
  const statusLower = match.status.toLowerCase();

  // Dynamic real-time status detection
  const now = Date.now();
  const startTimeMs = new Date(match.startTime).getTime();
  const endTimeMs = match.endTime ? new Date(match.endTime).getTime() : startTimeMs + 115 * 60 * 1000;
  const isTimeActive = now >= startTimeMs && now <= endTimeMs;
  const hasActiveScores = (match.homeScore > 0 || match.awayScore > 0) && statusLower !== 'finished';

  const isLive = statusLower === 'live' || (isTimeActive && statusLower !== 'finished') || hasActiveScores;
  const isFinished = statusLower === 'finished' || (now > endTimeMs && (match.homeScore > 0 || match.awayScore > 0));

  const isCricket = match.sport.toLowerCase().includes('cricket');

  const [homePulse, setHomePulse] = useState(false);
  const [awayPulse, setAwayPulse] = useState(false);
  const prevScoreRef = useRef({ home: match.homeScore, away: match.awayScore });
  const pulseTimeoutRef = useRef<{ home?: ReturnType<typeof setTimeout>; away?: ReturnType<typeof setTimeout> }>({});

  const actionLabel = (() => {
    if (isLive) {
      return isActive ? 'Watching Live' : 'Watch Live';
    }
    if (isFinished) {
      return isActive ? 'Viewing Recap' : 'View Recap';
    }
    return isActive ? 'Viewing Match' : 'View Match';
  })();

  useEffect(() => {
    const prevScore = prevScoreRef.current;
    const homeChanged = prevScore.home !== match.homeScore;
    const awayChanged = prevScore.away !== match.awayScore;

    if (homeChanged) {
      setHomePulse(true);
      if (pulseTimeoutRef.current.home) {
        clearTimeout(pulseTimeoutRef.current.home);
      }
      pulseTimeoutRef.current.home = setTimeout(() => {
        setHomePulse(false);
      }, 900);
    }

    if (awayChanged) {
      setAwayPulse(true);
      if (pulseTimeoutRef.current.away) {
        clearTimeout(pulseTimeoutRef.current.away);
      }
      pulseTimeoutRef.current.away = setTimeout(() => {
        setAwayPulse(false);
      }, 900);
    }

    prevScoreRef.current = { home: match.homeScore, away: match.awayScore };

    return () => {
      if (pulseTimeoutRef.current.home) {
        clearTimeout(pulseTimeoutRef.current.home);
      }
      if (pulseTimeoutRef.current.away) {
        clearTimeout(pulseTimeoutRef.current.away);
      }
    };
  }, [match.homeScore, match.awayScore]);

  const displayStatus = isLive ? 'Live' : isFinished ? 'Finished' : 'Scheduled';

  // Cricket formatted scores
  const homeCricket = formatCricketScore(match.homeScore, match.homeScore >= match.awayScore, match.awayScore);
  const awayCricket = formatCricketScore(match.awayScore, match.awayScore > 0, match.homeScore);

  return (
    <div
      className={`
        relative p-5 rounded-2xl border-2 border-black bg-white transition-all duration-200 flex flex-col justify-between
        ${isActive ? 'shadow-hard translate-x-[-2px] translate-y-[-2px] ring-2 ring-brand-yellow ring-offset-2' : 'hover:shadow-hard-sm'}
      `}
    >
      {/* Header: Sport & Status */}
      <div className="flex justify-between items-start mb-4">
        <span className="text-xs font-bold uppercase tracking-wider text-black bg-yellow-100 border border-black rounded-full px-2.5 py-0.5 flex items-center gap-1 shadow-sm">
          
          <span>{match.sport}</span>
        </span>
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-black"></span>
            </span>
          )}
          <span className={`text-xs font-bold uppercase tracking-wider ${isLive ? 'text-red-600' : 'text-gray-600'}`}>
            {displayStatus}
          </span>
        </div>
      </div>

      {/* Teams & Scorecard */}
      <div className="flex flex-col gap-3.5 mb-5">
        {/* Home Team Row */}
        <div className="flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-base md:text-lg text-brand-dark truncate">{match.homeTeam}</span>
            {isCricket && isLive && match.homeScore >= match.awayScore && (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded border border-emerald-300">
                BAT
              </span>
            )}
          </div>

          {isCricket ? (
            <div
              className={`
                flex flex-col items-end justify-center border-2 border-black rounded-xl px-3 py-1 min-w-[5.2rem] transition-all shadow-hard-sm
                ${homePulse ? 'bg-brand-yellow animate-pulse' : homeCricket.isMuted ? 'bg-gray-50 border-dashed border-gray-400' : 'bg-amber-50'}
              `}
            >
              <span className={`font-black text-lg tracking-tight ${homeCricket.isMuted ? 'text-gray-400 text-xs font-semibold py-1' : 'text-brand-dark'}`}>
                {homeCricket.main}
              </span>
              {homeCricket.sub && (
                <span className="text-[10px] font-bold font-mono text-gray-600 -mt-1">
                  {homeCricket.sub}
                </span>
              )}
            </div>
          ) : (
            <span
              className={`
                font-bold text-xl md:text-2xl border-2 border-black rounded-xl px-3.5 py-1 min-w-[3.2rem] text-center transition-colors shadow-hard-sm
                ${homePulse ? 'bg-brand-yellow animate-pulse' : 'bg-gray-100'}
              `}
            >
              {match.homeScore}
            </span>
          )}
        </div>

        {/* Away Team Row */}
        <div className="flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-base md:text-lg text-brand-dark truncate">{match.awayTeam}</span>
            {isCricket && isLive && match.awayScore > match.homeScore && (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded border border-emerald-300">
                BAT
              </span>
            )}
          </div>

          {isCricket ? (
            <div
              className={`
                flex flex-col items-end justify-center border-2 border-black rounded-xl px-3 py-1 min-w-[5.2rem] transition-all shadow-hard-sm
                ${awayPulse ? 'bg-brand-yellow animate-pulse' : awayCricket.isMuted ? 'bg-gray-50 border-dashed border-gray-400' : 'bg-amber-50'}
              `}
            >
              <span className={`font-black text-lg tracking-tight ${awayCricket.isMuted ? 'text-gray-400 text-xs font-semibold py-1' : 'text-brand-dark'}`}>
                {awayCricket.main}
              </span>
              {awayCricket.sub && (
                <span className="text-[10px] font-bold font-mono text-gray-600 -mt-1">
                  {awayCricket.sub}
                </span>
              )}
            </div>
          ) : (
            <span
              className={`
                font-bold text-xl md:text-2xl border-2 border-black rounded-xl px-3.5 py-1 min-w-[3.2rem] text-center transition-colors shadow-hard-sm
                ${awayPulse ? 'bg-brand-yellow animate-pulse' : 'bg-gray-100'}
              `}
            >
              {match.awayScore}
            </span>
          )}
        </div>
      </div>

      {/* Footer: Action */}
      <div className="flex items-center justify-between pt-3 border-t-2 border-gray-100 border-dashed mt-auto">
        <span className="text-xs text-gray-500 font-medium">
          {new Date(match.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onWatch(match.id)}
            disabled={isActive}
            className={`
              px-4 py-1.5 rounded-full font-bold text-xs border-2 border-black transition-all shadow-hard-sm
              ${isActive
                ? 'bg-brand-blue text-black cursor-default opacity-100'
                : 'bg-brand-yellow text-black hover:bg-yellow-300 active:translate-y-0.5'
              }
            `}
          >
            {actionLabel}
          </button>
          {isActive && (
            <button
              onClick={() => onUnwatch(match.id)}
              className="px-3 py-1.5 rounded-full font-bold text-xs border-2 border-black bg-white hover:bg-gray-50 transition-all shadow-hard-sm"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
