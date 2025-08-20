
# 🛡️ Panel de Gestión para ZiVPN - Multi-Manager

Esta es una aplicación web Next.js que proporciona una interfaz amigable y multi-usuario para gestionar de forma segura a los usuarios de un servicio [ZiVPN](https://github.com/zivvpn/zivpn-core). En lugar de editar manualmente archivos de configuración en tu servidor, puedes usar este panel para que diferentes "managers" o "revendedores" gestionen sus propios usuarios de forma aislada.

## ✨ Características Principales

- **🔑 Sistema de Login**: Los administradores (managers) deben iniciar sesión para acceder al panel.
- **👤 Gestión de Usuarios por Propietario**: Cada manager solo puede ver, agregar, editar, eliminar y renovar los usuarios que él mismo ha creado.
- **🗓️ Expiración Automática**: Los usuarios se crean con una vida útil de 30 días. Los usuarios vencidos se eliminan automáticamente del archivo de configuración para mantener el sistema limpio.
- **🔄 Renovación Fácil**: Renueva el acceso de un usuario por otros 30 días con un solo clic.
- **🚦 Indicadores de Estado**: Los usuarios se etiquetan visualmente como **Activo**, **Por Vencer** (dentro de 7 días) o **Vencido**.
- **⚡ Reinicio Automático del Servicio**: Después de cada acción que afecte a los usuarios activos (agregar, editar, eliminar), la aplicación reinicia automáticamente el servicio `zivpn` para aplicar los cambios de inmediato.
- **🔎 Filtrado y Paginación**: Filtra y navega fácilmente por la lista de usuarios.
- **👑 Gestión de Managers (Superadmin)**: El primer usuario (dueño) puede crear y eliminar otras cuentas de manager directamente desde el panel.
- **📱 Interfaz Responsiva**: Totalmente funcional en dispositivos móviles y de escritorio.

## ⚙️ Cómo Funciona

La aplicación interactúa con dos archivos de configuración principales en el servidor donde se despliega.

> **Importante:** Estos archivos **no están en el proyecto**. La aplicación los crea y gestiona por ti directamente en el directorio `/etc/zivpn/` de tu VPS. No necesitas crearlos manualmente.

1.  **`/etc/zivpn/managers.json`**: Almacena las credenciales (usuario y contraseña) de los managers que pueden iniciar sesión en este panel. La aplicación gestiona este archivo automáticamente.
2.  **`/etc/zivpn/users-metadata.json`**: Almacena los metadatos de los usuarios VPN (quién lo creó, cuándo expira, etc.).
3.  **`/etc/zivpn/config.json`**: Almacena la configuración de los usuarios finales de la VPN en un formato simple que `zivpn` entiende. La aplicación mantiene este archivo sincronizado.

### Estructura de `managers.json`

Este archivo es un array de objetos. **No necesitas crearlo manually**. La primera vez que accedas al panel, se creará automáticamente un usuario por defecto:
- **Usuario:** `admin`
- **Contraseña:** `password`

El primer manager en este archivo es considerado el "dueño" o superadministrador y tiene permisos para gestionar a los demás.

```json
[
  {
    "username": "admin",
    "password": "password",
    "createdAt": "2023-10-27T10:00:00.000Z"
  },
  {
    "username": "otro_manager",
    "password": "otra_contraseña_fuerte",
    "createdAt": "2023-10-28T11:00:00.000Z",
    "expiresAt": "2023-11-27T11:00:00.000Z"
  }
]
```

### Estructura de los Usuarios en `users-metadata.json`

Cada usuario de la VPN tiene un campo `createdBy` para asociarlo a un manager.

```json
[
  {
    "username": "testuser",
    "createdAt": "2023-10-27T10:00:00.000Z",
    "expiresAt": "2023-11-26T10:00:00.000Z",
    "createdBy": "admin"
  }
]
```

## 🚀 Instalación y Despliegue en tu VPS (Ubuntu)

Sigue estos pasos en la terminal de tu servidor VPS para instalar y ejecutar el panel.

### 1. Prerrequisitos

> **Nota Importante:** Este panel sirve para **gestionar una instalación existente de `zivpn`**. Debes asegurarte de que `zivpn` ya esté instalado y funcionando como un servicio `systemd` en tu servidor.

Primero, actualiza tu sistema e instala las herramientas necesarias.

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

# Carga nvm en tu sesión actual de terminal (o cierra y abre la terminal)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Instala y usa Node.js v20
nvm install 20
nvm use 20
```

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

### 4. Configura los Permisos (Paso Crítico ⚠️)

La aplicación necesita permisos para escribir en el directorio `/etc/zivpn/`. El usuario que ejecute la aplicación (`pm2` lo hará por ti) debe ser el propietario de este directorio.

```bash
# Crea el directorio si no existe.
sudo mkdir -p /etc/zivpn

# Asigna la propiedad al usuario que usarás para ejecutar la aplicación.
# Reemplaza 'tu_usuario' con tu nombre de usuario actual en el VPS (ej. ubuntu, root, etc.)
# Usar la variable de entorno $USER lo hará automáticamente por el usuario actual.
sudo chown -R $USER:$USER /etc/zivpn
```

### 5. Permisos de `sudo` para Reiniciar el Servicio (Paso Crítico ⚠️)

Para que la aplicación pueda reiniciar `zivpn`, el usuario que ejecuta la aplicación necesita permisos para ejecutar `systemctl` sin contraseña.

Abre el archivo de sudoers con `visudo` (es la forma segura de editarlo):
```bash
sudo visudo
```
Agrega la siguiente línea al **final del archivo**. Es muy importante que reemplaces `tu_usuario` por el nombre de usuario con el que vas a ejecutar la aplicación (el mismo que usaste en el paso anterior, ej. `ubuntu`).

```
# Reemplaza 'tu_usuario' por el nombre de usuario de tu VPS (ej. ubuntu)
tu_usuario ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart zivpn
```
> **¿Cómo guardar y salir en `visudo`?**
> *   Si es `nano`: `Ctrl+X`, luego `Y`, luego `Enter`.
> *   Si es `vim`: presiona `Esc`, escribe `:wq` y presiona `Enter`.

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
# Asegúrate de ejecutar este comando como el usuario que configuraste en los permisos.
pm2 start npm --name "zivpn-panel" -- start

# Configura pm2 para que se inicie automáticamente al arrancar el servidor
pm2 startup

# El comando anterior te dará un comando para copiar y pegar. Cópialo y pégalo.
# Generalmente se ve así (¡el tuyo puede ser diferente!):
# sudo env PATH=$PATH:/home/tu_usuario/.nvm/versions/node/v20.x.x/bin pm2 startup systemd -u tu_usuario --hp /home/tu_usuario

# Guarda la configuración actual de pm2
pm2 save
```

**¡Instalación completa! 🎉** Ahora deberías poder acceder a tu panel visitando `http://[IP_DE_TU_VPS]:9002`.

- **Usuario:** `admin`
- **Contraseña:** `password`

## 🔒 Opcional y Recomendado: Usar un Subdominio con HTTPS

Para un acceso más profesional y seguro (ej. `https://panel.tudominio.com`), puedes usar **Nginx** como reverse proxy y **Let's Encrypt** para obtener un certificado SSL gratuito.

### Prerrequisitos del Subdominio

1.  **Tener un dominio**: Debes ser dueño de un nombre de dominio.
2.  **Configurar un Registro DNS**: En el panel de control de tu proveedor de dominio, crea un **registro `A`** para tu subdominio (ej. `panel`) que apunte a la dirección IP pública de tu VPS.

### Paso 1: Instalar Nginx

```bash
sudo apt update
sudo apt install nginx -y
```

### Paso 2: Crear Configuración de Nginx para el Panel

Crea un nuevo archivo de configuración para tu panel:
```bash
sudo nano /etc/nginx/sites-available/zivpn-panel.conf
```
Pega el siguiente contenido en el archivo. **Recuerda cambiar `panel.tudominio.com` por tu subdominio real.**

```nginx
server {
    listen 80;
    server_name panel.tudominio.com;

    location / {
        proxy_pass http://localhost:9002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Paso 3: Activar la Configuración y Reiniciar Nginx

```bash
# Crea un enlace simbólico para activar la configuración
sudo ln -s /etc/nginx/sites-available/zivpn-panel.conf /etc/nginx/sites-enabled/

# Verifica que la sintaxis de Nginx es correcta
sudo nginx -t

# Reinicia Nginx para aplicar los cambios
sudo systemctl restart nginx
```
Ahora deberías poder acceder a tu panel a través de `http://panel.tudominio.com`.

### Paso 4: Configurar HTTPS con Let's Encrypt (Certbot)

```bash
# Instala Certbot y el plugin de Nginx
sudo apt install certbot python3-certbot-nginx -y

# Obtén y configura el certificado SSL (reemplaza con tu subdominio)
sudo certbot --nginx -d panel.tudominio.com
```
Sigue las instrucciones en pantalla. Te pedirá un email y que aceptes los términos de servicio. Cuando te pregunte sobre la redirección de HTTP a HTTPS, es muy recomendable elegir la opción de redirigir.

¡Listo! Ahora puedes acceder de forma segura a `https://panel.tudominio.com`.

## 🛠️ Mantenimiento y Actualizaciones

### Cómo Subir Cambios a GitHub (desde tu PC de desarrollo)

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

Once que tus cambios estén en GitHub, conéctate a tu VPS y sigue estos pasos.

```bash
# 1. Ve a la carpeta del proyecto
cd ~/UdpPanelWeb # o la ruta donde lo clonaste

# 2. Descarga la última versión desde GitHub
git pull origin main

# 3. Instala las dependencias (importante si se añadieron nuevas librerías)
npm install

# 4. Reconstruye la aplicación con los nuevos cambios
npm run build

# 5. Reinicia la aplicación con PM2 para que los cambios surtan efecto
pm2 restart zivpn-panel
```

## 🚑 Resolución de Problemas

Aquí tienes algunos comandos útiles para diagnosticar y solucionar problemas comunes.

### Error: 502 Bad Gateway

Este error significa que Nginx no puede comunicarse con tu aplicación (`zivpn-panel`). La causa más probable es que la aplicación se ha detenido o ha fallado.

1.  **Revisa los logs de la aplicación en tiempo real.** Este es el comando más importante. Te dirá exactamente por qué la aplicación no arranca o se detiene.
    ```bash
    pm2 logs zivpn-panel
    ```
    Busca cualquier mensaje de `Error`. 

2.  **Verifica el estado del proceso en PM2.**
    ```bash
    pm2 list
    ```
    Asegúrate de que `zivpn-panel` tiene el estado `online`. Si dice `errored` o `stopped`, significa que la aplicación se ha colgado. Intenta reiniciarla con `pm2 restart zivpn-panel` y observa los logs.

3.  **Revisa los logs de Nginx.** Si la aplicación parece estar corriendo (`online` en `pm2 list`), los logs de Nginx pueden darte una pista.
    ```bash
    sudo tail -f /var/log/nginx/error.log
    ```
    Busca errores como `connect() failed (111: Connection refused)`. Esto confirma que Nginx está intentando conectar pero la aplicación no responde en el puerto `9002`.

4.  **Comprueba la configuración de Nginx.** Un error de sintaxis puede ser el problema.
    ```bash
    sudo nginx -t
    ```
    Si hay un error, te indicará el archivo y la línea. Si todo está `ok`, reinicia Nginx.
    ```bash
    sudo systemctl restart nginx
    ```

### Error: `EACCES: permission denied` en los logs de PM2

Esto significa que la aplicación no tiene permisos para leer o escribir en el directorio `/etc/zivpn/`.

1.  **Verifica con qué usuario está corriendo la aplicación.**
    ```bash
    pm2 list
    ```
    Fíjate en la columna `user`.
2.  **Asigna la propiedad del directorio a ese usuario.**
    ```bash
    # Reemplaza 'usuario_correcto' con el que viste en 'pm2 list'
    sudo chown -R usuario_correcto:usuario_correcto /etc/zivpn
    ```
    Luego, reinicia la aplicación: `pm2 restart zivpn-panel`.

### Error de `sudo` al reiniciar el servicio `zivpn`

Si los logs de PM2 muestran un error relacionado con `sudo` o `systemctl`, el problema está en la configuración de `sudoers`.

1.  **Edita el archivo `sudoers` de forma segura.**
    ```bash
    sudo visudo
    ```
2.  **Comprueba la línea que añadiste.** Asegúrate de que no tiene errores de tipeo y que usa el nombre de usuario correcto (el mismo que aparece en `pm2 list`).
    ```
    # La línea debe ser exactamente así (cambiando 'tu_usuario')
    tu_usuario ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart zivpn
    ```

### Comandos Generales de PM2

- **Reiniciar el panel manualmente:**
  ```bash
  pm2 restart zivpn-panel
  ```

- **Limpiar procesos duplicados (si has iniciado el panel varias veces por error):**
  ```bash
  # Detiene y elimina el proceso de la lista de PM2
  pm2 delete zivpn-panel
  
  # Guarda la lista de procesos ahora limpia
  pm2 save
  
  # Inicia el proceso de nuevo, una sola vez
  # (Asegúrate de estar en la carpeta del proyecto)
  pm2 start npm --name "zivpn-panel" -- start
  
  # Guarda la configuración final
  pm2 save
  ```
