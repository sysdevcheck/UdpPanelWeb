'use client';

import { cn } from "@/lib/utils";
import React, { useState, useEffect, useRef } from "react";
import { Input } from "./ui/input";
import { Loader2 } from "lucide-react";

export type LogEntry = {
    level: 'INPUT' | 'INFO' | 'SUCCESS' | 'ERROR';
    message: string;
};

interface ConsoleOutputProps {
  logs: LogEntry[];
  title?: string;
  className?: string;
  isExecuting: boolean;
  onCommandSubmit: (command: string) => void;
}

export const ConsoleOutput: React.FC<ConsoleOutputProps> = ({ logs, title = "bash", className, isExecuting, onCommandSubmit }) => {
  const [command, setCommand] = useState('');
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
    if (!command.trim() || isExecuting) return;
    onCommandSubmit(command);
    setCommand('');
  };

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
          <div key={index} className="flex items-start whitespace-pre-wrap break-words">
            {entry.level === 'INPUT' && <span className="text-cyan-400 mr-2 shrink-0">$</span>}
            {entry.level === 'SUCCESS' && <span className="text-green-400 mr-2 shrink-0"></span>}
            {entry.level === 'ERROR' && <span className="text-red-500 mr-2 shrink-0">✗</span>}

            <span
              className={cn({
                "text-cyan-300": entry.level === 'INPUT',
                "text-green-400": entry.level === 'SUCCESS',
                "text-red-400": entry.level === 'ERROR',
                "text-gray-300": entry.level === 'INFO',
              })}
            >
              {entry.message}
            </span>
          </div>
        ))}
         <form onSubmit={handleFormSubmit} className="flex items-center">
            {!isExecuting && (
                <>
                    <span className="text-cyan-400 mr-2 shrink-0">$</span>
                    <Input
                        ref={inputRef}
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        className="bg-transparent border-none text-white p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 font-mono flex-1"
                        autoFocus
                        disabled={isExecuting}
                        spellCheck="false"
                        autoComplete="off"
                    />
                </>
            )}
            {isExecuting && (
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin"/>
                    <span>Ejecutando...</span>
                </div>
            )}
         </form>
      </div>
    </div>
  );
};