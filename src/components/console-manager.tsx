
'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

    const selectedServer = servers.find(s => s.id === selectedServerId);

    const handleExecuteCommand = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!selectedServer) return;

        const formData = new FormData(e.currentTarget);
        const command = formData.get('command') as string;

        if (!command) {
            toast({ variant: 'destructive', title: 'Error', description: 'El comando no puede estar vacío.' });
            return;
        }

        setIsExecuting(true);
        const commandLog: LogEntry = { level: 'INFO', message: `root@${selectedServer.host}:~# ${command}` };
        setOutputLog(prev => [...prev, commandLog]);

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
                output.push({ level: 'SUCCESS', message: result.data.stdout });
            }
            if(result.data.stderr) {
                output.push({ level: 'ERROR', message: result.data.stderr });
            }
            if(output.length === 0) {
                output.push({ level: 'INFO', message: 'El comando no produjo ninguna salida.' });
            }

            setOutputLog(prev => [...prev, ...output]);
             // Reset form
            (e.target as HTMLFormElement).reset();

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
                                title={`root@${selectedServer.host}:~#`} 
                                className="min-h-[300px]"
                            />
                            <form onSubmit={handleExecuteCommand} className="flex gap-2">
                                <Input
                                    name="command"
                                    placeholder="Escribe un comando y presiona Enter..."
                                    className="font-mono"
                                    disabled={isExecuting}
                                    autoComplete="off"
                                />
                                <Button type="submit" disabled={isExecuting}>
                                    {isExecuting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ejecutar"}
                                </Button>
                            </form>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

