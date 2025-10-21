'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Server, Terminal, ServerCrash } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConsoleOutput, LogEntry } from './console-output';

type SshConfig = {
    id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    password?: string;
}

export function ConsoleManager() {
    const { toast } = useToast();

    const [servers, setServers] = useState<SshConfig[]>([]);
    const [selectedServerId, setSelectedServerId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [isExecuting, setIsExecuting] = useState(false);
    const [outputLog, setOutputLog] = useState<LogEntry[]>([]);

    const fetchServers = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/manage-server');
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to fetch servers');
            setServers(data);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchServers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    
    // Clear logs when server changes
    useEffect(() => {
        setOutputLog([]);
    }, [selectedServerId]);

    const selectedServer = servers.find(s => s.id === selectedServerId);

    const handleExecuteCommand = async (command: string) => {
        if (!selectedServer || !command) return;

        const commandLog: LogEntry = { level: 'INPUT', message: `${selectedServer.username}@${selectedServer.host}:~# ${command}` };
        setOutputLog(prev => [...prev, commandLog]);
        setIsExecuting(true);

        try {
            const response = await fetch('/api/ssh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'executeCommand',
                    payload: { command },
                    sshConfig: selectedServer
                })
            });

            const result = await response.json();
            if (!response.ok) {
                 throw new Error(result.error || 'Fallo al ejecutar el comando.');
            }

            const output: LogEntry[] = [];
            if(result.data.stdout) {
                output.push({ level: 'SUCCESS', message: result.data.stdout.trim() });
            }
            if(result.data.stderr) {
                // Filter out common harmless warnings that pollute the output
                const filteredStderr = result.data.stderr.split('\n').filter((line: string) => 
                    line.trim() !== '' && 
                    !line.toLowerCase().includes('stty: not a tty') &&
                    !line.toLowerCase().includes('term environment variable not set')
                ).join('\n');

                if (filteredStderr) {
                    output.push({ level: 'ERROR', message: filteredStderr.trim() });
                }
            }
            if(output.length === 0 && !result.data.stdout && !result.data.stderr) {
                // Don't show a message if there's no output, it's common for some commands
            }

            setOutputLog(prev => [...prev, ...output]);

        } catch (e: any) {
            setOutputLog(prev => [...prev, { level: 'ERROR', message: e.message }]);
        } finally {
            setIsExecuting(false);
        }
    };
    
    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (servers.length === 0) {
        return (
             <Card className="w-full max-w-4xl mx-auto shadow-lg">
                <CardContent className="pt-6">
                    <div className="text-center text-muted-foreground flex flex-col items-center gap-4 py-10">
                        <ServerCrash className="w-12 h-12" />
                        <h3 className="text-lg font-semibold">No hay servidores configurados</h3>
                        <p>Añade un servidor en la pestaña "Servidores" para poder usar la consola.</p>
                    </div>
                </CardContent>
            </Card>
        )
    }


    return (
        <Card className="w-full max-w-4xl mx-auto shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Terminal className="w-5 h-5" />
                    Consola SSH
                </CardTitle>
                <CardDescription>
                    Selecciona un servidor y ejecuta comandos de forma remota.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div>
                        <Select onValueChange={setSelectedServerId} value={selectedServerId}>
                            <SelectTrigger className="w-full sm:w-[280px]">
                                <SelectValue placeholder="Selecciona un servidor..." />
                            </SelectTrigger>
                            <SelectContent>
                                {servers.map(server => (
                                    <SelectItem key={server.id} value={server.id}>
                                        <div className="flex items-center gap-2">
                                            <Server className="w-4 h-4" />
                                            <span>{server.name} ({server.host})</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {selectedServer && (
                        <div className="space-y-4 pt-4">
                             <ConsoleOutput 
                                logs={outputLog} 
                                title={`${selectedServer.username}@${selectedServer.host}:~#`} 
                                className="min-h-[400px]"
                                onCommandSubmit={handleExecuteCommand}
                                isExecuting={isExecuting}
                            />
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
