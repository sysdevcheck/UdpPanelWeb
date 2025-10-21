'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Plus, Loader2, User, Calendar, Pencil, RefreshCw, AlertCircle, Server, Power, Settings2 } from 'lucide-react';
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
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, writeBatch, getDocs, Timestamp } from 'firebase/firestore';
import { syncVpnUsersWithVps, restartService, resetServerConfig } from '@/app/actions';

type User = {
  id: string;
  username: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  createdBy: string;
  serverId: string;
}

type Server = {
    id: string;
    name: string;
    host: string;
    username: string;
    port: number;
    password?: string;
}

type UserWithStatus = User & {
    status: {
        label: 'Activo' | 'Por Vencer' | 'Vencido';
        daysLeft: number;
        variant: "default" | "destructive" | "secondary";
    }
}

type StatusFilter = 'all' | 'active' | 'expiring' | 'expired';

const getStatus = (expiresAt: Timestamp): UserWithStatus['status'] => {
    const expirationDate = expiresAt.toDate();
    const now = new Date();
    const diffTime = expirationDate.getTime() - now.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysLeft <= 0) {
        return { label: 'Vencido', daysLeft, variant: 'destructive' };
    }
    if (daysLeft <= 7) {
        return { label: 'Por Vencer', daysLeft, variant: 'secondary' };
    }
    return { label: 'Activo', daysLeft, variant: 'default' };
};

export function UserManager({ user }: { user: { uid: string; username: string; role: string; assignedServerId?: string; }}) {
  const { role, assignedServerId, uid } = user;
  const isOwner = role === 'owner';

  const [filter, setFilter] = useState<StatusFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(isOwner ? null : assignedServerId || null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isActionPending, setIsActionPending] = useState(false);
  
  const { toast } = useToast();
  const firestore = useFirestore();
  const addUserFormRef = useRef<HTMLFormElement>(null);
  
  const USERS_PER_PAGE = 10;
  
  // Fetch servers for owner
  const serversQuery = useMemoFirebase(() => isOwner ? collection(firestore, 'servers') : null, [isOwner, firestore]);
  const { data: servers, isLoading: isLoadingServers } = useCollection<Server>(serversQuery);

  // Fetch single server for manager
  const serverDocRef = useMemoFirebase(() => !isOwner && selectedServerId ? doc(firestore, 'servers', selectedServerId) : null, [isOwner, selectedServerId, firestore]);
  const { data: assignedServer, isLoading: isLoadingServer } = useDoc<Server>(serverDocRef);

  const currentServer = isOwner ? servers?.find(s => s.id === selectedServerId) : assignedServer;
  
  // Fetch users for the selected server
  const usersQuery = useMemoFirebase(() => {
    if (!selectedServerId) return null;
    return query(collection(firestore, 'vpnUsers'), where('serverId', '==', selectedServerId));
  }, [selectedServerId, firestore]);
  const { data: vpnUsersData, isLoading: isLoadingUsers } = useCollection<User>(usersQuery);

  const users = useMemo(() => 
    (vpnUsersData || []).map(u => ({...u, status: getStatus(u.expiresAt)})), 
  [vpnUsersData]);

  const handleVpsSync = async () => {
    if (!currentServer || !vpnUsersData) return;
    setIsActionPending(true);

    const sshConfig = currentServer;

    await syncVpnUsersWithVps(currentServer.id, sshConfig, vpnUsersData);
    setIsActionPending(false);
  }

  const handleAddUser = async (formData: FormData) => {
    const username = formData.get('username') as string;
    if (!username || !selectedServerId) {
      toast({variant: 'destructive', title: 'Error', description: 'Falta el nombre de usuario o el servidor.'});
      return;
    }
    setIsActionPending(true);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    try {
        const docRef = await addDoc(collection(firestore, 'vpnUsers'), {
            username,
            serverId: selectedServerId,
            createdBy: uid,
            createdAt: serverTimestamp(),
            expiresAt: expiresAt,
        });
        toast({ title: 'Éxito', description: `Usuario "${username}" añadido.` });
        addUserFormRef.current?.reset();
        await handleVpsSync();
    } catch (e: any) {
        toast({variant: 'destructive', title: 'Error', description: e.message });
    }
    setIsActionPending(false);
  }

  const handleEditUser = async (formData: FormData) => {
    const userId = formData.get('userId') as string;
    const newUsername = formData.get('newUsername') as string;

    if (!userId || !newUsername) return;
    setIsActionPending(true);

    try {
        const docRef = doc(firestore, 'vpnUsers', userId);
        await updateDoc(docRef, { username: newUsername });
        toast({ title: 'Éxito', description: 'Usuario actualizado.' });
        setEditingUser(null);
        await handleVpsSync();
    } catch (e: any) {
         toast({variant: 'destructive', title: 'Error', description: e.message });
    }
    setIsActionPending(false);
  }
  
  const handleRenewUser = async (userId: string) => {
    setIsActionPending(true);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    try {
        const docRef = doc(firestore, 'vpnUsers', userId);
        await updateDoc(docRef, { expiresAt: expiresAt });
        toast({ title: 'Éxito', description: 'Usuario renovado.' });
    } catch (e: any) {
         toast({variant: 'destructive', title: 'Error', description: e.message });
    }
    setIsActionPending(false);
  }

  const handleDeleteUser = async (userId: string) => {
    setIsActionPending(true);
    try {
        await deleteDoc(doc(firestore, 'vpnUsers', userId));
        toast({ title: 'Éxito', description: 'Usuario eliminado.' });
        await handleVpsSync();
    } catch (e: any) {
         toast({variant: 'destructive', title: 'Error', description: e.message });
    }
    setIsActionPending(false);
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
          toast({ title: 'Éxito', description: result.message, className: action === 'reset' ? 'bg-green-500 text-white' : undefined });
          if(action === 'reset') await handleVpsSync();
      } else if (result.error) {
          toast({ variant: 'destructive', title: 'Acción Fallida', description: result.error });
      }
      
      setIsActionPending(false);
  }

  const filteredUsers = useMemo(() => {
    if (filter === 'all') return users;
    return users.filter(user => {
        const status = user.status.label.toLowerCase();
        if (filter === 'expiring') return status === 'por vencer';
        if (filter === 'expired') return status === 'vencido';
        return status === filter;
    });
  }, [users, filter]);

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
  
  const isLoading = isLoadingServers || isLoadingServer || (selectedServerId && isLoadingUsers);

  if (isOwner && !selectedServerId) {
    return (
        <Card className="w-full max-w-5xl mx-auto shadow-lg">
            <CardHeader>
                <CardTitle className="text-xl">Gestionar Usuarios VPN</CardTitle>
                <CardDescription>Selecciona un servidor para ver y gestionar sus usuarios.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoadingServers ? <div className="h-24 flex justify-center items-center"><Loader2 className="h-6 w-6 animate-spin" /></div> : 
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                    {servers?.map(server => (
                        <Button key={server.id} variant="outline" className='p-6 flex flex-col items-start h-auto gap-2 justify-start' onClick={() => setSelectedServerId(server.id)}>
                           <div className='flex items-center gap-2'>
                             <Server className='w-5 h-5 text-primary'/>
                             <span className='text-lg font-bold'>{server.name}</span>
                           </div>
                           <span className='font-mono text-sm text-muted-foreground'>{server.host}</span>
                        </Button>
                    ))}
                    {servers?.length === 0 && (
                        <p className='text-muted-foreground col-span-full text-center py-10'>No hay servidores configurados. Por favor, añade un servidor en la pestaña 'Servidores'.</p>
                    )}
                </div>
                }
            </CardContent>
        </Card>
    )
  }

  if (isLoading) {
      return (
        <Card className="w-full max-w-5xl mx-auto shadow-lg">
            <CardHeader>
                <CardTitle className="text-xl">Cargando usuarios...</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-40 text-center text-muted-foreground flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin" />
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
                 <Button variant="outline" onClick={() => handleServerAction('restart')} disabled={isActionPending} title="Reiniciar Servicio">
                     <Power className="h-4 w-4" /> <span className='ml-2'>Reiniciar Servicio</span>
                 </Button>
                  <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <Button variant="destructive" disabled={isActionPending} title="Resetear Configuración">
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
        <form ref={addUserFormRef} action={handleAddUser} className="flex flex-col sm:flex-row gap-2 mb-4">
          <Input
            name="username"
            placeholder="Nuevo usuario"
            disabled={isActionPending}
            className="text-base"
            required
          />
          <Button type="submit" disabled={isActionPending} className="mt-2 sm:mt-0 w-full sm:w-auto">
            {isActionPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span>Añadir Usuario</span>
          </Button>
        </form>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-4">
            <div className="flex gap-1 flex-wrap">
                <Button variant={filter === 'all' ? 'secondary' : 'ghost'} size="sm" onClick={() => handleFilterChange('all')}>Todos</Button>
                <Button variant={filter === 'active' ? 'secondary' : 'ghost'} size="sm" onClick={() => handleFilterChange('active')}>Activos</Button>
                <Button variant={filter === 'expiring' ? 'secondary' : 'ghost'} size="sm" onClick={() => handleFilterChange('expiring')}>Por Vencer</Button>
                <Button variant={filter === 'expired' ? 'secondary' : 'ghost'} size="sm" onClick={() => handleFilterChange('expired')}>Vencidos</Button>
            </div>
        </div>

        <div className="space-y-3">
            <div className="border rounded-md overflow-x-auto">
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
                              {format(user.createdAt.toDate(), 'PPP', { locale: es })}
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
                                    {isActionPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
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
                                            Esta acción no se puede deshacer. Esto eliminará permanentemente al usuario <strong className="font-mono">{user.username}</strong>.
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
          <form action={handleEditUser}>
            <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>
                Cambiar el nombre de usuario para <strong className="font-mono">{editingUser?.username}</strong>.
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
                    {isActionPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar Cambios"}
                </Button>
            </DialogFooter>
          </form>
        </DialogContent>
    </Dialog>
    </>
  );
}
