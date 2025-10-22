
'use client';

import { useState, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Download, Upload, List, AlertTriangle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export function BackupManager() {
    const { toast } = useToast();
    const [isCreating, setIsCreating] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [backupFiles, setBackupFiles] = useState<string[]>([]);
    const [selectedBackup, setSelectedBackup] = useState<string>('');

    const fetchBackups = async () => {
        try {
            const response = await fetch('/api/backup');
            if (!response.ok) {
                throw new Error('No se pudieron listar los backups.');
            }
            const files = await response.json();
            setBackupFiles(files);
            if (files.length > 0) {
                setSelectedBackup(files[0]);
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        }
    };

    useEffect(() => {
        fetchBackups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCreateBackup = async () => {
        setIsCreating(true);
        try {
            const response = await fetch('/api/create-backup', { method: 'POST' });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'No se pudo crear el backup.');
            }
            
            toast({ title: 'Éxito', description: `Backup "${result.filename}" creado en el servidor.` });
            fetchBackups(); // Refresh the list

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error de Creación', description: error.message });
        } finally {
            setIsCreating(false);
        }
    };

    const handleRestore = async () => {
        if (!selectedBackup) {
            toast({ variant: 'destructive', title: 'Error', description: 'Por favor, selecciona un archivo de backup.' });
            return;
        }

        setIsRestoring(true);

        try {
            const response = await fetch('/api/backup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: selectedBackup }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Ocurrió un error desconocido durante la restauración.');
            }

            toast({ title: 'Éxito', description: 'El backup se ha restaurado correctamente. La página se recargará.' });
            
            setTimeout(() => {
                window.location.reload();
            }, 2000);

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error de Restauración', description: error.message });
        } finally {
            setIsRestoring(false);
        }
    };

    const isPending = isCreating || isRestoring;

    return (
        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Download className="w-5 h-5" />
                        Crear Backup en Servidor
                    </CardTitle>
                    <CardDescription>
                        Crea un archivo de backup con toda la configuración actual y lo guarda en el directorio `data/backups` del servidor.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleCreateBackup} disabled={isPending} className="w-full">
                        {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        Crear Nuevo Backup
                    </Button>
                </CardContent>
            </Card>

            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Upload className="w-5 h-5" />
                        Restaurar desde Backup
                    </CardTitle>
                    <CardDescription>
                        Selecciona un backup existente en el servidor para restaurar la configuración.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <Alert variant="destructive">
                        <AlertTriangle className='h-4 w-4' />
                        <AlertTitle>¡Atención!</AlertTitle>
                        <AlertDescription>
                            La restauración es una operación destructiva. Se borrarán todos los datos actuales y se reemplazarán con los del backup.
                        </AlertDescription>
                    </Alert>
                    
                    <div className="flex gap-2 items-center">
                        <div className="flex-grow">
                             <Select onValueChange={setSelectedBackup} value={selectedBackup} disabled={isPending || backupFiles.length === 0}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona un backup..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {backupFiles.length > 0 ? backupFiles.map(file => (
                                        <SelectItem key={file} value={file}>{file}</SelectItem>
                                    )) : (
                                        <div className='p-4 text-sm text-muted-foreground text-center'>No hay backups.</div>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button disabled={isPending || backupFiles.length === 0} className="w-auto">
                                    {isRestoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                    Restaurar
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>¿Confirmas la restauración?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Estás a punto de sobreescribir todos los datos actuales con el contenido del backup <strong className='font-mono'>{selectedBackup}</strong>. Esta acción no se puede deshacer.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleRestore}>Confirmar y Restaurar</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>

                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
