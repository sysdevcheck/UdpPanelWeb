
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useActionState } from 'react';
import { addUser, deleteUser, editUser, renewUser } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Plus, Loader2, User, Calendar, Pencil, RefreshCw } from 'lucide-react';
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

type UserWithStatus = User & {
    status: {
        label: 'Active' | 'Expiring' | 'Expired';
        daysLeft: number;
        variant: "default" | "destructive" | "secondary";
    }
}

type StatusFilter = 'all' | 'active' | 'expiring' | 'expired';

const getStatus = (expiresAt: string): { label: 'Active' | 'Expiring' | 'Expired', daysLeft: number, variant: "default" | "destructive" | "secondary" } => {
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

const initialActionState = { success: false, error: undefined, message: undefined, users: undefined };

export function UserManager({ initialUsers, managerUsername }: { initialUsers: User[], managerUsername: string }) {
  const [isClient, setIsClient] = useState(false);
  const [users, setUsers] = useState<UserWithStatus[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  
  const { toast } = useToast();
  const addUserFormRef = useRef<HTMLFormElement>(null);
  const editUserFormRef = useRef<HTMLFormElement>(null);
  
  const USERS_PER_PAGE = 10;
  
  const [addUserState, addUserAction, isAddingPending] = useActionState(addUser, initialActionState);
  const [editUserState, editUserAction, isEditingPending] = useActionState(editUser, initialActionState);
  const [deleteUserState, deleteUserAction, isDeletingPending] = useActionState(deleteUser, initialActionState);
  const [renewUserState, renewUserAction, isRenewingPending] = useActionState(renewUser, initialActionState);

  useEffect(() => {
    setIsClient(true);
    setUsers(initialUsers.map(u => ({ ...u, status: getStatus(u.expiresAt) })));
  }, [initialUsers]);

  useEffect(() => {
    const state = addUserState;
    if (state?.success) {
      if(state.users) setUsers(state.users.map(u => ({ ...u, status: getStatus(u.expiresAt) })));
      toast({ title: 'Success', description: state.message, className: 'bg-green-500 text-white' });
      addUserFormRef.current?.reset();
    } else if (state?.error) {
      toast({ variant: 'destructive', title: 'Error Adding User', description: state.error });
    }
  }, [addUserState, toast]);

  useEffect(() => {
    const state = editUserState;
    if (state?.success) {
      if(state.users) setUsers(state.users.map(u => ({ ...u, status: getStatus(u.expiresAt) })));
      toast({ title: 'Success', description: state.message });
      setEditingUser(null);
    } else if (state?.error) {
      toast({ variant: 'destructive', title: 'Error Editing User', description: state.error });
    }
  }, [editUserState, toast]);

  useEffect(() => {
    const state = deleteUserState;
    if (state?.success) {
      if(state.users) setUsers(state.users.map(u => ({ ...u, status: getStatus(u.expiresAt) })));
      toast({ title: 'Success', description: `User has been deleted.` });
    } else if (state?.error) {
      toast({ variant: 'destructive', title: 'Error Deleting User', description: state.error });
    }
  }, [deleteUserState, toast]);
  
  useEffect(() => {
    const state = renewUserState;
    if (state?.success) {
      if(state.users) setUsers(state.users.map(u => ({ ...u, status: getStatus(u.expiresAt) })));
      toast({ title: 'Success', description: `User has been renewed.` });
    } else if (state?.error) {
      toast({ variant: 'destructive', title: 'Error Renewing User', description: state.error });
    }
  }, [renewUserState, toast]);


  const isPending = isAddingPending || isEditingPending || isDeletingPending || isRenewingPending;

  const filteredUsers = useMemo(() => {
    if (filter === 'all') return users;
    return users.filter(user => {
        const status = user.status.label.toLowerCase();
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
    } else if (totalPages === 0) {
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
                <CardTitle className="text-xl">Your VPN Users</CardTitle>
                <CardDescription>
                Add, edit, renew, or remove users. Users will automatically expire and be removed after 30 days.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-24 text-center text-muted-foreground flex items-center justify-center">
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
        <CardTitle className="text-xl">Your VPN Users</CardTitle>
        <CardDescription>
          Add, edit, renew, or remove users. Users will automatically expire and be removed after 30 days.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={addUserFormRef} action={addUserAction} className="flex gap-2 mb-4">
          <input type="hidden" name="managerUsername" value={managerUsername} />
          <Input
            name="username"
            placeholder="New username"
            disabled={isPending}
            className="text-base"
            required
          />
          <Button type="submit" disabled={isPending}>
            {isAddingPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span>Add User</span>
          </Button>
        </form>
        
        <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-medium text-foreground/80">Current Users</h3>
            <div className="flex gap-1 ml-auto">
                <Button variant={filter === 'all' ? 'secondary' : 'ghost'} size="sm" onClick={() => handleFilterChange('all')}>All</Button>
                <Button variant={filter === 'active' ? 'secondary' : 'ghost'} size="sm" onClick={() => handleFilterChange('active')}>Active</Button>
                <Button variant={filter === 'expiring' ? 'secondary' : 'ghost'} size="sm" onClick={() => handleFilterChange('expiring')}>Expiring</Button>
                <Button variant={filter === 'expired' ? 'secondary' : 'ghost'} size="sm" onClick={() => handleFilterChange('expired')}>Expired</Button>
            </div>
        </div>

        <div className="space-y-3">
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.length > 0 ? (
                    paginatedUsers.map((user) => {
                      const { label, daysLeft, variant } = user.status;
                      return (
                        <TableRow key={user.username}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <User className="w-5 h-5 text-muted-foreground" />
                              <span className="font-mono text-base">{user.username}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="w-4 h-4" />
                              {format(new Date(user.createdAt), 'PPP')}
                            </div>
                          </TableCell>
                           <TableCell>
                             <div className="flex items-center gap-2 text-sm">
                               <div className="flex flex-col">
                                   <Badge variant={variant}>{label}</Badge>
                                   <span className="text-xs text-muted-foreground mt-1">
                                      {daysLeft > 0 ? `Expires in ${daysLeft} day(s)` : `Expired ${-daysLeft} day(s) ago`}
                                   </span>
                                </div>
                             </div>
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                             <form action={renewUserAction} className='inline-flex'>
                                <input type="hidden" name="username" value={user.username} />
                                <input type="hidden" name="managerUsername" value={managerUsername} />
                                <Button type="submit" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-green-500/10 hover:text-green-500" disabled={isPending}>
                                    {isRenewingPending && renewUserState?.users?.find(u=>u.username===user.username) ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                </Button>
                             </form>
                             <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-blue-500/10 hover:text-blue-500" disabled={isPending} onClick={() => setEditingUser(user)}>
                                <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" disabled={isPending}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <form action={deleteUserAction}>
                                        <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete the user <strong className="font-mono">{user.username}</strong>.
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <input type="hidden" name="username" value={user.username} />
                                            <input type="hidden" name="managerUsername" value={managerUsername} />
                                            <AlertDialogCancel disabled={isDeletingPending}>Cancel</AlertDialogCancel>
                                            <AlertDialogAction type="submit" className="bg-destructive hover:bg-destructive/90" disabled={isDeletingPending}>
                                                {isDeletingPending && deleteUserState?.users?.find(u=>u.username===user.username) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Delete'}
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
                        You have not created any users, or no users match the current filter.
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
                    Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                </span>
                <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages || isPending}
                >
                    Next
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
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
                Change the username for <strong className="font-mono">{editingUser?.username}</strong>.
            </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="newUsername" className="text-right">
                    Username
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
    </>
  );
}
