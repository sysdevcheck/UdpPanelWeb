# Panel de Gestión de Usuarios para ZiVPN - Multi-Manager

Esta es una aplicación web Next.js que proporciona una interfaz amigable y multi-usuario para gestionar usuarios de un servicio ZiVPN. En lugar de editar manualmente el archivo de configuración en tu servidor, puedes usar este panel para que diferentes "managers" o "revendedores" gestionen sus propios usuarios.

## Características

- **Sistema de Login**: Los administradores (managers) deben iniciar sesión para acceder al panel.
- **Gestión de Usuarios por Propietario**: Cada manager solo puede ver, agregar, editar, eliminar y renovar los usuarios que él mismo ha creado.
- **Expiración Automática**: Los usuarios se crean con una vida útil de 30 días. Los usuarios vencidos se eliminan automáticamente del archivo de configuración.
- **Renovación de Usuarios**: Renueva el acceso de un usuario por otros 30 días con un solo clic.
- **Indicadores de Estado**: Los usuarios se etiquetan visualmente como "Activo", "Por Vencer" (dentro de 7 días) o "Vencido".
- **Reinicio Automático del Servicio**: Después de cada acción (agregar, editar, eliminar, renovar), la aplicación reinicia automáticamente el servicio `zivpn` para aplicar los cambios de inmediato.
- **Filtrado y Paginación**: Filtra y navega fácilmente por la lista de usuarios.
- **Gestión de Managers (Superadmin)**: El primer usuario (dueño) puede crear y eliminar otras cuentas de manager directamente desde el panel.

## Cómo Funciona

La aplicación interactúa con dos archivos de configuración principales en el servidor donde se despliega:

1.  `/etc/zivpn/managers.json`: Almacena las credenciales (usuario y contraseña) de los managers que pueden iniciar sesión en este panel. **La aplicación gestiona este archivo automáticamente.**
2.  `/etc/zivpn/config.json`: Almacena la configuración de los usuarios finales de la VPN. La aplicación gestiona este archivo automáticamente.

### Estructura de `managers.json`

Este archivo es un array de objetos. **No necesitas crearlo manualmente**. La primera vez que accedas al panel, se creará automáticamente un usuario por defecto:
- **Usuario:** `admin`
- **Contraseña:** `password`

El primer manager en este archivo es considerado el "dueño" o superadministrador y tiene permisos para gestionar a los demás.

```json
[
  {
    "username": "admin",
    "password": "password"
  },
  {
    "username": "otro_manager",
    "password": "otra_contraseña_fuerte"
  }
]
```

### Estructura de los Usuarios en `config.json`

Cada usuario de la VPN tiene un campo `createdBy` para asociarlo a un manager.

```json
{
  "username": "testuser",
  "createdAt": "2023-10-27T10:00:00.000Z",
  "expiresAt": "2023-11-26T10:00:00.000Z",
  "createdBy": "manager1"
}
```

## Instalación y Despliegue en tu VPS (Ubuntu)

Sigue estos pasos en la terminal de tu servidor VPS para instalar y ejecutar el panel.

### 1. Prerrequisitos

Primero, actualiza tu sistema e instala las herramientas necesarias.

**Nota Importante:** Este panel sirve para **gestionar una instalación existente de `zivpn`**. Debes asegurarte de que `zivpn` ya esté instalado y funcionando como un servicio `systemd` en tu servidor.

```bash
# Actualiza la lista de paquetes de tu servidor
sudo apt update && sudo apt upgrade -y

# Instala git (si no lo tienes)
sudo apt install git -y
```

Asegúrate de tener **Node.js (v20 o superior)** y `npm` instalados. La forma más recomendada es usar `nvm` (Node Version Manager).

```bash
# Comprueba si tienes Node.js
node -v

# Si no lo tienes o la versión es antigua, instala nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Carga nvm en tu sesión actual de terminal
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Instala y usa Node.js v20
nvm install 20
nvm use 20
```
**Importante:** Después de instalar `nvm`, cierra y vuelve a abrir tu terminal SSH para asegurarte de que `nvm` esté disponible.

### 2. Clona el Proyecto

Clona el repositorio desde GitHub en la carpeta que prefieras en tu VPS.

```bash
git clone https://github.com/sysdevcheck/UdpPanelWeb.git
cd UdpPanelWeb
```

### 3. Instala las Dependencias del Proyecto

```bash
npm install
```

### 4. Configura los Permisos y Archivos

La aplicación necesita permisos para escribir en el directorio `/etc/zivpn/`.

```bash
# Crea el directorio si no existe.
sudo mkdir -p /etc/zivpn

# Asigna la propiedad al usuario que usarás para ejecutar la aplicación.
# Reemplaza 'tu_usuario' con tu nombre de usuario actual en el VPS (ej. ubuntu, root, etc.)
# Usar la variable de entorno $USER lo hará automáticamente.
sudo chown -R $USER:$USER /etc/zivpn
```

### 5. Permisos de Sudo para Reiniciar el Servicio (Paso Crítico)

Para que la aplicación pueda reiniciar `zivpn`, el usuario que ejecuta la aplicación necesita permisos para ejecutar `systemctl` sin contraseña.

Abre el archivo de sudoers con `visudo` (es la forma segura de editarlo):
```bash
sudo visudo
```
Agrega la siguiente línea al **final del archivo**. Es muy importante que reemplaces `tu_usuario` por el nombre de usuario con el que vas a ejecutar la aplicación (el mismo que usarás para `pm2`). Si no estás seguro, usa el usuario con el que te conectas por SSH (ej. `ubuntu`).

```
# Reemplaza 'tu_usuario' por el nombre de usuario de tu VPS (ej. ubuntu)
tu_usuario ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart zivpn
```
Para guardar y salir en `visudo` (que usa un editor como `nano` o `vim`):
*   Si es `nano`: `Ctrl+X`, luego `Y`, luego `Enter`.
*   Si es `vim`: presiona `Esc`, escribe `:wq` y presiona `Enter`.

### 6. Construye y Ejecuta la Aplicación

Construye la aplicación para producción:
```bash
npm run build
```

### 7. Mantén la Aplicación en Funcionamiento con PM2

Para que el panel permanezca en línea incluso si cierras la terminal o reinicias el servidor, usa un gestor de procesos como `pm2`.

```bash
# Instala pm2 globalmente
sudo npm install -g pm2

# Dentro de la carpeta del proyecto (UdpPanelWeb), inicia la aplicación con pm2
# Asegúrate de ejecutar este comando como el usuario que configuraste en sudoers.
pm2 start npm --name "zivpn-panel" -- start

# Configura pm2 para que se inicie automáticamente al arrancar el servidor
pm2 startup

# El comando anterior te dará un comando para copiar y pegar. Cópialo y ejecútalo como root (con sudo).
# Generalmente se ve así:
# sudo env PATH=$PATH:/home/tu_usuario/.nvm/versions/node/v20.x.x/bin /home/tu_usuario/.nvm/versions/node/v20.x.x/lib/node_modules/pm2/bin/pm2 startup systemd -u tu_usuario --hp /home/tu_usuario

# Guarda la configuración actual de pm2
pm2 save
```

**¡Instalación completa!** Ahora deberías poder acceder a tu panel visitando `http://[IP_DE_TU_VPS]:9002`.
El login por defecto será:
- **Usuario:** `admin`
- **Contraseña:** `password`


## Mantenimiento y Actualizaciones

### Cómo Subir Cambios a GitHub

Cuando se realicen cambios en el código fuente en el entorno de desarrollo, sigue estos pasos para subirlos a tu repositorio de GitHub.

1.  **Añade todos los archivos modificados:**
    ```bash
    git add .
    ```
2.  **Crea un "commit" con un mensaje descriptivo:**
    ```bash
    git commit -m "Describe aquí los cambios que hiciste"
    ```
3.  **Sube los cambios a la rama principal:**
    ```bash
    git push origin main
    ```

### Cómo Actualizar la Aplicación en el VPS

Una vez que tus cambios estén en GitHub, conéctate a tu VPS y sigue estos pasos para actualizar la aplicación en producción.

1.  **Ve a la carpeta del proyecto:**
    ```bash
    cd UdpPanelWeb
    ```
2.  **Descarga la última versión desde GitHub:**
    ```bash
    git pull origin main
    ```
3.  **Instala las dependencias (importante si se añadieron nuevas librerías):**
    ```bash
    npm install
    ```
4.  **Reconstruye la aplicación con los nuevos cambios:**
    ```bash
    npm run build
    ```
5.  **Reinicia la aplicación con PM2 para que los cambios surtan efecto:**
    ```bash
    pm2 restart zivpn-panel
    ```

### Resolución de Problemas y Comandos Útiles

**Verificar el estado del panel:**
```bash
pm2 status zivpn-panel
```
**Verificar con qué usuario está corriendo la aplicación:**
Este comando te mostrará el usuario en la columna `user`. ¡Este debe ser el mismo usuario que pusiste en el archivo `sudoers`!
```bash
pm2 list
```

**Ver los logs del panel en tiempo real (muy útil para ver errores):**
```bash
pm2 logs zivpn-panel
```

**Reiniciar el panel si has hecho cambios en el código (después de un `git pull`):**
```bash
# Dentro de la carpeta UdpPanelWeb
pm2 restart zivpn-panel
```

**Parar el panel:**
```bash
pm2 stop zivpn-panel
```

**Verificar el estado del servicio de la VPN (zivpn):**
```bash
sudo systemctl status zivpn
```

**Reiniciar manualmente el servicio de la VPN:**
```bash
sudo systemctl restart zivpn
```
