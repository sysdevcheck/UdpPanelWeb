
'use client';

import { useEffect, useActionState, useState, useRef } from 'react';
import { saveServerConfig, deleteServer, testServerConnection, resetServerConfig, restartService } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Server, Terminal, Trash2, Pencil, Plus, ServerCrash, RefreshCw, Settings2, Power } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type SshConfig = {
    id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    password?: string; // Password is write-only, not read
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

type ServerStatus = 'online' | 'offline' | 'checking';

const initialActionState: SshActionState = {
    success: false,
    error: undefined,
    message: undefined,
    log: [],
}

export function SshConfigManager({ ownerUsername, initialServers }: { ownerUsername: string, initialServers: SshConfig[] }) {
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);
    const [editingServer, setEditingServer] = useState<SshConfig | null>(null);
    const [log, setLog] = useState<LogEntry[]>([]);
    
    const [saveState, saveAction, isSavingPending] = useActionState(saveServerConfig, initialActionState);
    const [deleteState, deleteAction, isDeletingPending] = useActionState(deleteServer, {success: false});
    const [resetState, resetAction, isResettingPending] = useActionState(resetServerConfig, {success: false});
    const [restartState, restartAction, isRestartingPending] = useActionState(restartService, {success: false});


    const [serverStatuses, setServerStatuses] = useState<Record<string, ServerStatus>>({});

    const checkAllServers = async () => {
        setServerStatuses(prev => {
            const checkingState: Record<string, ServerStatus> = {};
            initialServers.forEach(s => { checkingState[s.id] = 'checking' });
            return checkingState;
        });

        const statusPromises = initialServers.map(async (server) => {
            const { success } = await testServerConnection(server);
            return { serverId: server.id, status: success ? 'online' : 'offline' as ServerStatus };
        });

        const results = await Promise.all(statusPromises);

        setServerStatuses(prev => {
            const newStatuses = { ...prev };
            results.forEach(({ serverId, status }) => {
                newStatuses[serverId] = status;
            });
            return newStatuses;
        });
    };

    useEffect(() => {
        checkAllServers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialServers]);

    useEffect(() => {
        if (!saveState) return;
        if (saveState.log && saveState.log.length > 0) setLog(saveState.log);

        if(saveState.success && saveState.message) {
            toast({ title: 'Success', description: saveState.message, className: 'bg-green-500 text-white' });
            setEditingServer(null);
            formRef.current?.reset();
            checkAllServers(); // Re-check statuses after a change
        } else if (saveState.error) {
             toast({ variant: 'destructive', title: 'Action Failed', description: saveState.error });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [saveState]);

     useEffect(() => {
        if (!deleteState) return;
        if(deleteState.success && deleteState.message) {
            toast({ title: 'Success', description: deleteState.message });
            checkAllServers(); // Re-check statuses after a change
        } else if (deleteState.error) {
             toast({ variant: 'destructive', title: 'Delete Failed', description: deleteState.error });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deleteState]);

    useEffect(() => {
        if (!resetState) return;
        if(resetState.success && resetState.message) {
            toast({ title: 'Success', description: resetState.message, className: 'bg-green-500 text-white' });
        } else if (resetState.error) {
             toast({ variant: 'destructive', title: 'Reset Failed', description: resetState.error });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resetState]);

    useEffect(() => {
        if (!restartState) return;
        if (restartState.success && restartState.message) {
            toast({ title: 'Success', description: restartState.message });
        } else if (restartState.error) {
            toast({ variant: 'destructive', title: 'Restart Failed', description: restartState.error });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [restartState]);
    
    const isPending = isSavingPending || isDeletingPending || isResettingPending || isRestartingPending;

    return (
    <>
        <Card className="w-full max-w-5xl mx-auto shadow-lg mt-6">
             <CardHeader>
                <div className='flex justify-between items-start'>
                    <div>
                        <CardTitle className="flex items-center gap-2"><Server className="w-5 h-5"/>Server Management</CardTitle>
                        <CardDescription>
                            Add, edit, or remove your remote VPS configurations. Managers can be assigned to these servers.
                        </CardDescription>
                    </div>
                     <div className='flex gap-2'>
                        <Button variant="outline" onClick={checkAllServers} disabled={Object.values(serverStatuses).some(s => s === 'checking')}>
                            {Object.values(serverStatuses).some(s => s === 'checking') ? <Loader2 className='mr-2 h-4 w-4 animate-spin'/> : <RefreshCw className='mr-2 h-4 w-4'/>}
                             Re-check All
                        </Button>
                        <Button onClick={() => setEditingServer({} as SshConfig)} disabled={isPending}>
                            <Plus className='mr-2 h-4 w-4'/> Add Server
                        </Button>
                     </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Connection Details</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {initialServers.length > 0 ? (
                        initialServers.map((server) => {
                            const status = serverStatuses[server.id];
                            return (
                                <TableRow key={server.id}>
                                  <TableCell>
                                     {status === 'checking' && <Badge variant="secondary"><Loader2 className="mr-2 h-3 w-3 animate-spin" />Checking</Badge>}
                                     {status === 'online' && <Badge className='bg-green-500 hover:bg-green-600'>Online</Badge>}
                                     {status === 'offline' && <Badge variant="destructive">Offline</Badge>}
                                  </TableCell>
                                  <TableCell className="font-medium">{server.name}</TableCell>
                                  <TableCell className='font-mono text-muted-foreground'>{server.username}@{server.host}:{server.port}</TableCell>
                                  <TableCell className="text-right">
                                    <form action={restartAction} className='inline-flex'>
                                        <input type="hidden" name="serverId" value={server.id} />
                                        <input type="hidden" name="ownerUsername" value={ownerUsername} />
                                        <Button type="submit" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-green-500/10 hover:text-green-500" disabled={isPending || status !== 'online'}>
                                            <Power className="h-4 w-4" />
                                        </Button>
                                    </form>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-yellow-500/10 hover:text-yellow-500" disabled={isPending || status !== 'online'}>
                                                <Settings2 className="h-4 w-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <form action={resetAction}>
                                                <input type="hidden" name="serverId" value={server.id} />
                                                <input type="hidden" name="ownerUsername" value={ownerUsername} />
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure you want to reset?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will execute the reset script on <strong className='font-mono'>{server.name}</strong>. It will attempt to back up and restore your users, but this is a destructive operation. Please be certain.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel disabled={isResettingPending}>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction type="submit" variant="destructive" disabled={isResettingPending}>
                                                        {isResettingPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                                        Yes, Reset Server
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </form>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-blue-500/10 hover:text-blue-500" disabled={isPending} onClick={() => setEditingServer(server)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                     <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" disabled={isPending}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <form action={deleteAction}>
                                                <input type="hidden" name="serverId" value={server.id} />
                                                <input type="hidden" name="ownerUsername" value={ownerUsername} />
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will permanently delete the server <strong className='font-mono'>{server.name}</strong>. Managers assigned to this server will lose access. This action cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel disabled={isDeletingPending}>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction type="submit" className="bg-destructive hover:bg-destructive/90" disabled={isDeletingPending}>
                                                        {isDeletingPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                                        Delete Server
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </form>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                  </TableCell>
                                </TableRow>
                            )
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                            <div className='flex flex-col items-center gap-2'>
                                <ServerCrash className='w-8 h-8'/>
                                <span>No servers configured. Add one to get started.</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
            </CardContent>
        </Card>

        <Dialog open={!!editingServer} onOpenChange={(isOpen) => { if (!isOpen) { setEditingServer(null); setLog([])} }}>
            <DialogContent className="sm:max-w-2xl">
                <form ref={formRef} action={saveAction}>
                     <DialogHeader>
                        <DialogTitle>{editingServer?.id ? 'Edit Server' : 'Add New Server'}</DialogTitle>
                        <DialogDescription>
                            Enter the SSH credentials for the server. The connection will be tested before saving.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <input type="hidden" name="ownerUsername" value={ownerUsername} />
                    <input type="hidden" name="serverId" value={editingServer?.id || ''} />

                    <div className="space-y-4 py-4">
                        <div className="grid gap-1.5">
                            <Label htmlFor="name">Server Name</Label>
                            <Input name="name" id="name" placeholder="e.g., VPS-Miami" defaultValue={editingServer?.name} required disabled={isPending} />
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="grid gap-1.5">
                                <Label htmlFor="host">Server IP / Hostname</Label>
                                <Input name="host" id="host" placeholder="e.g., 123.45.67.89" defaultValue={editingServer?.host} required disabled={isPending} />
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="port">SSH Port</Label>
                                <Input name="port" id="port" type="number" placeholder="22" defaultValue={editingServer?.port || 22} disabled={isPending} />
                            </div>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="grid gap-1.5">
                                <Label htmlFor="ssh-username">SSH Username</Label>
                                <Input name="username" id="ssh-username" placeholder="e.g., root" defaultValue={editingServer?.username} required disabled={isPending} />
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="ssh-password">SSH Password</Label>
                                <Input name="password" id="ssh-password" type="password" placeholder={editingServer?.id ? 'Leave blank to keep unchanged' : 'Enter SSH password'} required={!editingServer?.id} disabled={isPending} />
                            </div>
                        </div>

                         {log.length > 0 && (
                            <div className="mt-4 p-4 bg-black rounded-md font-mono text-sm text-white space-y-2 max-h-48 overflow-y-auto">
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
                    </div>

                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="secondary" disabled={isPending}>
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={isPending} className="gap-2">
                            {isSavingPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Test & Save
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    </>
    )
}

    