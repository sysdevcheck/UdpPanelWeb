'use client';

import { cn } from "@/lib/utils";
import React, { useState, useEffect, useRef } from "react";
import { Input } from "./ui/input";
import { Loader2, Folder, File as FileIcon } from "lucide-react";

export type LogEntry = {
    level: 'INPUT' | 'INFO' | 'SUCCESS' | 'ERROR';
    message: string;
};

interface ConsoleOutputProps {
  logs: LogEntry[];
  title?: string;
  prompt?: string;
  className?: string;
  isExecuting: boolean;
  onCommandSubmit: (command: string) => void;
}

const renderLine = (line: string) => {
    // ls -l output check
    if (line.startsWith('d')) {
        return (
            <span className="flex items-center gap-2 text-cyan-400">
                <Folder className="w-4 h-4 shrink-0" />
                <span>{line}</span>
            </span>
        );
    }
    if (line.startsWith('-')) {
         return (
            <span className="flex items-center gap-2">
                <FileIcon className="w-4 h-4 shrink-0 text-muted-foreground" />
                <span>{line}</span>
            </span>
        );
    }
    return <span>{line}</span>;
}


export const ConsoleOutput: React.FC<ConsoleOutputProps> = ({ logs, title = "bash", prompt = "$", className, isExecuting, onCommandSubmit }) => {
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
    if (!isExecuting) {
        inputRef.current?.focus();
    }
  }, [logs, isExecuting]);

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedCommand = command.trim();
    if (!trimmedCommand || isExecuting) return;

    onCommandSubmit(trimmedCommand);
    setHistory(prev => {
        const newHistory = [trimmedCommand, ...prev.filter(h => h !== trimmedCommand)];
        return newHistory.slice(0, 50); // Keep last 50 commands
    });
    setHistoryIndex(-1);
    setCommand('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (history.length === 0) return;

      if (e.key === 'ArrowUp') {
          e.preventDefault();
          const newIndex = Math.min(historyIndex + 1, history.length - 1);
          setHistoryIndex(newIndex);
          setCommand(history[newIndex] || '');
      } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (historyIndex > 0) {
              const newIndex = historyIndex - 1;
              setHistoryIndex(newIndex);
              setCommand(history[newIndex] || '');
          } else {
              setHistoryIndex(-1);
              setCommand('');
          }
      }
  }

  const handleWrapperClick = () => {
    inputRef.current?.focus();
  };

  return (
    <div 
        className={cn("bg-[#2d2d2d] rounded-lg shadow-lg overflow-hidden border border-black/20", className)}
        onClick={handleWrapperClick}
    >
      <div className="bg-[#3c3c3c] px-4 py-2 flex items-center gap-2 border-b border-black/20">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
        <div className="text-xs text-gray-300 font-mono flex-grow text-center">{title}</div>
      </div>
      <div ref={scrollAreaRef} className="p-4 font-mono text-sm text-white max-h-96 overflow-y-auto cursor-text h-full">
        {logs.map((entry, index) => (
            <div key={index} className="whitespace-pre-wrap break-words">
                {entry.level === 'INPUT' ? (
                    <div className="flex">
                        <span className="text-cyan-400 mr-2 shrink-0">{prompt}</span>
                        <span className="text-cyan-300">{entry.message}</span>
                    </div>
                ) : (
                    <div
                    className={cn({
                        "text-green-400": entry.level === 'SUCCESS',
                        "text-red-400": entry.level === 'ERROR',
                        "text-gray-300": entry.level === 'INFO',
                    })}
                    >
                        {entry.message.split('\n').map((line, lineIndex) => (
                           <div key={`${index}-${lineIndex}`}>{renderLine(line)}</div>
                        ))}
                    </div>
                )}
            </div>
        ))}
         <form onSubmit={handleFormSubmit} className="flex items-center">
            <span className="text-cyan-400 mr-2 shrink-0">{prompt}</span>
            {isExecuting && <Loader2 className="w-4 h-4 animate-spin absolute" />}
            <Input
                ref={inputRef}
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={handleKeyDown}
                className={cn(
                  "bg-transparent border-none text-white p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 font-mono flex-1",
                   isExecuting && "pl-6"
                )}
                autoFocus
                disabled={isExecuting}
                spellCheck="false"
                autoComplete="off"
            />
         </form>
      </div>
    </div>
  );
};
