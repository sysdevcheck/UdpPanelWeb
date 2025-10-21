'use client';

import { useEffect, useActionState, useTransition, useState } from 'react';
import { saveSshConfig, clearSshConfig } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Server, LogOut, CheckCircle, Terminal } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';


type SshConfig = {
    host: string;
    port: number;
    username: string;
}

type Manager = {
  username: string;
  ssh?: SshConfig;
}

type LogEntry = {
    level: 'INFO' | 'SUCCESS' | 'ERROR';
    message: string;
}

type SshActionState = {
    success: boolean;
    error?: string;
    message?: string;
    log?: LogEntry[];
}

const initialActionState: SshActionState = {
    success: false,
    error: undefined,
    message: undefined,
    log: [],
}

export function SshConfigManager({ owner, ownerUsername }: { owner: Manager | null, ownerUsername: string }) {
    const { toast } = useToast();
    const [sshState, sshAction, isSshPending] = useActionState(saveSshConfig, initialActionState);
    const [log, setLog] = useState<LogEntry[]>([]);
    
    // For the clear action, we'll handle it with useTransition as it's not a form action
    const [isClearingPending, startTransition] = useTransition();

    const handleClearConfig = () => {
        startTransition(async () => {
            const result = await clearSshConfig(ownerUsername);
            if (result.success) {
                toast({ title: 'Success', description: result.message });
                setLog([]); // Clear log on disconnect
            } else if (result.error) {
                toast({ variant: 'destructive', title: 'Error Clearing Config', description: result.error });
            }
        });
    };

    useEffect(() => {
        if (!sshState) return;

        if (sshState.log && sshState.log.length > 0) {
            setLog(sshState.log);
        }

        if(sshState.success && sshState.message) {
            toast({ title: 'Success', description: sshState.message, className: 'bg-green-500 text-white' });
        } else if (sshState.error) {
             toast({ variant: 'destructive', title: 'Connection Failed', description: sshState.error });
        }
        
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sshState]);

    const isPending = isSshPending || isClearingPending;
    const isConnected = owner?.ssh && owner.ssh.host;

    return (
        <Card className="w-full max-w-4xl mx-auto shadow-lg mt-6">
             <CardHeader>
                <CardTitle className="flex items-center gap-2"><Server className="w-5 h-5"/>Remote Server</CardTitle>
                <CardDescription>
                    {isConnected 
                        ? 'You are connected to a remote server. All user management actions will be performed on this server.'
                        : 'Configure a remote VPS to manage users. Leave blank to manage users on the server where this panel is running.'
                    }
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isConnected ? (
                    <div className="flex flex-col items-start gap-4 rounded-lg border p-4">
                        <div className="flex items-center gap-3">
                            <CheckCircle className="h-6 w-6 text-green-500" />
                            <div>
                                <p className="font-semibold">Connected to:</p>
                                <p className="text-muted-foreground font-mono">{owner.ssh?.host}</p>
                            </div>
                        </div>
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" disabled={isPending} className="gap-2">
                                     {isClearingPending ? <Loader2 className="h-4 w-4 animate-spin"/> : <LogOut className="h-4 w-4" />}
                                    Disconnect
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure you want to disconnect?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will clear your saved SSH credentials. You will need to enter them again to manage the remote server.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleClearConfig} variant="destructive" disabled={isPending}>
                                        {isClearingPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                        Disconnect
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                ) : (
                    <form action={sshAction} className="space-y-4">
                        <input type="hidden" name="ownerUsername" value={ownerUsername} />
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="grid gap-1.5">
                                <Label htmlFor="host">Server IP / Hostname</Label>
                                <Input name="host" id="host" placeholder="e.g., 123.45.67.89" defaultValue={owner?.ssh?.host} required disabled={isPending} />
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="port">SSH Port</Label>
                                <Input name="port" id="port" type="number" placeholder="22" defaultValue={owner?.ssh?.port || 22} disabled={isPending} />
                            </div>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="grid gap-1.5">
                                <Label htmlFor="ssh-username">SSH Username</Label>
                                <Input name="username" id="ssh-username" placeholder="e.g., root" defaultValue={owner?.ssh?.username} required disabled={isPending} />
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="ssh-password">SSH Password</Label>
                                <Input name="password" id="ssh-password" type="password" placeholder="Enter SSH password" required disabled={isPending} />
                            </div>
                        </div>
                        <div className='flex justify-end'>
                            <Button type="submit" disabled={isPending} className="gap-2">
                                {isSshPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                Test & Save Connection
                            </Button>
                        </div>
                    </form>
                )}

                {log.length > 0 && (
                    <div className="mt-4 p-4 bg-black rounded-md font-mono text-sm text-white space-y-2">
                         <div className="flex items-center gap-2 border-b border-gray-700 pb-2 mb-2">
                            <Terminal className="w-5 h-5 text-gray-400" />
                            <h3 className="font-semibold">Connection Log</h3>
                        </div>
                        {log.map((entry, index) => (
                            <div key={index} className="flex items-start">
                                <span className={cn('mr-2 font-bold', {
                                    'text-cyan-400': entry.level === 'INFO',
                                    'text-green-400': entry.level === 'SUCCESS',
                                    'text-red-400': entry.level === 'ERROR',
                                })}>
                                    [{entry.level}]
                                </span>
                                <span className="flex-1 whitespace-pre-wrap break-words">{entry.message}</span>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
