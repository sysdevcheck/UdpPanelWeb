
'use client';

import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Download, Upload } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

export function BackupManager() {
    const { toast } = useToast();
    const [backupJson, setBackupJson] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const response = await fetch('/api/backup');
            if (!response.ok) {
                throw new Error('No se pudo generar el backup desde el servidor.');
            }
            const data = await response.json();
            const jsonString = JSON.stringify(data, null, 2);
            
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `zivpn_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast({ title: 'Éxito', description: 'Backup exportado y descargado.' });

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error de Exportación', description: error.message });
        } finally {
            setIsExporting(false);
        }
    };

    const handleImport = async () => {
        if (!backupJson) {
            toast({ variant: 'destructive', title: 'Error', description: 'El campo de texto del backup no puede estar vacío.' });
            return;
        }
        let parsedJson;
        try {
            parsedJson = JSON.parse(backupJson);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error de Formato', description: 'El texto introducido no es un JSON válido.' });
            return;
        }
        
        setIsImporting(true);
        try {
            const response = await fetch('/api/backup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsedJson),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Ocurrió un error desconocido durante la importación.');
            }

            toast({ title: 'Éxito', description: 'El backup se ha importado correctamente. La página se recargará.' });
            
            // Recargar la página para reflejar los cambios
            setTimeout(() => {
                window.location.reload();
            }, 2000);

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error de Importación', description: error.message });
        } finally {
            setIsImporting(false);
        }
    };

    const isPending = isExporting || isImporting;

    return (
        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Download className="w-5 h-5" />
                        Exportar Backup
                    </CardTitle>
                    <CardDescription>
                        Descarga un archivo JSON con toda la configuración actual de la aplicación: servidores, managers y usuarios VPN.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleExport} disabled={isPending} className="w-full">
                        {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        Exportar y Descargar
                    </Button>
                </CardContent>
            </Card>

            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Upload className="w-5 h-5" />
                        Importar Backup
                    </CardTitle>
                    <CardDescription>
                        Pega el contenido de un archivo de backup JSON para restaurar la configuración.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <Alert variant="destructive">
                        <AlertTitle>¡Atención!</AlertTitle>
                        <AlertDescription>
                            La importación es una operación destructiva. Se borrarán todos los datos actuales (servidores, managers, usuarios) y se reemplazarán con los datos del backup.
                        </AlertDescription>
                    </Alert>
                    <Textarea
                        value={backupJson}
                        onChange={(e) => setBackupJson(e.target.value)}
                        placeholder="Pega aquí el contenido de tu archivo de backup JSON..."
                        className="min-h-[200px] font-mono text-xs"
                        disabled={isPending}
                    />
                    <Button onClick={handleImport} disabled={isPending} className="w-full">
                        {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        Importar y Restaurar
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
