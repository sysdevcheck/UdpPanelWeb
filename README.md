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

## Instalación y Despliegue en tu VPS

Sigue estos pasos en la terminal de tu servidor VPS para instalar y ejecutar el panel.

### 1. Prerrequisitos

Asegúrate de tener **Node.js (v20 o superior)** y `npm` instalados.
```bash
# Comprueba tu versión de Node.js
node -v
# Si no lo tienes o la versión es antigua, la forma más sencilla es usar nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 20
nvm use 20
```

### 2. Clona el Proyecto

Clona el repositorio desde GitHub en la carpeta que prefieras en tu VPS.

```bash
git clone https://github.com/sysdevcheck/UdpPanelWeb.git
cd UdpPanelWeb
```

### 3. Instala las Dependencias

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

### 5. Permisos de Sudo para Reiniciar el Servicio

Para que la aplicación pueda reiniciar `zivpn`, el usuario que ejecuta la aplicación necesita permisos para ejecutar `systemctl` sin contraseña.

Abre el archivo de sudoers con `visudo` (es la forma segura de editarlo):
```bash
sudo visudo
```
Agrega la siguiente línea al **final del archivo**, reemplazando `tu_usuario` por tu nombre de usuario actual (o usa `$USER` si estás logueado como ese usuario).
```
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

**Prueba inicial (Opcional):**
Puedes probar si la aplicación se inicia correctamente.
```bash
npm start
```
Debería indicar que está corriendo en el puerto 9002. Puedes detenerla con `Ctrl+C`.

### 7. Mantén la Aplicación en Funcionamiento con PM2

Para que el panel permanezca en línea incluso si cierras la terminal o reinicias el servidor, usa un gestor de procesos como `pm2`.

```bash
# Instala pm2 globalmente
sudo npm install -g pm2

# Dentro de la carpeta del proyecto (UdpPanelWeb), inicia la aplicación con pm2
pm2 start npm --name "zivpn-panel" -- start

# Configura pm2 para que se inicie automáticamente al arrancar el servidor
pm2 startup

# El comando anterior te dará un comando para copiar y pegar. Cópialo y ejecútalo.
# Generalmente se ve así: sudo env PATH=$PATH:/home/tu_usuario/.nvm/versions/node/v20.x.x/bin /home/tu_usuario/.nvm/versions/node/v20.x.x/lib/node_modules/pm2/bin/pm2 startup systemd -u tu_usuario --hp /home/tu_usuario

# Guarda la configuración actual de pm2
pm2 save
```

**¡Instalación completa!** Ahora deberías poder acceder a tu panel visitando `http://[IP_DE_TU_VPS]:9002`.
El login por defecto será:
- **Usuario:** `admin`
- **Contraseña:** `password`

### Resolución de Problemas y Comandos Útiles

**Verificar el estado del servicio del panel:**
```bash
pm2 status zivpn-panel
```

**Ver los logs del panel en tiempo real (muy útil para ver errores):**
```bash
pm2 logs zivpn-panel
```

**Reiniciar el panel si has hecho cambios en el código:**
```bash
# Primero, asegúrate de traer los últimos cambios desde GitHub
git pull
# Luego, reinstala dependencias por si algo cambió
npm install
# Reconstruye la aplicación
npm run build
# Finalmente, reinicia la aplicación con pm2
pm2 restart zivpn-panel
```

**Verificar el estado del servicio de la VPN (zivpn):**
```bash
sudo systemctl status zivpn
```

**Reiniciar manualmente el servicio de la VPN:**
```bash
sudo systemctl restart zivpn
```