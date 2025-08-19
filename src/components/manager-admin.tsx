
'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { useActionState } from 'react';
import { addManager, deleteManager, editManager } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Plus, Loader2, User, Crown, Shield, Pencil, Calendar } from 'lucide-react';
import { format } from 'date-fns';
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
import { Badge } from './ui/badge';
import { Label } from './ui/label';

type Manager = {
  username: string;
  createdAt?: string;
  expiresAt?: string;
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
    managers: undefined,
};

export function ManagerAdmin({ initialManagers, ownerUsername }: { initialManagers: Manager[], ownerUsername: string }) {
  const [managers, setManagers] = useState<ManagerWithStatus[]>([]);
  const [editingManager, setEditingManager] = useState<Manager | null>(null);
  const { toast } = useToast();
  const addFormRef = useRef<HTMLFormElement>(null);
  const editFormRef = useRef<HTMLFormElement>(null);

  const [addManagerState, addManagerAction, isAddingPending] = useActionState(addManager, initialActionState);
  const [editManagerState, editManagerAction, isEditingPending] = useActionState(editManager, initialActionState);
  const [deleteManagerState, deleteManagerAction, isDeletingPending] = useActionState(deleteManager, initialActionState);
  
  useEffect(() => {
    setManagers(initialManagers.map(m => ({...m, status: getStatus(m.expiresAt)})));
  }, [initialManagers]);
  
  useEffect(() => {
    if (addManagerState && addManagerState.success) {
        if(addManagerState.managers) setManagers(addManagerState.managers.map(m => ({...m, status: getStatus(m.expiresAt)})));
        toast({ title: 'Success', description: addManagerState.message, className: 'bg-green-500 text-white' });
        addFormRef.current?.reset();
    } else if (addManagerState && addManagerState.error) {
        toast({ variant: 'destructive', title: 'Error Adding Manager', description: addManagerState.error });
    }
  }, [addManagerState, toast]);
  
  useEffect(() => {
    if (editManagerState && editManagerState.success) {
        if (editManagerState.managers) setManagers(editManagerState.managers.map(m => ({...m, status: getStatus(m.expiresAt)})));
        toast({ title: 'Success', description: editManagerState.message });
        setEditingManager(null);
    } else if (editManagerState && editManagerState.error) {
        toast({ variant: 'destructive', title: 'Error Editing Manager', description: editManagerState.error });
    }
  }, [editManagerState, toast]);

  useEffect(() => {
    if (deleteManagerState && deleteManagerState.success) {
        if (deleteManagerState.managers) setManagers(deleteManagerState.managers.map(m => ({...m, status: getStatus(m.expiresAt)})));
        toast({ title: 'Success', description: `Manager has been deleted.` });
    } else if (deleteManagerState && deleteManagerState.error) {
        toast({ variant: 'destructive', title: 'Error Deleting Manager', description: deleteManagerState.error });
    }
  }, [deleteManagerState, toast]);

  const isPending = isAddingPending || isEditingPending || isDeletingPending;

  return (
    <div className="space-y-6">
      <Card className="w-full max-w-4xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle>Add New Manager</CardTitle>
          <CardDescription>
            Create new accounts that can log in and manage their own set of VPN users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={addFormRef} action={addManagerAction} className="flex flex-col sm:flex-row gap-2">
            <div className="grid w-full gap-1.5">
                <Label htmlFor="username">Username</Label>
                <Input name="username" id="username" placeholder="New manager username" required disabled={isPending} />
            </div>
             <div className="grid w-full gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input name="password" id="password" type="password" placeholder="Password" required disabled={isPending} />
            </div>
            <div className='self-end'>
                <Button type="submit" disabled={isPending} className='w-full sm:w-auto'>
                    {isAddingPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    <span>Add Manager</span>
                </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      
      <Card className="w-full max-w-4xl mx-auto shadow-lg">
        <CardHeader>
            <CardTitle>Current Managers</CardTitle>
            <CardDescription>List of all accounts with access to this panel.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Role & Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {managers.length > 0 ? (
                    managers.map((manager) => {
                       const { label, daysLeft, variant } = manager.status;
                       const isOwner = manager.username === ownerUsername;
                       return (
                        <TableRow key={manager.username}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <User className="w-5 h-5 text-muted-foreground" />
                              <span className="font-mono text-base">{manager.username}</span>
                            </div>
                          </TableCell>
                           <TableCell>
                             <div className="flex flex-col gap-1">
                                {isOwner ? (
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
                                {daysLeft !== null && !isOwner && (
                                   <span className="text-xs text-muted-foreground">
                                      {daysLeft > 0 ? `Expires in ${daysLeft} day(s)` : `Expired ${-daysLeft} day(s) ago`}
                                   </span>
                                )}
                             </div>
                          </TableCell>
                          <TableCell>
                             {manager.createdAt ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Calendar className="w-4 h-4" />
                                  {format(new Date(manager.createdAt), 'PPP')}
                                </div>
                             ) : 'N/A'}
                          </TableCell>
                          <TableCell className="text-right">
                            {!isOwner && (
                              <>
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
                                        <form action={deleteManagerAction}>
                                            <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will permanently delete the manager <strong className="font-mono">{manager.username}</strong> and revoke their access. This does not delete the VPN users they created.
                                            </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <input type="hidden" name="username" value={manager.username} />
                                                <AlertDialogCancel disabled={isDeletingPending}>Cancel</AlertDialogCancel>
                                                <AlertDialogAction type="submit" className="bg-destructive hover:bg-destructive/90" disabled={isDeletingPending}>
                                                    {isDeletingPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                                    Delete Manager
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </form>
                                    </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                       )
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        No managers found.
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
          <form ref={editFormRef} action={editManagerAction}>
            <DialogHeader>
              <DialogTitle>Edit Manager</DialogTitle>
              <DialogDescription>
                  Change the details for <strong className="font-mono">{editingManager?.username}</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <input type="hidden" name="oldUsername" value={editingManager?.username || ''} />
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
