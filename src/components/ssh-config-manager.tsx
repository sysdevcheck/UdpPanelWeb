
'use client';

import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Plus, Loader2, Server, KeyRound, User, CircleDot, Pencil, TestTube2, AlertTriangle, Terminal } from 'lucide-react';
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
import { Label } from '@/components/ui/label';

type Server = {
    id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    password?: string;
    serviceCommand: string;
}

type TestLog = {
    level: 'INFO' | 'SUCCESS' | 'ERROR';
    message: string;
}

export function SshConfigManager() {
    const [servers, setServers] = useState<Server[]>([]);
    const [editingServer, setEditingServer] = useState<Server | null>(null);
    const [isPending, setIsPending] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [testingServerId, setTestingServerId] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<{ success: boolean; log: TestLog[] } | null>(null);

    const { toast } = useToast();
    const addFormRef = useRef<HTMLFormElement>(null);

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

    const handleAddServer = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsPending(true);

        const formData = new FormData(event.currentTarget);
        const serverData = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/api/manage-server', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(serverData),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            toast({ title: 'Éxito', description: 'Servidor añadido correctamente.' });
            addFormRef.current?.reset();
            fetchServers();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsPending(false);
        }
    };

    const handleDeleteServer = async (serverId: string) => {
        setIsPending(true);
        try {
            const response = await fetch('/api/manage-server', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: serverId }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            toast({ title: 'Éxito', description: 'Servidor eliminado.' });
            fetchServers();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsPending(false);
        }
    };

    const handleEditServer = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsPending(true);

        const formData = new FormData(event.currentTarget);
        const serverData = Object.fromEntries(formData.entries());
        
        // Don't send empty password
        if (!serverData.password) {
            delete serverData.password;
        }

        try {
            const response = await fetch('/api/manage-server', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(serverData),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            toast({ title: 'Éxito', description: 'Servidor actualizado.' });
            setEditingServer(null);
            fetchServers();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsPending(false);
        }
    };

    const handleTestConnection = async (server: Server) => {
        setTestingServerId(server.id);
        setTestResult(null);
        try {
             const response = await fetch('/api/ssh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'testConnection',
                    payload: { sshConfig: server },
                }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Test failed');
            setTestResult({ success: result.success, log: result.log });
            
        } catch (e: any) {
            setTestResult({ success: false, log: [{ level: 'ERROR', message: e.message }] });
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card className="w-full max-w-5xl mx-auto shadow-lg">
                <CardHeader>
                    <CardTitle>Añadir Nuevo Servidor VPS</CardTitle>
                    <CardDescription>
                        Configura los detalles de conexión SSH para un servidor ZiVPN.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form ref={addFormRef} onSubmit={handleAddServer} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="grid w-full gap-1.5">
                                <Label htmlFor="name">Nombre del Servidor</Label>
                                <Input name="name" id="name" type="text" placeholder="Ej: VPS Principal" required disabled={isPending} />
                            </div>
                            <div className="grid w-full gap-1.5">
                                <Label htmlFor="host">Host / IP</Label>
                                <Input name="host" id="host" type="text" placeholder="Ej: 123.45.67.89" required disabled={isPending} />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                             <div className="grid w-full gap-1.5">
                                <Label htmlFor="port">Puerto SSH</Label>
                                <Input name="port" id="port" type="number" placeholder="22" defaultValue="22" required disabled={isPending} />
                            </div>
                             <div className="grid w-full gap-1.5">
                                <Label htmlFor="username">Usuario SSH</Label>
                                <Input name="username" id="username" type="text" placeholder="root" defaultValue="root" required disabled={isPending} />
                            </div>
                             <div className="grid w-full gap-1.5">
                                <Label htmlFor="password">Contraseña SSH</Label>
                                <Input name="password" id="password" type="password" required disabled={isPending} />
                            </div>
                        </div>
                         <div className="grid w-full gap-1.5">
                            <Label htmlFor="serviceCommand">Comando de Reinicio (Opcional)</Label>
                            <Input name="serviceCommand" id="serviceCommand" type="text" placeholder="systemctl restart zivpn" disabled={isPending} />
                        </div>
                        <div className='flex justify-end'>
                            <Button type="submit" disabled={isPending}>
                                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                Añadir Servidor
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card className="w-full max-w-5xl mx-auto shadow-lg">
                <CardHeader>
                    <CardTitle>Servidores Configurados</CardTitle>
                    <CardDescription>Lista de todos los servidores que puedes gestionar.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Host/IP</TableHead>
                                    <TableHead>Usuario</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {servers.map((server) => (
                                    <TableRow key={server.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <Server className="w-4 h-4 text-muted-foreground" />
                                                {server.name}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                             <div className="flex items-center gap-2">
                                                <CircleDot className="w-4 h-4 text-muted-foreground" />
                                                {server.host}:{server.port}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                             <div className="flex items-center gap-2">
                                                <User className="w-4 h-4 text-muted-foreground" />
                                                {server.username}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-green-500/10 hover:text-green-500" disabled={isPending} onClick={() => handleTestConnection(server)}>
                                                <TestTube2 className="h-4 w-4" />
                                            </Button>
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
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Esta acción no se puede deshacer. Esto eliminará permanentemente la configuración del servidor <strong className="font-medium">{server.name}</strong>.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteServer(server.id)} className={buttonVariants({ variant: "destructive" })} disabled={isPending}>
                                                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                                            Eliminar Servidor
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                 {servers.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center h-24">
                                            No hay servidores configurados.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

             <Dialog open={!!editingServer} onOpenChange={(isOpen) => !isOpen && setEditingServer(null)}>
                <DialogContent>
                    <form onSubmit={handleEditServer}>
                        <DialogHeader>
                            <DialogTitle>Editar Servidor: <span className="font-medium">{editingServer?.name}</span></DialogTitle>
                            <DialogDescription>
                                Actualiza los detalles de conexión de este servidor.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <input type="hidden" name="id" value={editingServer?.id || ''} />
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-name" className="text-right">Nombre</Label>
                                <Input id="edit-name" name="name" defaultValue={editingServer?.name} className="col-span-3" disabled={isPending} required />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-host" className="text-right">Host / IP</Label>
                                <Input id="edit-host" name="host" defaultValue={editingServer?.host} className="col-span-3" disabled={isPending} required />
                            </div>
                             <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-port" className="text-right">Puerto</Label>
                                <Input id="edit-port" name="port" defaultValue={editingServer?.port} className="col-span-3" disabled={isPending} required type="number"/>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-username" className="text-right">Usuario</Label>
                                <Input id="edit-username" name="username" defaultValue={editingServer?.username} className="col-span-3" disabled={isPending} required />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-password" className="text-right">Nueva Pass</Label>
                                <Input id="edit-password" name="password" placeholder="Dejar en blanco para no cambiar" className="col-span-3" disabled={isPending} type="password"/>
                            </div>
                             <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-serviceCommand" className="text-right">Comando</Label>
                                <Input id="edit-serviceCommand" name="serviceCommand" defaultValue={editingServer?.serviceCommand} placeholder="systemctl restart zivpn" className="col-span-3" disabled={isPending} />
                            </div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="secondary" disabled={isPending}>Cancelar</Button>
                            </DialogClose>
                            <Button type="submit" disabled={isPending}>
                                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar Cambios"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={!!testingServerId} onOpenChange={(isOpen) => !isOpen && setTestingServerId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                             <TestTube2 className="w-5 h-5"/>
                             Test de Conexión: <span className="font-medium">{servers.find(s => s.id === testingServerId)?.name}</span>
                        </DialogTitle>
                         <DialogDescription>
                            Resultado de la prueba de conexión SSH al servidor.
                        </DialogDescription>
                    </DialogHeader>
                    {!testResult ? (
                        <div className="flex items-center justify-center h-24 gap-3">
                             <Loader2 className="h-6 w-6 animate-spin text-primary" />
                             <span className="text-muted-foreground">Conectando...</span>
                        </div>
                    ) : (
                        <div className="space-y-4 py-4">
                            {testResult.success ? (
                                <div className="p-4 bg-green-500/10 text-green-700 rounded-md">
                                    <h3 className="font-bold text-lg">✅ Conexión Exitosa</h3>
                                    <p>Se ha establecido la conexión con el servidor correctamente.</p>
                                </div>
                            ) : (
                                <div className="p-4 bg-destructive/10 text-destructive rounded-md">
                                    <h3 className="font-bold text-lg">❌ Fallo en la Conexión</h3>
                                     <p>No se pudo conectar. Revisa los detalles abajo.</p>
                                </div>
                            )}
                            <div className="p-3 bg-slate-900 text-slate-200 font-mono text-sm rounded-md max-h-60 overflow-y-auto">
                                <div className="flex items-center gap-2 border-b border-slate-700 pb-2 mb-2">
                                    <Terminal className="w-4 h-4"/>
                                    <span>Log de Conexión</span>
                                </div>
                                {testResult.log.map((line, index) => (
                                    <p key={index} className={`flex items-start gap-2 ${line.level === 'ERROR' ? 'text-red-400' : line.level === 'SUCCESS' ? 'text-green-400' : 'text-slate-400'}`}>
                                        <span className='flex-shrink-0'>{line.level === 'ERROR' ? '❌' : line.level === 'SUCCESS' ? '✅' : 'ℹ️'}</span>
                                        <span className='flex-grow'>{line.message}</span>
                                    </p>
                                ))}
                            </div>
                        </div>
                    )}
                     <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">Cerrar</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
