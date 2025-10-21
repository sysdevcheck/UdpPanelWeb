
'use client';

import { useState, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Download, Upload } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

export function BackupManager() {
    const { toast } = useToast();
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
        const file = fileInputRef.current?.files?.[0];
        if (!file) {
            toast({ variant: 'destructive', title: 'Error', description: 'Por favor, selecciona un archivo de backup.' });
            return;
        }

        setIsImporting(true);

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') {
                    throw new Error("No se pudo leer el archivo.");
                }
                const parsedJson = JSON.parse(text);

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
                let description = error.message;
                if (error instanceof SyntaxError) {
                    description = 'El archivo seleccionado no es un JSON válido.';
                }
                toast({ variant: 'destructive', title: 'Error de Importación', description });
            } finally {
                setIsImporting(false);
                // Reset file input
                if(fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
            }
        };

        reader.onerror = () => {
             toast({ variant: 'destructive', title: 'Error de Lectura', description: 'No se pudo leer el archivo seleccionado.' });
             setIsImporting(false);
        }
        
        reader.readAsText(file);
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
                        Selecciona un archivo de backup JSON para restaurar la configuración completa.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <Alert variant="destructive">
                        <AlertTitle>¡Atención!</AlertTitle>
                        <AlertDescription>
                            La importación es una operación destructiva. Se borrarán todos los datos actuales y se reemplazarán con los del backup.
                        </AlertDescription>
                    </Alert>
                    <Input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
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
