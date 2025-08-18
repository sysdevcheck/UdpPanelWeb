# Panel de Gestión de Usuarios para ZiVPN

Esta es una aplicación web Next.js que proporciona una interfaz amigable para gestionar usuarios de un servicio ZiVPN. En lugar de editar manualmente el archivo de configuración en tu servidor, puedes usar este panel para agregar, editar, eliminar y renovar usuarios.

## Características

- **Gestión de Usuarios**: Agrega, edita y elimina usuarios de la configuración fácilmente.
- **Expiración Automática**: Los usuarios se crean con una vida útil de 30 días. Los usuarios vencidos se eliminan automáticamente del archivo de configuración.
- **Renovación de Usuarios**: Renueva el acceso de un usuario por otros 30 días con un solo clic.
- **Indicadores de Estado**: Los usuarios se etiquetan visualmente como "Activo", "Por Vencer" (dentro de 7 días) o "Vencido".
- **Filtrado**: Filtra la lista de usuarios por su estado para encontrar rápidamente a quien buscas.
- **Paginación**: La lista de usuarios está paginada para garantizar que la interfaz siga siendo rápida y fácil de navegar, incluso con muchos usuarios.

## Cómo Funciona

La aplicación lee y escribe en un archivo de configuración JSON local ubicado en `/etc/zivpn/config.json` en el servidor donde se está ejecutando. **No** utiliza SSH. El panel debe ser desplegado en el mismo VPS que tu servicio de VPN.

Los objetos de usuario en el archivo de configuración tienen la siguiente estructura:

```json
{
  "username": "testuser",
  "createdAt": "2023-10-27T10:00:00.000Z",
  "expiresAt": "2023-11-26T10:00:00.000Z"
}
```

## Instalación y Despliegue en tu VPS

Sigue estos pasos para poner en funcionamiento el panel de gestión de usuarios en tu servidor.

### 1. Prerrequisitos

Asegúrate de tener Node.js y npm instalados en tu VPS.

```bash
# Ejemplo para Debian/Ubuntu
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Clona el Proyecto

Clona este repositorio en una ubicación en tu VPS.

```bash
git clone [URL_DE_TU_REPOSITORIO_GIT]
cd [DIRECTORIO_DEL_PROYECTO]
```

### 3. Instala las Dependencias

Instala los paquetes de Node.js necesarios.

```bash
npm install
```

### 4. Configura los Permisos de Archivo

La aplicación necesita permisos para escribir en el directorio `/etc/zivpn/`.

Primero, crea el directorio si no existe. Luego, asigna la propiedad al usuario que usarás para ejecutar la aplicación (reemplaza `tu_usuario` con tu nombre de usuario real).

```bash
sudo mkdir -p /etc/zivpn
sudo chown -R tu_usuario:tu_usuario /etc/zivpn
```

### 5. Construye la Aplicación

Crea una compilación de producción optimizada de la aplicación Next.js.

```bash
npm run build
```

### 6. Ejecuta la Aplicación

Inicia el servidor de la aplicación.

```bash
npm start
```

Por defecto, la aplicación se ejecutará en el puerto 9002. Puedes acceder a ella en tu navegador en `http://<IP_DE_TU_VPS>:9002`.

### 7. (Recomendado) Mantenla en Funcionamiento con PM2

Para asegurar que el panel permanezca en línea incluso después de cerrar tu terminal, usa un gestor de procesos como `pm2`.

```bash
# Instala pm2 globalmente
sudo npm install -g pm2

# Inicia la aplicación con pm2
pm2 start npm --name "zivpn-panel" -- start

# (Opcional) Verifica el estado de tu aplicación
pm2 list

# (Opcional) Visualiza los registros
pm2 logs zivpn-panel
```
