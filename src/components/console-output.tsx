
'use client';

import { cn } from "@/lib/utils";
import { Terminal } from "lucide-react";
import React from "react";

export type LogEntry = {
    level: 'INFO' | 'SUCCESS' | 'ERROR';
    message: string;
};

interface ConsoleOutputProps {
  logs: LogEntry[];
  title?: string;
  className?: string;
}

export const ConsoleOutput: React.FC<ConsoleOutputProps> = ({ logs, title = "bash", className }) => {
  return (
    <div className={cn("bg-[#2d2d2d] rounded-lg shadow-lg overflow-hidden border border-black/20", className)}>
      <div className="bg-[#3c3c3c] px-4 py-2 flex items-center gap-2 border-b border-black/20">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
        <div className="text-xs text-gray-300 font-mono flex-grow text-center">{title}</div>
      </div>
      <div className="p-4 font-mono text-sm text-white max-h-60 overflow-y-auto">
        {logs.map((entry, index) => (
          <div key={index} className="flex items-start">
            {entry.level === 'INFO' && <span className="text-cyan-400 mr-2 shrink-0">$</span>}
            {entry.level === 'SUCCESS' && <span className="text-green-400 mr-2 shrink-0">✓</span>}
            {entry.level === 'ERROR' && <span className="text-red-500 mr-2 shrink-0">✗</span>}

            <span
              className={cn("flex-1 whitespace-pre-wrap break-words", {
                "text-cyan-300": entry.level === 'INFO',
                "text-green-400": entry.level === 'SUCCESS',
                "text-red-400": entry.level === 'ERROR',
              })}
            >
              {entry.message}
            </span>
          </div>
        ))}
         <div className="w-2 h-4 bg-white animate-pulse mt-1"></div>
      </div>
    </div>
  );
};

    