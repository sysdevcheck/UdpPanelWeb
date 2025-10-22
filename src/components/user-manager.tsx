
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Trash2, Plus, Loader2, User, Server, Clock, Calendar, AlertCircle, RefreshCw, X, Check, Copy
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type UserProps = {
    user: {
        username: string;
        role: 'owner' | 'manager';
        assignedServerId: string | null;
    }
}

type Server = {
    id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    password?: string;
}

type VpnUser = {
    id: string;
    username: string;
    serverId: string;
    createdBy: string;
    createdAt: string;
    expiresAt: string;
}

type VpnUserWithStatus = VpnUser & {
    status: {
        label: 'Activo' | 'Por Vencer' | 'Vencido';
        daysLeft: number;
        variant: "default" | "destructive" | "secondary";
    }
}

const getStatus = (expiresAt: string): VpnUserWithStatus['status'] => {
    const now = new Date();
    const expiryDate = new Date(expiresAt);
    const diffTime = expiryDate.getTime() - now.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysLeft <= 0) {
        return { label: 'Vencido', daysLeft, variant: 'destructive' };
    }
    if (daysLeft <= 7) {
        return { label: 'Por Vencer', daysLeft, variant: 'secondary' };
    }
    return { label: 'Activo', daysLeft, variant: 'default' };
};


export function UserManager({ user }: UserProps) {
    const [allServers, setAllServers] = useState<Server[]>([]);
    const [allVpnUsers, setAllVpnUsers] = useState<VpnUser[]>([]);
    const [selectedServerId, setSelectedServerId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    
    const [newUsernames, setNewUsernames] = useState('');
    const [days, setDays] = useState('30');
    const [renewDays, setRenewDays] = useState('30');

    const { toast } = useToast();
    const isOwner = user.role === 'owner';

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [serversRes, vpnUsersRes] = await Promise.all([
                    fetch('/api/manage-server'),
                    fetch('/api/manage-vpn-users')
                ]);

                if (!serversRes.ok) throw new Error('Failed to fetch servers');
                if (!vpnUsersRes.ok) throw new Error('Failed to fetch VPN users');

                const serversData = await serversRes.json();
                const vpnUsersData = await vpnUsersRes.json();
                
                setAllServers(serversData);
                setAllVpnUsers(vpnUsersData);

                if (isOwner) {
                    if (serversData.length > 0) {
                        setSelectedServerId(serversData[0].id);
                    }
                } else if (user.assignedServerId) {
                    setSelectedServerId(user.assignedServerId);
                }

            } catch (error: any) {
                 toast({ variant: 'destructive', title: 'Error de Carga', description: error.message });
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user.role, user.assignedServerId]);
    
    const selectedServer = useMemo(() => allServers.find(s => s.id === selectedServerId), [allServers, selectedServerId]);
    
    const filteredVpnUsers = useMemo(() => {
        return allVpnUsers
            .filter(u => u.serverId === selectedServerId)
            .map(u => ({ ...u, status: getStatus(u.expiresAt) }))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [allVpnUsers, selectedServerId]);


    const syncWithServer = async (server: Server, usersOnServer: VpnUser[]) => {
        setIsSyncing(true);
        toast({ title: 'Sincronizando...', description: `Aplicando cambios en el servidor ${server.name}.` });
        try {
            const usernames = usersOnServer.map(u => u.username);
            const sshPayload = {
                action: 'updateVpnConfig',
                payload: {
                    sshConfig: server,
                    usernames,
                },
            };
            let response = await fetch('/api/ssh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sshPayload),
            });
            let result = await response.json();
            if (!response.ok) throw new Error(`Error actualizando config: ${result.error}`);

            const restartPayload = {
                 action: 'restartService',
                 payload: { sshConfig: server },
            };
            response = await fetch('/api/ssh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(restartPayload),
            });
            result = await response.json();
             if (!response.ok) throw new Error(`Error reiniciando servicio: ${result.error}`);
            
            toast({ variant: 'default', title: 'Sincronización Completa', description: `Servidor ${server.name} actualizado y reiniciado.` });

        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error de Sincronización', description: e.message });
        } finally {
            setIsSyncing(false);
        }
    };


    const handleAddUsers = async () => {
        if (!selectedServer) {
            toast({ variant: 'destructive', title: 'Error', description: 'Por favor, selecciona un servidor.' });
            return;
        }
        const usernames = newUsernames.split('\n').map(u => u.trim()).filter(Boolean);
        if (usernames.length === 0) {
            toast({ variant: 'destructive', title: 'Error', description: 'Por favor, introduce al menos un nombre de usuario.' });
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await fetch('/api/manage-vpn-users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serverId: selectedServerId, usernames, createdBy: user.username, days }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            
            const newUsers = result.users;
            const updatedUsersList = [...allVpnUsers, ...newUsers];
            setAllVpnUsers(updatedUsersList);
            setNewUsernames('');
            toast({ title: 'Éxito', description: `${newUsers.length} usuario(s) añadido(s) localmente. Sincroniza para aplicar.` });
            
            // Sync automatically after adding
            await syncWithServer(selectedServer, updatedUsersList.filter(u => u.serverId === selectedServerId));

        } catch (e: any) {
             toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleRenewUser = async (userId: string) => {
        if (!selectedServer) return;
        setIsSubmitting(true);
         try {
            const response = await fetch('/api/manage-vpn-users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, days: renewDays }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            
            const updatedUsersList = allVpnUsers.map(u => u.id === userId ? result.user : u);
            setAllVpnUsers(updatedUsersList);
            toast({ title: 'Éxito', description: `Usuario renovado. Sincroniza para aplicar.` });
            
             // Sync automatically after renewing
            await syncWithServer(selectedServer, updatedUsersList.filter(u => u.serverId === selectedServerId));

        } catch (e: any) {
             toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDeleteUser = async (userId: string) => {
        if (!selectedServer) return;
        setIsSubmitting(true);
        try {
            const response = await fetch('/api/manage-vpn-users', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            
            const updatedUsersList = allVpnUsers.filter(u => u.id !== userId);
            setAllVpnUsers(updatedUsersList);
            toast({ title: 'Éxito', description: `Usuario eliminado localmente. Sincroniza para aplicar.` });
            
            // Sync automatically after deleting
            await syncWithServer(selectedServer, updatedUsersList.filter(u => u.serverId === selectedServerId));

        } catch (e: any) {
             toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: 'Copiado', description: 'El nombre de usuario ha sido copiado.' });
    };

    const isPending = isSubmitting || isSyncing;

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    if (allServers.length === 0 && isOwner) {
         return (
            <Alert variant="default" className="max-w-xl mx-auto">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No hay Servidores</AlertTitle>
              <AlertDescription>
                Aún no has configurado ningún servidor. Por favor, ve a la pestaña <strong>Servidores</strong> para añadir uno.
              </AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="space-y-6">
            <Card className="w-full max-w-5xl mx-auto shadow-lg">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex-grow">
                            <CardTitle>Añadir Usuarios VPN</CardTitle>
                            <CardDescription>
                                Añade nuevos usuarios al servidor seleccionado.
                            </CardDescription>
                        </div>
                        {isOwner && (
                            <Select onValueChange={setSelectedServerId} value={selectedServerId} disabled={isPending}>
                                <SelectTrigger className="w-full sm:w-[250px]">
                                    <SelectValue placeholder="Seleccionar servidor..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {allServers.map((s) => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                        <div className="md:col-span-2 space-y-4">
                            <Label htmlFor="usernames">Nombres de Usuario (uno por línea)</Label>
                            <Textarea
                                id="usernames"
                                placeholder="usuario1&#10;usuario2&#10;usuario3"
                                className="min-h-[120px] font-mono"
                                value={newUsernames}
                                onChange={(e) => setNewUsernames(e.target.value)}
                                disabled={isPending || !selectedServer}
                            />
                        </div>
                        <div className="space-y-4">
                            <Label htmlFor="days">Duración (días)</Label>
                            <Input
                                id="days"
                                type="number"
                                value={days}
                                onChange={(e) => setDays(e.target.value)}
                                disabled={isPending || !selectedServer}
                            />
                             <Button onClick={handleAddUsers} disabled={isPending || !selectedServer || newUsernames.trim() === ''} className="w-full">
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                Añadir Usuarios
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="w-full max-w-5xl mx-auto shadow-lg">
                <CardHeader>
                     <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div>
                             <CardTitle>Usuarios en {selectedServer?.name || 'Servidor'}</CardTitle>
                             <CardDescription>
                                Lista de usuarios VPN en el servidor seleccionado. Total: {filteredVpnUsers.length}
                            </CardDescription>
                        </div>
                         <Button onClick={() => syncWithServer(selectedServer!, filteredVpnUsers)} disabled={isPending || !selectedServer}>
                            {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Forzar Sincronización
                        </Button>
                     </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Usuario</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Vencimiento</TableHead>
                                    <TableHead>Creado Por</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredVpnUsers.map((vpnUser) => (
                                    <TableRow key={vpnUser.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <User className="w-4 h-4 text-muted-foreground" />
                                                <span className="font-mono">{vpnUser.username}</span>
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(vpnUser.username)}>
                                                    <Copy className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={vpnUser.status.variant}>{vpnUser.status.label}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Calendar className="w-4 h-4" />
                                                {format(new Date(vpnUser.expiresAt), 'dd MMM yyyy', { locale: es })}
                                                ({vpnUser.status.daysLeft > 0 ? `en ${vpnUser.status.daysLeft} días` : `hace ${-vpnUser.status.daysLeft} días`})
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm">{vpnUser.createdBy}</TableCell>
                                        <TableCell className="text-right">
                                           <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="outline" size="sm" className="mr-2" disabled={isPending}>
                                                        <RefreshCw className="h-4 w-4 mr-2" />
                                                        Renovar
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Renovar Usuario</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            ¿Por cuántos días quieres extender la suscripción de <strong className="font-mono">{vpnUser.username}</strong>?
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <div className="py-4">
                                                        <Label htmlFor="renew-days">Días a añadir</Label>
                                                        <Input id="renew-days" type="number" value={renewDays} onChange={(e) => setRenewDays(e.target.value)} />
                                                    </div>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleRenewUser(vpnUser.id)}>Renovar</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                            
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                     <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" disabled={isPending}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>¿Seguro que quieres eliminar?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Esto eliminará al usuario <strong className="font-mono">{vpnUser.username}</strong>. La acción se aplicará en el servidor en la próxima sincronización.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteUser(vpnUser.id)} className={buttonVariants({variant: 'destructive'})}>Eliminar</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filteredVpnUsers.length === 0 && !isLoading && (
                                     <TableRow>
                                        <TableCell colSpan={5} className="text-center h-24">
                                            No hay usuarios VPN en este servidor.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
