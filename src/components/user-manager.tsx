'use client';

import { useState, useTransition } from 'react';
import { addUser, deleteUser, editUser } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Plus, Loader2, User, Calendar, ShieldAlert, Pencil } from 'lucide-react';
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
import { format, formatDistanceToNow } from 'date-fns';
import { Label } from '@/components/ui/label';

type User = {
  username: string;
  createdAt: string;
  expiresAt: string;
}

export function UserManager({ initialUsers }: { initialUsers: User[] }) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [newUser, setNewUser] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleAddUser = () => {
    if (!newUser.trim()) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Username cannot be empty.',
      });
      return;
    }
    startTransition(async () => {
      const result = await addUser(newUser.trim());
      if (result.success && result.users) {
        setUsers(result.users);
        setNewUser('');
        toast({
          title: 'Success',
          description: `User "${newUser.trim()}" has been added.`,
          className: 'bg-green-500 text-white',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error Adding User',
          description: result.error,
        });
      }
    });
  };

  const handleDeleteUser = (username: string) => {
    startTransition(async () => {
      const result = await deleteUser(username);
      if (result.success && result.users) {
        setUsers(result.users);
        toast({
          title: 'Success',
          description: `User "${username}" has been deleted.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error Deleting User',
          description: result.error,
        });
      }
    });
  };

  const handleEditUser = () => {
    if (!editingUser || !newUsername.trim()) {
       toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'New username cannot be empty.',
      });
      return;
    }
    startTransition(async () => {
      const result = await editUser(editingUser.username, newUsername.trim());
      if (result.success && result.users) {
        setUsers(result.users);
        setEditingUser(null);
        setNewUsername('');
        toast({
          title: 'Success',
          description: `User "${editingUser.username}" has been updated to "${newUsername.trim()}".`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error Editing User',
          description: result.error,
        });
      }
    });
  }

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setNewUsername(user.username);
  }

  const getDaysUntilExpiration = (expiresAt: string) => {
    const expirationDate = new Date(expiresAt);
    const now = new Date();
    const diffTime = expirationDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  return (
    <>
    <Card className="w-full max-w-4xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">User Passwords</CardTitle>
        <CardDescription>
          Add, edit, or remove users. Users will automatically expire and be removed after 30 days.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-6">
          <Input
            placeholder="New username"
            value={newUser}
            onChange={(e) => setNewUser(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddUser()}
            disabled={isPending}
            className="text-base"
          />
          <Button onClick={handleAddUser} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span>Add User</span>
          </Button>
        </div>

        <div className="space-y-3">
            <h3 className="text-lg font-medium text-foreground/80 mb-2">Current Users</h3>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length > 0 ? (
                    users.map((user) => {
                      const daysLeft = getDaysUntilExpiration(user.expiresAt);
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
                             <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <ShieldAlert className="w-4 h-4" />
                                <div className="flex flex-col">
                                   <span>{format(new Date(user.expiresAt), 'PPP')}</span>
                                   <span className={`text-xs ${daysLeft <= 7 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                      {daysLeft > 0 ? `in ${daysLeft} day(s)` : 'Expired'}
                                   </span>
                                </div>
                             </div>
                          </TableCell>
                          <TableCell className="text-right">
                             <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-blue-500/10 hover:text-blue-500" disabled={isPending} onClick={() => openEditDialog(user)}>
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
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete the user <strong className="font-mono">{user.username}</strong>.
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteUser(user.username)} className="bg-destructive hover:bg-destructive/90">
                                        Delete
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
                        No users configured.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
        </div>
      </CardContent>
    </Card>

    <Dialog open={!!editingUser} onOpenChange={(isOpen) => !isOpen && setEditingUser(null)}>
        <DialogContent>
            <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
                Change the username for <strong className="font-mono">{editingUser?.username}</strong>.
            </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="new-username" className="text-right">
                    Username
                    </Label>
                    <Input
                    id="new-username"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="col-span-3"
                    disabled={isPending}
                    />
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="secondary" disabled={isPending}>
                        Cancel
                    </Button>
                </DialogClose>
                <Button onClick={handleEditUser} disabled={isPending}>
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}
