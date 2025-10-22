
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Plus, Loader2, User, Calendar, Pencil, RefreshCw, AlertCircle, Server, Power, Settings2, GitCommitHorizontal } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Label } from '@/components/ui/label';
import { restartService, resetServerConfig } from '@/app/actions';

type VpnUser = {
  id: string;
  username: string;
  createdAt: string;
  expiresAt: string;
  createdBy: string;
  serverId: string;
}

type ServerData = {
    id: string;
    name: string;
    host: string;
    username: string;
    port: number;
    password?: string;
    serviceCommand?: string;
}

type UserWithStatus = Omit<VpnUser, 'createdAt' | 'expiresAt'> & {
    createdAt: Date;
    expiresAt: Date;
    status: {
        label: 'Activo' | 'Por Vencer' | 'Vencido';
        daysLeft: number;
        variant: "default" | "destructive" | "secondary";
    }
}

type StatusFilter = 'all' | 'active' | 'expiring' | 'expired';

const getStatus = (expiresAt: Date): UserWithStatus['status'] => {
    const now = new Date();
    const diffTime = expiresAt.getTime() - now.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysLeft <= 0) {
        return { label: 'Vencido', daysLeft, variant: 'destructive' };
    }
    if (daysLeft <= 7) {
        return { label: 'Por Vencer', daysLeft, variant: 'secondary' };
    }
    return { label: 'Activo', daysLeft, variant: 'default' };
};

export function UserManager({ user }: { user: { uid: string; username: string; role: string; assignedServerId?: string | null; }}) {
  const { role, assignedServerId, username: loggedInUsername } = user;
  const isOwner = role === 'owner';

  const [allServers, setAllServers] = useState<ServerData[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(isOwner ? null : assignedServerId || null);
  const [editingUser, setEditingUser] = useState<UserWithStatus | null>(null);
  const [isActionPending, setIsActionPending] = useState(false);
  const [vpnUsers, setVpnUsers] = useState<UserWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const { toast } = useToast();
  const addUserFormRef = useRef<HTMLFormElement>(null);
  
  const USERS_PER_PAGE = 10;
  
  const currentServer = allServers?.find(s => s.id === selectedServerId);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      if (isOwner) {
        const serversRes = await fetch('/api/manage-server');
        const serversData = await serversRes.json();
        if (!serversRes.ok) throw new Error(serversData.error || 'Failed to fetch servers');
        setAllServers(serversData);
      } else if (assignedServerId) {
        const serverRes = await fetch(`/api/manage-server?serverId=${assignedServerId}`);
        const serverData = await serverRes.json();
        if (!serverRes.ok) throw new Error(serverData.error || 'Failed to fetch assigned server');
        setAllServers(serverData.id ? [serverData] : []);
        fetchUsersForServer(assignedServerId);
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: `Failed to load initial data: ${error.message}` });
    } finally {
        setIsLoading(false);
    }
  };
  
  const fetchUsersForServer = async (serverId: string) => {
      setIsLoading(true);
      try {
          const response = await fetch(`/api/vpn-users?serverId=${serverId}${!isOwner ? `&createdBy=${loggedInUsername}` : ''}`);
          if (!response.ok) throw new Error("Failed to fetch users");
          const usersData: VpnUser[] = await response.json();
          const processedUsers = usersData.map(u => {
              const expiresAtDate = new Date(u.expiresAt);
              return {
                  ...u,
                  createdAt: new Date(u.createdAt),
                  expiresAt: expiresAtDate,
                  status: getStatus(expiresAtDate)
              };
          });
          setVpnUsers(processedUsers);
      } catch (error: any) {
          toast({ variant: 'destructive', title: 'Error', description: `Failed to load users: ${error.message}` });
          setVpnUsers([]);
      } finally {
          setIsLoading(false);
      }
  };

  useEffect(() => {
    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
      if (selectedServerId) {
          fetchUsersForServer(selectedServerId);
      } else {
        setVpnUsers([]);
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServerId]);

  const handleVpsSync = async () => {
    if (!currentServer) return;
    setIsActionPending(true);

    try {
        const response = await fetch(`/api/sync-users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serverId: currentServer.id, sshConfig: currentServer })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        toast({ title: 'Sincronización Completa', description: `Los usuarios del servidor ${currentServer.name} han sido sincronizados.` });
        return true;
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error de Sincronización', description: e.message });
        return false;
    } finally {
        setIsActionPending(false);
    }
  }

  const handleAddUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const username = new FormData(event.currentTarget).get('username') as string;
    if (!username || !selectedServerId) {
      toast({variant: 'destructive', title: 'Error', description: 'Falta el nombre de usuario o el servidor.'});
      return;
    }
    setIsActionPending(true);

    try {
        const response = await fetch('/api/vpn-users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, serverId: selectedServerId, createdBy: loggedInUsername })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to create user');

        toast({ title: 'Éxito', description: `Usuario "${username}" añadido. Sincronizando con VPS...` });
        addUserFormRef.current?.reset();
        
        // Fetch users before syncing to include the new user
        await fetchUsersForServer(selectedServerId);
        
        // Wait for sync to complete
        const syncSuccess = await handleVpsSync();
        if (syncSuccess) {
          fetchUsersForServer(selectedServerId);
        }

    } catch (e: any) {
        toast({variant: 'destructive', title: 'Error', description: e.message });
    } finally {
        setIsActionPending(false);
    }
  }

  const handleEditUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const userId = formData.get('userId') as string;
    const newUsername = formData.get('newUsername') as string;

    if (!userId || !newUsername || !selectedServerId) return;
    setIsActionPending(true);

    try {
        const response = await fetch('/api/vpn-users', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ docId: userId, username: newUsername })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to update user');

        toast({ title: 'Éxito', description: 'Usuario actualizado. Sincronizando con VPS...' });
        setEditingUser(null);
        await handleVpsSync();
        fetchUsersForServer(selectedServerId);
    } catch (e: any) {
         toast({variant: 'destructive', title: 'Error', description: e.message });
    } finally {
        setIsActionPending(false);
    }
  }
  
  const handleRenewUser = async (userId: string) => {
    if (!selectedServerId) return;
    setIsActionPending(true);

    try {
        const response = await fetch('/api/vpn-users', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ docId: userId, renew: true })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to renew user');

        toast({ title: 'Éxito', description: 'Usuario renovado.' });
        fetchUsersForServer(selectedServerId);
    } catch (e: any) {
         toast({variant: 'destructive', title: 'Error', description: e.message });
    } finally {
        setIsActionPending(false);
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!selectedServerId) return;
    setIsActionPending(true);
    try {
        const response = await fetch(`/api/vpn-users?docId=${userId}`, {
            method: 'DELETE',
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to delete user');

        toast({ title: 'Éxito', description: 'Usuario eliminado. Sincronizando con VPS...' });
        await handleVpsSync();
        fetchUsersForServer(selectedServerId);
    } catch (e: any) {
         toast({variant: 'destructive', title: 'Error', description: e.message });
    } finally {
        setIsActionPending(false);
    }
  }
  
  const handleServerAction = async (action: 'reset' | 'restart') => {
      if(!currentServer) return;
      setIsActionPending(true);

      const actionFn = action === 'reset' ? resetServerConfig : restartService;
      
      const formData = new FormData();
      formData.set('serverId', currentServer.id);
      formData.set('sshConfig', JSON.stringify(currentServer));

      const result = await actionFn({ success: false }, formData);

      if (result.success) {
          toast({ title: 'Éxito', description: result.message });
          if(action === 'reset') await handleVpsSync();
      } else if (result.error) {
          toast({ variant: 'destructive', title: 'Acción Fallida', description: result.error });
      }
      
      setIsActionPending(false);
  }

  const filteredUsers = useMemo(() => {
    if (filter === 'all') return vpnUsers;
    return vpnUsers.filter(user => {
        const statusLabel = user.status.label;
        if (filter === 'active' && statusLabel === 'Activo') return true;
        if (filter === 'expiring' && statusLabel === 'Por Vencer') return true;
        if (filter === 'expired' && statusLabel === 'Vencido') return true;
        return false;
    });
  }, [vpnUsers, filter]);

  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * USERS_PER_PAGE;
    return filteredUsers.slice(startIndex, startIndex + USERS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    } else if (totalPages === 0 && currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);
  
  const handleFilterChange = (newFilter: StatusFilter) => {
    setFilter(newFilter);
    setCurrentPage(1);
  };

  if (isOwner && !selectedServerId) {
    if (isLoading) {
        return <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
    }
    return (
        <Card className="w-full max-w-5xl mx-auto shadow-lg">
            <CardHeader>
                <CardTitle className="text-xl">Gestionar Usuarios VPN</CardTitle>
                <CardDescription>Selecciona un servidor para ver y gestionar sus usuarios.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                    {allServers?.map(server => (
                        <Button key={server.id} variant="outline" className='p-6 flex flex-col items-start h-auto gap-2 justify-start' onClick={() => setSelectedServerId(server.id)}>
                           <div className='flex items-center gap-2'>
                             <Server className='w-5 h-5 text-primary'/>
                             <span className='text-lg font-bold'>{server.name}</span>
                           </div>
                           <span className='font-mono text-sm text-muted-foreground'>{server.host}</span>
                        </Button>
                    ))}
                    {allServers?.length === 0 && (
                        <p className='text-muted-foreground col-span-full text-center py-10'>No hay servidores configurados. Por favor, añade un servidor en la pestaña 'Servidores'.</p>
                    )}
                </div>
            </CardContent>
        </Card>
    )
  }
  
  return (
    <>
    <Card className="w-full max-w-5xl mx-auto shadow-lg">
      <CardHeader>
        <div className='flex flex-wrap justify-between items-start gap-4'>
            <div>
                 <CardTitle className="text-xl">
                    {isOwner ? `Usuarios en: ${currentServer?.name}` : 'Tus Usuarios VPN'}
                 </CardTitle>
                <CardDescription>
                Añade, edita, renueva o elimina usuarios. Los usuarios vencen a los 30 días.
                </CardDescription>
            </div>
            <div className='flex gap-2 flex-wrap'>
                {isOwner && (
                    <Button variant="outline" onClick={() => { setSelectedServerId(null); }}>
                        Cambiar Servidor
                    </Button>
                )}
                 <Button variant="outline" onClick={handleVpsSync} disabled={isActionPending || isLoading} title="Forzar sincronización de usuarios con el VPS">
                     {isActionPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCommitHorizontal className="h-4 w-4" />} <span className='ml-2'>Sincronizar con VPS</span>
                 </Button>
                 <Button variant="outline" onClick={() => handleServerAction('restart')} disabled={isActionPending || isLoading} title="Reiniciar Servicio">
                     {isActionPending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Power className="h-4 w-4" />} <span className='ml-2'>Reiniciar Servicio</span>
                 </Button>
                  <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <Button variant="destructive" disabled={isActionPending || isLoading} title="Resetear Configuración">
                              <Settings2 className="h-4 w-4" /> <span className='ml-2'>Resetear Config</span>
                          </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                              <AlertDialogTitle>¿Seguro que quieres resetear?</AlertDialogTitle>
                              <AlertDialogDescription>
                                  Esto ejecutará el script de reseteo en <strong className='font-mono'>{currentServer?.name}</strong>. Se intentará restaurar tus usuarios después, pero es una operación delicada.
                              </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                              <AlertDialogCancel disabled={isActionPending}>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleServerAction('reset')} variant="destructive" disabled={isActionPending}>
                                  {isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                  Sí, Resetear
                              </AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <form ref={addUserFormRef} onSubmit={handleAddUser} className="flex flex-col sm:flex-row gap-2 mb-4">
          <Input
            name="username"
            placeholder="Nuevo usuario"
            disabled={isActionPending || isLoading}
            className="text-base"
            required
          />
          <Button type="submit" disabled={isActionPending || isLoading} className="mt-2 sm:mt-0 w-full sm:w-auto">
            {isActionPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span>Añadir Usuario</span>
          </Button>
        </form>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-4">
            <div className="flex gap-1 flex-wrap">
                <Button variant={filter === 'all' ? 'secondary' : 'ghost'} size="sm" onClick={() => handleFilterChange('all')}>Todos ({vpnUsers.length})</Button>
                <Button variant={filter === 'active' ? 'secondary' : 'ghost'} size="sm" onClick={() => handleFilterChange('active')}>Activos</Button>
                <Button variant={filter === 'expiring' ? 'secondary' : 'ghost'} size="sm" onClick={() => handleFilterChange('expiring')}>Por Vencer</Button>
                <Button variant={filter === 'expired' ? 'secondary' : 'ghost'} size="sm" onClick={() => handleFilterChange('expired')}>Vencidos</Button>
            </div>
        </div>

        <div className="space-y-3">
            <div className="border rounded-md overflow-x-auto">
              {isLoading ? (
                  <div className="h-40 text-center text-muted-foreground flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Creado</TableHead>
                      <TableHead>Estado</TableHead>
                      {isOwner && <TableHead>Creado Por</TableHead>}
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedUsers.length > 0 ? (
                      paginatedUsers.map((user) => {
                        const { label, daysLeft, variant } = user.status;
                        return (
                          <TableRow key={user.id}>
                            <TableCell className="min-w-[150px]">
                              <div className="flex items-center gap-3">
                                <User className="w-5 h-5 text-muted-foreground" />
                                <span className="font-mono text-base">{user.username}</span>
                              </div>
                            </TableCell>
                            <TableCell className="min-w-[150px]">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Calendar className="w-4 h-4" />
                                {format(user.createdAt, 'PPP', { locale: es })}
                              </div>
                            </TableCell>
                             <TableCell className="min-w-[150px]">
                               <div className="flex items-center gap-2 text-sm">
                                 <div className="flex flex-col">
                                     <Badge variant={variant}>{label}</Badge>
                                     <span className="text-xs text-muted-foreground mt-1">
                                        {daysLeft > 0 ? `Vence en ${daysLeft} día(s)` : `Venció hace ${-daysLeft} día(s)`}
                                     </span>
                                  </div>
                               </div>
                            </TableCell>
                            {isOwner && (
                              <TableCell className="min-w-[150px]">
                                   <span className="font-mono text-sm">{user.createdBy}</span>
                              </TableCell>
                            )}
                            <TableCell className="text-right space-x-0">
                               <div className="flex justify-end items-center">
                                  <Button onClick={() => handleRenewUser(user.id)} variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-green-500/10 hover:text-green-500" disabled={isActionPending} title="Renovar Usuario">
                                      <RefreshCw className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-blue-500/10 hover:text-blue-500" disabled={isActionPending} onClick={() => setEditingUser(user)} title="Editar Usuario">
                                      <Pencil className="h-4 w-4" />
                                  </Button>
                                  <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" disabled={isActionPending} title="Eliminar Usuario">
                                              <Trash2 className="h-4 w-4" />
                                          </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                          <AlertDialogHeader>
                                          <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                              Esta acción no se puede deshacer. Esto eliminará al usuario <strong className="font-mono">{user.username}</strong> de la base de datos y lo sincronizará con el VPS.
                                          </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                              <AlertDialogCancel disabled={isActionPending}>Cancelar</AlertDialogCancel>
                                              <AlertDialogAction onClick={() => handleDeleteUser(user.id)} className="bg-destructive hover:bg-destructive/90" disabled={isActionPending}>
                                                  {isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Eliminar'}
                                              </AlertDialogAction>
                                          </AlertDialogFooter>
                                      </AlertDialogContent>
                                  </AlertDialog>
                               </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={isOwner ? 5 : 4} className="h-24 text-center text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                              <AlertCircle className="w-8 h-8" />
                             <span>No hay usuarios para mostrar en este servidor o filtro.</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
             {totalPages > 1 && (
              <div className="flex items-center justify-end pt-4 gap-2">
                <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1 || isActionPending}
                >
                    Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                    Página {currentPage} de {totalPages}
                </span>
                <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages || isActionPending}
                >
                    Siguiente
                </Button>
              </div>
            )}
        </div>
      </CardContent>
    </Card>

    <Dialog open={!!editingUser} onOpenChange={(isOpen) => !isOpen && setEditingUser(null)}>
        <DialogContent>
          <form onSubmit={handleEditUser}>
            <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>
                Cambiar el nombre de usuario para <strong className="font-mono">{editingUser?.username}</strong>. El cambio se sincronizará con el VPS.
            </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="newUsername" className="text-right">
                    Usuario
                    </Label>
                    <Input
                      id="newUsername"
                      name="newUsername"
                      defaultValue={editingUser?.username}
                      className="col-span-3"
                      disabled={isActionPending}
                      required
                    />
                    <input type="hidden" name="userId" value={editingUser?.id || ''} />
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="secondary" disabled={isActionPending}>
                        Cancelar
                    </Button>
                </DialogClose>
                <Button type="submit" disabled={isActionPending}>
                    {isActionPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar y Sincronizar"}
                </Button>
            </DialogFooter>
          </form>
        </DialogContent>
    </Dialog>
    </>
  );
}
