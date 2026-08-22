import React from 'react';
import { Commentary } from '../types';

interface LiveFeedProps {
  messages: Commentary[];
  isActive: boolean;
  isLoading?: boolean;
}

const formatMinute = (minute?: number) => {
  if (minute === undefined || minute === null) {
    return null;
  }
  return `${minute}'`;
};

const formatMetadata = (metadata?: Record<string, unknown>) => {
  if (!metadata || Object.keys(metadata).length === 0) {
    return null;
  }
  try {
    return JSON.stringify(metadata);
  } catch {
    return null;
  }
};

export const LiveFeed: React.FC<LiveFeedProps> = ({ messages, isActive, isLoading }) => {
  if (!isActive) {
    return (
      <div className="h-full w-full min-h-[450px] flex flex-col items-center justify-center text-center p-8 bg-gray-50 border-2 border-black rounded-2xl border-dashed">
        <div className="w-16 h-16 bg-brand-yellow rounded-full border-2 border-black flex items-center justify-center mb-4 shadow-hard-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="font-bold text-xl mb-2">No Match Selected</h3>
        <p className="text-gray-500 max-w-xs text-sm">Select a match from the list to view live commentary and real-time updates.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full max-h-full bg-white border-2 border-black rounded-2xl overflow-hidden shadow-hard">
      <div className="p-4 bg-brand-blue border-b-2 border-black flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-black"></span>
          </span>
          <h3 className="font-bold text-lg">Live Commentary</h3>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <span className="text-[11px] font-bold bg-black text-white px-2 py-0.5 rounded-full">
              {messages.length}
            </span>
          )}
          <span className="text-xs bg-white px-2 py-0.5 border border-black rounded-md font-medium">Real-time</span>
        </div>
      </div>
      
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {isLoading ? (
          <div className="text-center py-12 text-gray-400 italic flex flex-col items-center gap-2">
            <div className="animate-spin w-6 h-6 border-2 border-brand-yellow border-t-black rounded-full"></div>
            <span className="text-sm">Loading commentary...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-gray-400 italic text-sm">
            Waiting for live match events...
          </div>
        ) : (
          messages.map((msg) => {
            const timestamp = msg.createdAt ? new Date(msg.createdAt) : new Date();
            const minuteLabel = formatMinute(msg.minute);
            const metadataLabel = formatMetadata(msg.metadata);
            return (
              <div key={msg.id} className="animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center gap-1 mt-1 shrink-0">
                     <div className="w-2.5 h-2.5 rounded-full bg-brand-yellow border border-black"></div>
                     <div className="w-0.5 h-full bg-gray-200"></div>
                  </div>
                  <div className="pb-3 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mb-1">
                      <span className="font-mono text-gray-400 text-[11px]">
                        {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      {minuteLabel && (
                        <span className="px-2 py-0.5 bg-gray-100 border border-gray-200 rounded-full font-semibold text-[11px]">
                          {minuteLabel}
                        </span>
                      )}
                      {msg.sequence !== undefined && msg.sequence !== null && (
                        <span className="px-2 py-0.5 bg-gray-100 border border-gray-200 rounded-full font-semibold text-[11px]">
                          Seq {msg.sequence}
                        </span>
                      )}
                      {msg.period && (
                        <span className="px-2 py-0.5 bg-gray-100 border border-gray-200 rounded-full text-[11px]">
                          {msg.period}
                        </span>
                      )}
                      {msg.eventType && (
                        <span className="px-2 py-0.5 bg-brand-yellow border border-black rounded-full font-semibold uppercase tracking-wide text-[10px]">
                          {msg.eventType}
                        </span>
                      )}
                    </div>
                    {(msg.actor || msg.team) && (
                      <div className="text-xs font-semibold text-gray-700 mb-1.5 truncate">
                        {msg.actor ? msg.actor : 'Unknown'}{msg.team ? ` · ${msg.team}` : ''}
                      </div>
                    )}
                    <p className="text-sm font-medium text-gray-800 leading-relaxed bg-gray-50 p-3 rounded-xl rounded-tl-none border border-gray-200 break-words">
                      {msg.message}
                    </p>
                    {metadataLabel && (
                      <div className="mt-1.5 text-[11px] font-mono text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded break-all">
                        {metadataLabel}
                      </div>
                    )}
                    {msg.tags && msg.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {msg.tags.map((tag) => (
                          <span key={`${msg.id}-${tag}`} className="text-[10px] uppercase tracking-wide text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
