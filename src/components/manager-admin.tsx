
'use client';

import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Plus, Loader2, User, Shield, Pencil, Server, AlertCircle } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from './ui/badge';
import { Label } from './ui/label';

type ServerInfo = {
    id: string;
    name: string;
}

type Manager = {
  id: string;
  username: string;
  assignedServerId?: string | null;
  createdAt?: string;
  expiresAt?: string;
}

type ManagerWithStatus = Omit<Manager, 'createdAt' | 'expiresAt'> & {
    createdAt?: Date;
    expiresAt?: Date;
    status: {
        label: 'Activo' | 'Por Vencer' | 'Vencido' | 'Permanente';
        daysLeft: number | null;
        variant: "default" | "destructive" | "secondary" | "outline";
    }
}

const getStatus = (expiresAt: Date | undefined | null): ManagerWithStatus['status'] => {
    if (!expiresAt) {
      return { label: 'Permanente', daysLeft: null, variant: 'outline' };
    }
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

export function ManagerAdmin() {
  const [managers, setManagers] = useState<ManagerWithStatus[]>([]);
  const [allServers, setAllServers] = useState<ServerInfo[]>([]);
  const [editingManager, setEditingManager] = useState<ManagerWithStatus | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const { toast } = useToast();
  
  const addFormRef = useRef<HTMLFormElement>(null);
  
  const fetchManagersAndServers = async () => {
      setIsLoading(true);
      try {
          const [managersRes, serversRes] = await Promise.all([
              fetch('/api/create-user'),
              fetch('/api/manage-server')
          ]);

          const managersData = await managersRes.json();
          if (!managersRes.ok) throw new Error(managersData.error || 'Failed to fetch managers');
          
          const serversData = await serversRes.json();
          if (!serversRes.ok) throw new Error(serversData.error || 'Failed to fetch servers');

          const processedManagers = (managersData || []).map((m: Manager) => {
              const expiresAtDate = m.expiresAt ? new Date(m.expiresAt) : undefined;
              return {
                  ...m,
                  createdAt: m.createdAt ? new Date(m.createdAt) : undefined,
                  expiresAt: expiresAtDate,
                  status: getStatus(expiresAtDate)
              };
          });
          
          setManagers(processedManagers);
          setAllServers(serversData);

      } catch (error: any) {
          toast({ variant: 'destructive', title: 'Error', description: `No se pudieron cargar los datos: ${error.message}` });
      } finally {
          setIsLoading(false);
      }
  };

  useEffect(() => {
      fetchManagersAndServers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const handleAddManager = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    const assignedServerId = formData.get('assignedServerId') as string;
    
    if (!username || !password || !assignedServerId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Todos los campos son requeridos.' });
      setIsPending(false);
      return;
    }

    try {
        const response = await fetch('/api/create-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role: 'manager', assignedServerId })
        });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Fallo al crear manager');
        }

        toast({ title: 'Éxito', description: `Manager "${username}" ha sido añadido.` });
        addFormRef.current?.reset();
        fetchManagersAndServers();
    } catch(e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
        setIsPending(false);
    }
  }

  const handleDeleteManager = async (manager: Manager) => {
    setIsPending(true);
     try {
        const response = await fetch('/api/delete-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: manager.id })
        });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Fallo al eliminar manager');
        }
        toast({ title: 'Éxito', description: 'Manager eliminado.' });
        fetchManagersAndServers();
    } catch(e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
        setIsPending(false);
    }
  }

  const handleEditManager = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const id = formData.get('id') as string;
    const username = formData.get('username') as string;
    const newPassword = formData.get('newPassword') as string;
    const assignedServerId = formData.get('assignedServerId') as string;

    try {
       const response = await fetch('/api/update-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, username, password: newPassword, assignedServerId })
        });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Fallo al actualizar manager');
        }
        toast({ title: 'Éxito', description: 'Manager actualizado.' });
        setEditingManager(null);
        fetchManagersAndServers();
    } catch (e: any) {
         toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
        setIsPending(false);
    }
  }

  if (isLoading) {
    return (
        <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="w-full max-w-5xl mx-auto shadow-lg">
        <CardHeader>
            <div className='flex justify-between items-start'>
                <div>
                    <CardTitle>Añadir Nuevo Manager</CardTitle>
                    <CardDescription>
                        Crea cuentas que puedan gestionar usuarios en un servidor específico.
                    </CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent>
          <form ref={addFormRef} onSubmit={handleAddManager} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
            <div className="grid w-full gap-1.5">
                <Label htmlFor="username-manager">Usuario</Label>
                <Input name="username" id="username-manager" type="text" placeholder="nombre.usuario" required disabled={isPending} />
            </div>
             <div className="grid w-full gap-1.5">
                <Label htmlFor="password-manager">Contraseña</Label>
                <Input name="password" id="password-manager" type="password" placeholder="Contraseña" required disabled={isPending} />
            </div>
             <div className="grid w-full gap-1.5">
                <Label htmlFor="server-select-add">Asignar a Servidor</Label>
                <Select name="assignedServerId" required disabled={isPending || !allServers || allServers.length === 0}>
                  <SelectTrigger id="server-select-add">
                    <SelectValue placeholder={!allServers || allServers.length === 0 ? "No hay servidores" : "Seleccionar servidor"} />
                  </SelectTrigger>
                  <SelectContent>
                    {allServers?.map((server) => (
                      <SelectItem key={server.id} value={server.id}>{server.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
            </div>
            <div className='flex justify-end'>
                <Button type="submit" disabled={isPending || !allServers || allServers.length === 0} className='w-full sm:w-auto'>
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    <span>Añadir</span>
                </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      
      <Card className="w-full max-w-5xl mx-auto shadow-lg">
        <CardHeader>
            <CardTitle>Cuentas de Manager</CardTitle>
            <CardDescription>Lista de todas las cuentas de manager con acceso a este panel.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Servidor Asignado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                 {managers.map((manager) => {
                       const { label, daysLeft, variant } = manager.status;
                       const assignedServer = allServers?.find(s => s.id === manager.assignedServerId);

                       return (
                        <TableRow key={manager.id}>
                          <TableCell className="min-w-[200px]">
                            <div className="flex items-center gap-3">
                              <div className='flex items-center gap-2'>
                                <User className="w-4 h-4 text-muted-foreground" />
                                <span className="font-mono text-base">{manager.username}</span>
                              </div>
                            </div>
                          </TableCell>
                           <TableCell className="min-w-[150px]">
                             <div className="flex flex-col gap-1">
                                <Badge variant="secondary" className="w-fit">
                                    <Shield className="mr-2 h-4 w-4" />
                                    Manager
                                </Badge>
                                {manager.expiresAt && (
                                    <>
                                        <Badge variant={variant} className="w-fit">{label}</Badge>
                                        {daysLeft !== null && (
                                        <span className="text-xs text-muted-foreground">
                                            {daysLeft > 0 ? `Vence en ${daysLeft} día(s)` : `Venció hace ${-daysLeft} día(s)`}
                                        </span>
                                        )}
                                    </>
                                )}
                                {!manager.expiresAt && <Badge variant="outline">Permanente</Badge>}
                             </div>
                          </TableCell>
                          <TableCell>
                             {assignedServer ? (
                                <div className='flex items-center gap-2'>
                                  <Server className='w-4 h-4 text-muted-foreground'/>
                                  <span className='font-medium'>{assignedServer.name}</span>
                                </div>
                             ) : (
                                <div className='flex items-center gap-2 text-destructive'>
                                  <AlertCircle className='w-4 h-4'/>
                                  <span className='font-medium'>Sin asignar</span>
                                </div>
                             )}
                          </TableCell>
                          <TableCell className="text-right">
                             <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-blue-500/10 hover:text-blue-500" disabled={isPending} onClick={() => setEditingManager(manager)}>
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
                                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Esto eliminará permanentemente al manager <strong className="font-mono">{manager.username}</strong> y revocará su acceso.
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteManager(manager)} className="bg-destructive hover:bg-destructive/90" disabled={isPending}>
                                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                            Eliminar Manager
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                       )
                    })}
                    {managers.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={4} className="text-center h-24">
                                No hay managers creados.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
              </Table>
            </div>
        </CardContent>
    </Card>

    <Dialog open={!!editingManager} onOpenChange={(isOpen) => !isOpen && setEditingManager(null)}>
        <DialogContent>
          <form onSubmit={handleEditManager}>
            <DialogHeader>
              <DialogTitle>Editar Cuenta: <span className='font-mono'>{editingManager?.username}</span></DialogTitle>
              <DialogDescription>
                  Cambia los detalles de esta cuenta de manager.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <input type="hidden" name="id" value={editingManager?.id || ''} />
                
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="username" className="text-right">Usuario</Label>
                    <Input
                    id="username"
                    name="username"
                    defaultValue={editingManager?.username}
                    className="col-span-3"
                    disabled={isPending}
                    required
                    />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="server-select-edit" className="text-right">Servidor</Label>
                    <Select name="assignedServerId" defaultValue={editingManager?.assignedServerId || ""} required disabled={isPending || !allServers || allServers.length === 0}>
                        <SelectTrigger id="server-select-edit" className="col-span-3">
                            <SelectValue placeholder={!allServers || allServers.length === 0 ? "No hay servidores" : "Seleccionar servidor"}/>
                        </SelectTrigger>
                        <SelectContent>
                            {allServers?.map((server) => (
                            <SelectItem key={server.id} value={server.id}>{server.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="newPassword" className="text-right">Nueva Contraseña</Label>
                    <Input
                      id="newPassword"
                      name="newPassword"
                      type="password"
                      placeholder="Dejar en blanco para no cambiar"
                      className="col-span-3"
                      disabled={isPending}
                    />
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="secondary" disabled={isPending}>
                        Cancelar
                    </Button>
                </DialogClose>
                <Button type="submit" disabled={isPending}>
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar Cambios"}
                </Button>
            </DialogFooter>
          </form>
        </DialogContent>
    </Dialog>

    </div>
  );
}
