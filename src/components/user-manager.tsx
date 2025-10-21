
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useActionState } from 'react';
import { addUser, deleteUser, editUser, renewUser, readConfig, restartService, resetServerConfig } from '@/app/actions';
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
import { Label } from '@/components/ui/label';

type User = {
  username: string;
  createdAt: string;
  expiresAt: string;
  createdBy: string;
}

type Server = {
    id: string;
    name: string;
    host: string;
}

type UserWithStatus = User & {
    status: {
        label: 'Activo' | 'Por Vencer' | 'Vencido';
        daysLeft: number;
        variant: "default" | "destructive" | "secondary";
    }
}

type StatusFilter = 'all' | 'active' | 'expiring' | 'expired';

const getStatus = (expiresAt: string): { label: 'Activo' | 'Por Vencer' | 'Vencido', daysLeft: number, variant: "default" | "destructive" | "secondary" } => {
    const expirationDate = new Date(expiresAt);
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

const initialActionState = { success: false, error: undefined, message: undefined, users: [] };

export function UserManager({ initialUsers, managerUsername, isOwner, servers = [] }: { initialUsers: User[], managerUsername: string, isOwner: boolean, servers: Server[] }) {
  const [isClient, setIsClient] = useState(false);
  const [users, setUsers] = useState<UserWithStatus[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedServer, setSelectedServer] = useState<Server | null>(isOwner ? null : servers[0] || null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);


  const { toast } = useToast();
  const addUserFormRef = useRef<HTMLFormElement>(null);
  const editUserFormRef = useRef<HTMLFormElement>(null);
  
  const USERS_PER_PAGE = 10;
  
  const [addUserState, addUserAction, isAddingPending] = useActionState(addUser, initialActionState);
  const [editUserState, editUserAction, isEditingPending] = useActionState(editUser, initialActionState);
  const [deleteUserState, deleteUserAction, isDeletingPending] = useActionState(deleteUser, initialActionState);
  const [renewUserState, renewUserAction, isRenewingPending] = useActionState(renewUser, initialActionState);
  const [resetState, resetAction, isResettingPending] = useActionState(resetServerConfig, {success: false});
  const [restartState, restartAction, isRestartingPending] = useActionState(restartService, {success: false});

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isOwner) {
      setUsers(initialUsers.map(u => ({ ...u, status: getStatus(u.expiresAt) })));
    }
  }, [initialUsers, isOwner]);


  const handleStateUpdate = (state: typeof addUserState, actionType: string) => {
    if (!state) return false;
    if (state.success && state.users) {
        setUsers(state.users.map((u: User) => ({ ...u, status: getStatus(u.expiresAt) })));
        if (state.message) {
             toast({ title: 'Éxito', description: state.message, className: 'bg-green-500 text-white' });
        }
        return true;
    } else if (state.error) {
      toast({ variant: 'destructive', title: `Error en ${actionType}`, description: state.error });
    }
    return false;
  };
  
  const loadUsersForServer = async (server: Server) => {
    setIsLoadingUsers(true);
    setSelectedServer(server);
    const result = await readConfig(managerUsername, server.id);
    if (result.auth?.config) {
      setUsers(result.auth.config.map((u: User) => ({ ...u, status: getStatus(u.expiresAt) })));
    } else if (result.error) {
      toast({ variant: 'destructive', title: `Error al cargar usuarios`, description: result.error });
      setUsers([]);
    }
    setIsLoadingUsers(false);
  }

  useEffect(() => {
    if (!addUserState) return;
    if (addUserState.success || addUserState.error) {
      if(handleStateUpdate(addUserState, 'Añadir Usuario')) {
          addUserFormRef.current?.reset();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addUserState]);

  useEffect(() => {
    if (!editUserState) return;
    if (editUserState.success || editUserState.error) {
      if(handleStateUpdate(editUserState, 'Editar Usuario')) {
        setEditingUser(null);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editUserState]);

  useEffect(() => {
    if (!deleteUserState) return;
    if (deleteUserState.success || deleteUserState.error) {
      handleStateUpdate(deleteUserState, 'Eliminar Usuario');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteUserState]);
  
  useEffect(() => {
    if (!renewUserState) return;
    if (renewUserState.success || renewUserState.error) {
      handleStateUpdate(renewUserState, 'Renovar Usuario');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renewUserState]);

  useEffect(() => {
    if (!resetState) return;
    if(resetState.success && resetState.message) {
        toast({ title: 'Éxito', description: resetState.message, className: 'bg-green-500 text-white' });
    } else if (resetState.error) {
         toast({ variant: 'destructive', title: 'Reseteo Fallido', description: resetState.error });
    }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [resetState]);

useEffect(() => {
    if (!restartState) return;
    if (restartState.success && restartState.message) {
        toast({ title: 'Éxito', description: restartState.message });
    } else if (restartState.error) {
        toast({ variant: 'destructive', title: 'Reinicio Fallido', description: restartState.error });
    }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [restartState]);


  const isPending = isAddingPending || isEditingPending || isDeletingPending || isRenewingPending || isResettingPending || isRestartingPending;

  const filteredUsers = useMemo(() => {
    if (filter === 'all') return users;
    return users.filter(user => {
        const status = user.status.label.toLowerCase();
        if (filter === 'expiring') return status === 'por vencer';
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
  
  if (!isClient) {
    return (
        <Card className="w-full max-w-5xl mx-auto shadow-lg">
            <CardHeader>
                 <CardTitle className="text-xl">Usuarios VPN</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-40 text-center text-muted-foreground flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin" />
                </div>
            </CardContent>
        </Card>
    )
  }

  // Owner view when no server is selected
  if (isOwner && !selectedServer) {
    return (
        <Card className="w-full max-w-5xl mx-auto shadow-lg">
            <CardHeader>
                <CardTitle className="text-xl">Gestionar Usuarios VPN</CardTitle>
                <CardDescription>Selecciona un servidor para ver y gestionar sus usuarios.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                    {servers.map(server => (
                        <Button key={server.id} variant="outline" className='p-6 flex flex-col items-start h-auto gap-2 justify-start' onClick={() => loadUsersForServer(server)}>
                           <div className='flex items-center gap-2'>
                             <Server className='w-5 h-5 text-primary'/>
                             <span className='text-lg font-bold'>{server.name}</span>
                           </div>
                           <span className='font-mono text-sm text-muted-foreground'>{server.host}</span>
                        </Button>
                    ))}
                    {servers.length === 0 && (
                        <p className='text-muted-foreground col-span-full text-center py-10'>No hay servidores configurados. Por favor, añade un servidor en la pestaña 'Servidores'.</p>
                    )}
                </div>
            </CardContent>
        </Card>
    )
  }

  if (isLoadingUsers) {
      return (
        <Card className="w-full max-w-5xl mx-auto shadow-lg">
            <CardHeader>
                <CardTitle className="text-xl">Cargando usuarios para {selectedServer?.name}...</CardTitle>
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
                    {isOwner ? `Usuarios en: ${selectedServer?.name}` : 'Tus Usuarios VPN'}
                 </CardTitle>
                <CardDescription>
                Añade, edita, renueva o elimina usuarios. Los usuarios vencen a los 30 días.
                </CardDescription>
            </div>
            <div className='flex gap-2 flex-wrap'>
                {isOwner && (
                    <Button variant="outline" onClick={() => { setSelectedServer(null); setUsers([]); }}>
                        Cambiar Servidor
                    </Button>
                )}
                {!isOwner && (
                    <>
                        <form action={restartAction} className='inline-flex'>
                           <input type="hidden" name="serverId" value={selectedServer?.id || ''} />
                           <input type="hidden" name="ownerUsername" value={managerUsername} />
                           <Button type="submit" variant="outline" disabled={isPending} title="Reiniciar Servicio">
                               <Power className="h-4 w-4" /> <span className='ml-2'>Reiniciar Servicio</span>
                           </Button>
                        </form>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={isPending} title="Resetear Configuración">
                                    <Settings2 className="h-4 w-4" /> <span className='ml-2'>Resetear Config</span>
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <form action={resetAction}>
                                    <input type="hidden" name="serverId" value={selectedServer?.id || ''} />
                                    <input type="hidden" name="ownerUsername" value={managerUsername} />
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>¿Seguro que quieres resetear?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Esto ejecutará el script de reseteo en <strong className='font-mono'>{selectedServer?.name}</strong>. Se intentará respaldar y restaurar tus usuarios, pero es una operación delicada.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel disabled={isResettingPending}>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction type="submit" variant="destructive" disabled={isResettingPending}>
                                            {isResettingPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                            Sí, Resetear
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </form>
                            </AlertDialogContent>
                        </AlertDialog>
                    </>
                )}
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <form ref={addUserFormRef} action={addUserAction} className="flex flex-col sm:flex-row gap-2 mb-4">
          <input type="hidden" name="managerUsername" value={managerUsername} />
          {selectedServer && <input type="hidden" name="serverId" value={selectedServer.id} />}
          <Input
            name="username"
            placeholder="Nuevo usuario"
            disabled={isPending}
            className="text-base"
            required
          />
          <Button type="submit" disabled={isPending} className="mt-2 sm:mt-0 w-full sm:w-auto">
            {isAddingPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
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
                        <TableRow key={user.username}>
                          <TableCell className="min-w-[150px]">
                            <div className="flex items-center gap-3">
                              <User className="w-5 h-5 text-muted-foreground" />
                              <span className="font-mono text-base">{user.username}</span>
                            </div>
                          </TableCell>
                          <TableCell className="min-w-[150px]">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="w-4 h-4" />
                              {format(new Date(user.createdAt), 'PPP', { locale: (require('date-fns/locale/es')) })}
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
                                <form action={renewUserAction} className='inline-flex'>
                                    <input type="hidden" name="username" value={user.username} />
                                    <input type="hidden" name="managerUsername" value={managerUsername} />
                                    {selectedServer && <input type="hidden" name="serverId" value={selectedServer.id} />}
                                    <Button type="submit" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-green-500/10 hover:text-green-500" disabled={isPending} title="Renovar Usuario">
                                        <RefreshCw className="h-4 w-4" />
                                    </Button>
                                </form>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-blue-500/10 hover:text-blue-500" disabled={isPending} onClick={() => setEditingUser(user)} title="Editar Usuario">
                                    <Pencil className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" disabled={isPending} title="Eliminar Usuario">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <form action={deleteUserAction}>
                                            <AlertDialogHeader>
                                            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Esta acción no se puede deshacer. Esto eliminará permanentemente al usuario <strong className="font-mono">{user.username}</strong>.
                                            </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <input type="hidden" name="username" value={user.username} />
                                                <input type="hidden" name="managerUsername" value={managerUsername} />
                                                {selectedServer && <input type="hidden" name="serverId" value={selectedServer.id} />}
                                                <AlertDialogCancel disabled={isDeletingPending}>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction type="submit" className="bg-destructive hover:bg-destructive/90" disabled={isDeletingPending}>
                                                    {isDeletingPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Eliminar'}
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </form>
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
                    disabled={currentPage === 1 || isPending}
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
                    disabled={currentPage === totalPages || isPending}
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
          <form ref={editUserFormRef} action={editUserAction}>
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
                      disabled={isEditingPending}
                      required
                    />
                    <input type="hidden" name="oldUsername" value={editingUser?.username || ''} />
                    <input type="hidden" name="managerUsername" value={managerUsername} />
                    {selectedServer && <input type="hidden" name="serverId" value={selectedServer.id} />}
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="secondary" disabled={isEditingPending}>
                        Cancelar
                    </Button>
                </DialogClose>
                <Button type="submit" disabled={isEditingPending}>
                    {isEditingPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar Cambios"}
                </Button>
            </DialogFooter>
          </form>
        </DialogContent>
    </Dialog>
    </>
  );
}
