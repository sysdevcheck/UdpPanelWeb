
'use client';

import { useState, useEffect, useRef } from 'react';
import { useActionState } from 'react';
import { addManager, deleteManager, editManager, exportBackup } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Plus, Loader2, User, Crown, Shield, Pencil, Calendar, Server, AlertCircle, Upload, Download } from 'lucide-react';
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

type Server = {
    id: string;
    name: string;
}

type Manager = {
  username: string;
  createdAt?: string;
  expiresAt?: string;
  assignedServerId?: string | null;
}

type ManagerWithStatus = Manager & {
    status: {
        label: 'Active' | 'Expiring' | 'Expired' | 'Permanent';
        daysLeft: number | null;
        variant: "default" | "destructive" | "secondary" | "outline";
    }
}

const getStatus = (expiresAt: string | undefined): { label: 'Active' | 'Expiring' | 'Expired' | 'Permanent', daysLeft: number | null, variant: "default" | "destructive" | "secondary" | "outline" } => {
    if (!expiresAt) {
      return { label: 'Permanent', daysLeft: null, variant: 'outline' };
    }
    const expirationDate = new Date(expiresAt);
    const now = new Date();
    const diffTime = expirationDate.getTime() - now.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysLeft <= 0) {
        return { label: 'Expired', daysLeft, variant: 'destructive' };
    }
    if (daysLeft <= 7) {
        return { label: 'Expiring', daysLeft, variant: 'secondary' };
    }
    return { label: 'Active', daysLeft, variant: 'default' };
};

const initialActionState = {
    success: false,
    error: undefined,
    message: undefined,
    managersData: { managers: [], owner: {}, servers: [] },
};

export function ManagerAdmin({ initialManagers, ownerUsername, allServers }: { initialManagers: Manager[], ownerUsername: string, allServers: Server[] }) {
  const [isClient, setIsClient] = useState(false);
  const [managers, setManagers] = useState<ManagerWithStatus[]>([]);
  const [editingManager, setEditingManager] = useState<Manager | null>(null);
  const { toast } = useToast();
  const addFormRef = useRef<HTMLFormElement>(null);
  const editFormRef = useRef<HTMLFormElement>(null);

  const [addManagerState, addManagerAction, isAddingPending] = useActionState(addManager, initialActionState);
  const [editManagerState, editManagerAction, isEditingPending] = useActionState(editManager, initialActionState);
  const [deleteManagerState, deleteManagerAction, isDeletingPending] = useActionState(deleteManager, initialActionState);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      setManagers(initialManagers.map(m => ({...m, status: getStatus(m.expiresAt)})));
    }
  }, [initialManagers, isClient]);

  const handleStateUpdate = (state: typeof addManagerState, actionType: string) => {
    if (!state) return false;
    if (state.success) {
        if(state.managersData?.managers) {
             setManagers(state.managersData.managers.map((m: any) => ({...m, status: getStatus(m.expiresAt)})));
        }
        if (state.message) {
             toast({ title: 'Success', description: state.message, className: 'bg-green-500 text-white' });
        }
        return true;
    } else if (state.error) {
        toast({ variant: 'destructive', title: `Error ${actionType}`, description: state.error });
    }
    return false;
  }
  
  useEffect(() => {
    if (!addManagerState) return;
    if (addManagerState.success || addManagerState.error) {
      if(handleStateUpdate(addManagerState, 'Adding Manager')) {
          addFormRef.current?.reset();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addManagerState]);
  
  useEffect(() => {
    if (!editManagerState) return;
    if (editManagerState.success || editManagerState.error) {
      if(handleStateUpdate(editManagerState, 'Editing Manager')) {
          setEditingManager(null);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editManagerState]);

  useEffect(() => {
    if (!deleteManagerState) return;
    if (deleteManagerState.success || deleteManagerState.error) {
      handleStateUpdate(deleteManagerState, 'Deleting Manager');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteManagerState]);

  const handleExport = async () => {
    const result = await exportBackup();
    if (result.success && result.data) {
        const blob = new Blob([result.data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'zivpn-panel-backup.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({ title: 'Success', description: 'Backup has been downloaded.' });
    } else {
        toast({ variant: 'destructive', title: 'Export Failed', description: result.error });
    }
  }

  const isPending = isAddingPending || isEditingPending || isDeletingPending;
  const ownerData = { username: ownerUsername, createdAt: undefined, expiresAt: undefined };

  if (!isClient) {
    return (
        <div className="space-y-6">
             <Card className="w-full max-w-5xl mx-auto shadow-lg">
                <CardHeader><div className="h-24 flex items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></CardHeader>
             </Card>
        </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="w-full max-w-5xl mx-auto shadow-lg">
        <CardHeader>
            <div className='flex justify-between items-start'>
                <div>
                    <CardTitle>Add New Manager</CardTitle>
                    <CardDescription>
                        Create accounts that can manage users on a specific server.
                    </CardDescription>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleExport}>
                        <Download className="mr-2 h-4 w-4" />
                        Export Backup
                    </Button>
                </div>
            </div>
        </CardHeader>
        <CardContent>
          <form ref={addFormRef} action={addManagerAction} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <input type="hidden" name="ownerUsername" value={ownerUsername} />
            <div className="grid w-full gap-1.5">
                <Label htmlFor="username-manager">Username</Label>
                <Input name="username" id="username-manager" placeholder="New manager username" required disabled={isPending} />
            </div>
             <div className="grid w-full gap-1.5">
                <Label htmlFor="password-manager">Password</Label>
                <Input name="password" id="password-manager" type="password" placeholder="Password" required disabled={isPending} />
            </div>
             <div className="grid w-full gap-1.5">
                <Label htmlFor="server-select-add">Assign to Server</Label>
                <Select name="assignedServerId" required disabled={isPending || allServers.length === 0}>
                  <SelectTrigger id="server-select-add">
                    <SelectValue placeholder={allServers.length === 0 ? "No servers available" : "Select a server"} />
                  </SelectTrigger>
                  <SelectContent>
                    {allServers.map((server) => (
                      <SelectItem key={server.id} value={server.id}>{server.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
            </div>
            <div className='sm:col-span-3 flex justify-end'>
                <Button type="submit" disabled={isPending || allServers.length === 0} className='w-full sm:w-auto'>
                    {isAddingPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    <span>Add Manager</span>
                </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      
      <Card className="w-full max-w-5xl mx-auto shadow-lg">
        <CardHeader>
            <CardTitle>Current Accounts</CardTitle>
            <CardDescription>List of all owner and manager accounts with access to this panel.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Role & Status</TableHead>
                    <TableHead>Assigned Server</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                 {[ownerData, ...managers].map((manager) => {
                       const { label, daysLeft, variant } = getStatus(manager.expiresAt);
                       const isOwnerRow = manager.username === ownerUsername;
                       const assignedServer = isOwnerRow ? null : allServers.find(s => s.id === manager.assignedServerId);

                       return (
                        <TableRow key={manager.username}>
                          <TableCell className="min-w-[150px]">
                            <div className="flex items-center gap-3">
                              <User className="w-5 h-5 text-muted-foreground" />
                              <span className="font-mono text-base">{manager.username}</span>
                            </div>
                          </TableCell>
                           <TableCell className="min-w-[150px]">
                             <div className="flex flex-col gap-1">
                                {isOwnerRow ? (
                                    <Badge variant="default" className="bg-amber-500 hover:bg-amber-500/90 w-fit">
                                        <Crown className="mr-2 h-4 w-4" />
                                        Owner
                                    </Badge>
                                 ) : (
                                    <Badge variant="secondary" className="w-fit">
                                        <Shield className="mr-2 h-4 w-4" />
                                        Manager
                                    </Badge>
                                 )}
                                <Badge variant={variant} className="w-fit">{label}</Badge>
                                {daysLeft !== null && !isOwnerRow && (
                                   <span className="text-xs text-muted-foreground">
                                      {daysLeft > 0 ? `Expires in ${daysLeft} day(s)` : `Expired ${-daysLeft} day(s) ago`}
                                   </span>
                                )}
                             </div>
                          </TableCell>
                          <TableCell>
                             {isOwnerRow ? (
                                <span className="text-sm text-muted-foreground italic">All Servers</span>
                             ) : assignedServer ? (
                                <div className='flex items-center gap-2'>
                                  <Server className='w-4 h-4 text-muted-foreground'/>
                                  <span className='font-medium'>{assignedServer.name}</span>
                                </div>
                             ) : (
                                <div className='flex items-center gap-2 text-destructive'>
                                  <AlertCircle className='w-4 h-4'/>
                                  <span className='font-medium'>Unassigned</span>
                                </div>
                             )}
                          </TableCell>
                          <TableCell className="text-right">
                             <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-blue-500/10 hover:text-blue-500" disabled={isPending} onClick={() => setEditingManager(manager)}>
                                <Pencil className="h-4 w-4" />
                            </Button>
                            {!isOwnerRow && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" disabled={isPending}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <form action={deleteManagerAction}>
                                            <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will permanently delete the manager <strong className="font-mono">{manager.username}</strong> and revoke their access. This does not delete the VPN users they created.
                                            </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <input type="hidden" name="username" value={manager.username} />
                                                <input type="hidden" name="ownerUsername" value={ownerUsername} />
                                                <AlertDialogCancel disabled={isDeletingPending}>Cancel</AlertDialogCancel>
                                                <AlertDialogAction type="submit" className="bg-destructive hover:bg-destructive/90" disabled={isDeletingPending}>
                                                    {isDeletingPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                                    Delete Manager
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </form>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                          </TableCell>
                        </TableRow>
                       )
                    })}
                </TableBody>
              </Table>
            </div>
        </CardContent>
    </Card>

    <Dialog open={!!editingManager} onOpenChange={(isOpen) => !isOpen && setEditingManager(null)}>
        <DialogContent>
          <form ref={editFormRef} action={editManagerAction}>
            <DialogHeader>
              <DialogTitle>Edit Account: <span className='font-mono'>{editingManager?.username}</span></DialogTitle>
              <DialogDescription>
                  Change the details for this account.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <input type="hidden" name="oldUsername" value={editingManager?.username || ''} />
                <input type="hidden" name="ownerUsername" value={ownerUsername} />
                
                {editingManager?.username !== ownerUsername && (
                    <>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="newUsername" className="text-right">Username</Label>
                            <Input
                            id="newUsername"
                            name="newUsername"
                            defaultValue={editingManager?.username}
                            className="col-span-3"
                            disabled={isEditingPending}
                            required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="server-select-edit" className="text-right">Server</Label>
                            <Select name="assignedServerId" defaultValue={editingManager?.assignedServerId || ""} required disabled={isPending || allServers.length === 0}>
                                <SelectTrigger id="server-select-edit" className="col-span-3">
                                    <SelectValue placeholder={allServers.length === 0 ? "No servers available" : "Select a server"}/>
                                </SelectTrigger>
                                <SelectContent>
                                    {allServers.map((server) => (
                                    <SelectItem key={server.id} value={server.id}>{server.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </>
                )}
                
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="newPassword" className="text-right">New Password</Label>
                    <Input
                      id="newPassword"
                      name="newPassword"
                      type="password"
                      placeholder="Leave blank to keep current"
                      className="col-span-3"
                      disabled={isEditingPending}
                    />
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="secondary" disabled={isEditingPending}>
                        Cancel
                    </Button>
                </DialogClose>
                <Button type="submit" disabled={isEditingPending}>
                    {isEditingPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
                </Button>
            </DialogFooter>
          </form>
        </DialogContent>
    </Dialog>

    </div>
  );
}

    