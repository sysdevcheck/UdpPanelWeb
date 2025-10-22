
'use client';

import { useEffect, useState, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Server, Trash2, Pencil, Plus, ServerCrash, RefreshCw, Settings2, Power } from 'lucide-react';
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
import { testServerConnection, resetServerConfig, restartService } from '@/app/actions';


type SshConfig = {
    id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    password?: string;
    serviceCommand?: string;
}

type ServerStatus = 'online' | 'offline' | 'comprobando' | 'unknown';


export function SshConfigManager() {
    const { toast } = useToast();

    const formRef = useRef<HTMLFormElement>(null);
    const [servers, setServers] = useState<SshConfig[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingServer, setEditingServer] = useState<Partial<SshConfig> | null>(null);
    const [isSavingPending, setIsSavingPending] = useState(false);
    const [isDeletingPending, setIsDeletingPending] = useState(false);
    const [isActionPending, setIsActionPending] = useState<Record<string, boolean>>({});

    const [serverStatuses, setServerStatuses] = useState<Record<string, ServerStatus>>({});
    
    const fetchServers = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/manage-server');
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to fetch servers');
            setServers(data);
            
            const initialStatuses: Record<string, ServerStatus> = {};
            data.forEach((s: SshConfig) => { initialStatuses[s.id] = 'unknown' });
            setServerStatuses(initialStatuses);
            
            checkAllServers(data);
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

    const checkAllServers = async (serverList: SshConfig[]) => {
        if (!serverList || serverList.length === 0) return;

        setServerStatuses(prev => {
            const checkingState: Record<string, ServerStatus> = { ...prev };
            serverList.forEach(s => { checkingState[s.id] = 'comprobando' });
            return checkingState;
        });

        const statusPromises = serverList.map(async (server) => {
            const result = await testServerConnection(server);
            return { serverId: server.id, status: result.success ? 'online' : 'offline' as ServerStatus };
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

    const handleSaveServer = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSavingPending(true);
        
        const formData = new FormData(e.currentTarget);
        const serverId = formData.get('serverId') as string | null;
        const name = formData.get('name') as string;
        const host = formData.get('host') as string;
        const port = formData.get('port') as string;
        const username = formData.get('username') as string;
        const password = formData.get('password') as string;
        const serviceCommand = formData.get('serviceCommand') as string;

        if (!name || !host || !username || (!password && !serverId)) {
            toast({ variant: 'destructive', title: 'Error', description: 'Nombre, host, usuario y contraseña son requeridos para nuevos servidores.' });
            setIsSavingPending(false);
            return;
        }

        const serverData: Partial<SshConfig> = {
            name,
            host,
            port: port ? parseInt(port, 10) : 22,
            username,
            serviceCommand: serviceCommand || 'systemctl restart zivpn'
        };
        if(serverId) serverData.id = serverId;

        if (password) {
            serverData.password = password;
        }
        
        try {
            // Step 1: Explicitly test connection first
            const testResult = await testServerConnection(serverData);
            if (!testResult.success) {
                throw new Error("La conexión falló. Verifica la IP, puerto, usuario y contraseña.");
            }

            // Step 2: If connection is successful, proceed to save
            const response = await fetch('/api/manage-server', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(serverData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Fallo al guardar el servidor');
            }

            toast({ title: 'Éxito', description: result.message });
            setEditingServer(null);
            formRef.current?.reset();
            fetchServers();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Acción Fallida', description: e.message });
        } finally {
            setIsSavingPending(false);
        }
    }

    const handleDeleteServer = async (serverId: string) => {
        setIsDeletingPending(true);
        try {
            const response = await fetch('/api/manage-server', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serverId })
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Fallo al eliminar el servidor.');
            }
            toast({ title: 'Éxito', description: 'Servidor y recursos asociados eliminados.' });
            fetchServers();
        } catch (e: any) {
             toast({ variant: 'destructive', title: 'Eliminación Fallida', description: e.message });
        } finally {
            setIsDeletingPending(false);
        }
    }

    const handleServerAction = async (action: 'reset' | 'restart', server: SshConfig) => {
        setIsActionPending(prev => ({...prev, [server.id]: true}));

        const actionFn = action === 'reset' ? resetServerConfig : restartService;
        
        const formData = new FormData();
        formData.set('serverId', server.id);
        formData.set('sshConfig', JSON.stringify(server)); // Pass the whole config

        // Using a dummy prevState
        const result = await actionFn({ success: false }, formData);

        if (result.success) {
            toast({ title: 'Éxito', description: result.message });
        } else if (result.error) {
            toast({ variant: 'destructive', title: 'Acción Fallida', description: result.error });
        }
        
        setIsActionPending(prev => ({...prev, [server.id]: false}));
    }

    const isPending = isSavingPending || isDeletingPending || Object.values(isActionPending).some(p => p);
    
    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
    <>
        <Card className="w-full max-w-5xl mx-auto shadow-lg mt-6">
             <CardHeader>
                <div className='flex justify-between items-start'>
                    <div>
                        <CardTitle className="flex items-center gap-2"><Server className="w-5 h-5"/>Gestión de Servidores</CardTitle>
                        <CardDescription>
                            Añade, edita o elimina las configuraciones de tus VPS remotos.
                        </CardDescription>
                    </div>
                     <div className='flex gap-2'>
                        <Button variant="outline" onClick={() => checkAllServers(servers)} disabled={Object.values(serverStatuses).some(s => s === 'comprobando')}>
                            {Object.values(serverStatuses).some(s => s === 'comprobando') ? <Loader2 className='mr-2 h-4 w-4 animate-spin'/> : <RefreshCw className='mr-2 h-4 w-4'/>}
                             Verificar Todos
                        </Button>
                        <Button onClick={() => setEditingServer({})} disabled={isPending}>
                            <Plus className='mr-2 h-4 w-4'/> Añadir Servidor
                        </Button>
                     </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Estado</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Detalles de Conexión</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {servers && servers.length > 0 ? (
                        servers.map((server) => {
                            const status = serverStatuses[server.id];
                            const pending = isActionPending[server.id];
                            return (
                                <TableRow key={server.id}>
                                  <TableCell>
                                     {status === 'comprobando' && <Badge variant="secondary"><Loader2 className="mr-2 h-3 w-3 animate-spin" />Comprobando</Badge>}
                                     {status === 'online' && <Badge className='bg-green-500 hover:bg-green-600'>Online</Badge>}
                                     {status === 'offline' && <Badge variant="destructive">Offline</Badge>}
                                     {status === 'unknown' && <Badge variant="outline">Unknown</Badge>}
                                  </TableCell>
                                  <TableCell className="font-medium">{server.name}</TableCell>
                                  <TableCell className='font-mono text-muted-foreground'>{server.username}@{server.host}:{server.port}</TableCell>
                                  <TableCell className="text-right">
                                    <Button onClick={() => handleServerAction('restart', server)} variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-green-500/10 hover:text-green-500" disabled={isPending || status !== 'online'} title="Reiniciar Servicio">
                                        {pending ? <Loader2 className='h-4 w-4 animate-spin'/> : <Power className="h-4 w-4" />}
                                    </Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-yellow-500/10 hover:text-yellow-500" disabled={isPending || status !== 'online'} title="Resetear Configuración">
                                                <Settings2 className="h-4 w-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>¿Seguro que quieres resetear?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Esto ejecutará el script de reseteo en <strong className='font-mono'>{server.name}</strong>. Se intentará respaldar y restaurar tus usuarios, pero es una operación destructiva. Por favor, confirma.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleServerAction('reset', server)} className={buttonVariants({ variant: "destructive" })} disabled={pending}>
                                                    {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                                    Sí, Resetear Servidor
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-blue-500/10 hover:text-blue-500" disabled={isPending} onClick={() => setEditingServer(server)} title="Editar Servidor">
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                     <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" disabled={isPending} title="Eliminar Servidor">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>¿Estás absolutely seguro?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Esto eliminará permanentemente el servidor <strong className='font-mono'>{server.name}</strong> y todos sus usuarios VPN. Esta acción no se puede deshacer.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel disabled={isDeletingPending}>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteServer(server.id)} className={buttonVariants({ variant: "destructive" })} disabled={isDeletingPending}>
                                                    {isDeletingPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                                    Eliminar Servidor
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
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
                                <span>No hay servidores configurados. Añade uno para empezar.</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
            </CardContent>
        </Card>

        <Dialog open={!!editingServer} onOpenChange={(isOpen) => { if (!isOpen) { setEditingServer(null)} }}>
            <DialogContent className="sm:max-w-2xl">
                <form ref={formRef} onSubmit={handleSaveServer}>
                     <DialogHeader>
                        <DialogTitle>{editingServer?.id ? 'Editar Servidor' : 'Añadir Nuevo Servidor'}</DialogTitle>
                        <DialogDescription>
                            Introduce las credenciales SSH para el servidor. La conexión será probada antes de guardar.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <input type="hidden" name="serverId" value={editingServer?.id || ''} />

                    <div className="space-y-4 py-4">
                        <div className="grid gap-1.5">
                            <Label htmlFor="name">Nombre del Servidor</Label>
                            <Input name="name" id="name" placeholder="Ej: VPS-Miami" defaultValue={editingServer?.name} required disabled={isSavingPending} />
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="grid gap-1.5">
                                <Label htmlFor="host">IP / Hostname del Servidor</Label>
                                <Input name="host" id="host" placeholder="Ej: 123.45.67.89" defaultValue={editingServer?.host} required disabled={isSavingPending} />
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="port">Puerto SSH</Label>
                                <Input name="port" id="port" type="number" placeholder="22" defaultValue={editingServer?.port || 22} disabled={isSavingPending} />
                            </div>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="grid gap-1.5">
                                <Label htmlFor="ssh-username">Usuario SSH</Label>
                                <Input name="username" id="ssh-username" placeholder="Ej: root" defaultValue={editingServer?.username} required disabled={isSavingPending} />
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="ssh-password">Contraseña SSH</Label>
                                <Input name="password" id="ssh-password" type="password" placeholder={editingServer?.id ? 'Dejar en blanco para no cambiar' : 'Introduce la contraseña SSH'} required={!editingServer?.id} disabled={isSavingPending} />
                            </div>
                        </div>
                         <div className="grid gap-1.5">
                            <Label htmlFor="serviceCommand">Comando de Servicio</Label>
                            <Input name="serviceCommand" id="serviceCommand" placeholder="Ej: systemctl restart zivpn" defaultValue={editingServer?.serviceCommand || 'systemctl restart zivpn'} disabled={isSavingPending} />
                        </div>
                    </div>

                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="secondary" disabled={isSavingPending}>
                                Cancelar
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={isSavingPending} className="gap-2">
                            {isSavingPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Probar y Guardar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    </>
    )
}
