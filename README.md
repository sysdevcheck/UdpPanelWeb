# 🛡️ Panel de Gestión para ZiVPN - Multi-Manager

Esta es una aplicación web Next.js que proporciona una interfaz amigable y multi-usuario para gestionar de forma segura a los usuarios de un servicio [ZiVPN](https://github.com/zivvpn/zivpn-core).

## 🚀 Modelos de Despliegue

Este panel ofrece dos modos de funcionamiento flexibles:

1.  **Modo Integrado (Todo en uno)**: El panel y el servicio `zivpn` se ejecutan en el **mismo VPS**. Esta es la configuración más simple y directa. La aplicación edita archivos locales en `/etc/zivpn/`.
2.  **Modo Remoto (Panel en la Nube)**: El panel se despliega en un servicio de hosting (como **Firebase App Hosting**) y gestiona un servidor `zivpn` remoto a través de **SSH**. Esto te permite tener una interfaz web rápida y escalable sin exponer directamente tu servidor VPN.

---

## ✨ Características Principales

- **🔑 Sistema de Login**: Los administradores (managers) deben iniciar sesión para acceder al panel.
- **👤 Gestión de Usuarios por Propietario**: Cada manager solo puede ver, agregar, editar, eliminar y renovar los usuarios que él mismo ha creado.
- **🗓️ Expiración Automática**: Los usuarios se crean con una vida útil de 30 días y se eliminan automáticamente al vencer.
- **🔄 Renovación Fácil**: Renueva el acceso de un usuario por otros 30 días con un solo clic.
- **🚦 Indicadores de Estado**: Los usuarios se etiquetan visualmente como **Activo**, **Por Vencer** (dentro de 7 días) o **Vencido**.
- **⚡ Reinicio Automático del Servicio (local o remoto)**: Después de cada acción, la aplicación reinicia el servicio `zivpn` para aplicar los cambios.
- **🔎 Filtrado y Paginación**: Filtra y navega fácilmente por la lista de usuarios.
- **👑 Gestión de Managers (Superadmin)**: El primer usuario (dueño) puede crear y eliminar otras cuentas de manager.
- **☁️ Soporte para Gestión Remota (SSH)**: El dueño puede configurar credenciales SSH para que el panel gestione un servidor `zivpn` remoto.
- **📱 Interfaz Responsiva**: Totalmente funcional en dispositivos móviles y de escritorio.

---

## 🚀 Opción 1: Instalación Integrada (Panel y ZiVPN en el mismo VPS)

> **Nota:** Usa este método si quieres instalar todo en un único servidor.

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

La aplicación necesita permisos para escribir en el directorio `/etc/zivpn/`. El usuario que ejecute la aplicación (`pm2` lo hará por ti, normalmente como `root`) debe ser el propietario de este directorio.

```bash
# Crea el directorio si no existe.
sudo mkdir -p /etc/zivpn

# Asigna la propiedad al usuario que usará pm2 (normalmente root).
sudo chown -R root:root /etc/zivpn
```

### 5. Permisos de `sudo` para Reiniciar el Servicio (Paso Crítico ⚠️)

Para que la aplicación pueda reiniciar `zivpn`, el usuario que la ejecuta necesita permisos para usar `systemctl` sin contraseña.

Abre el archivo de sudoers con `visudo` (es la forma segura de editarlo):
```bash
sudo visudo
```
Agrega la siguiente línea al **final del archivo**:

```
# Permite al usuario root reiniciar el servicio zivpn sin pedir contraseña.
root ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart zivpn
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

Para que el panel permanezca en línea, usa un gestor de procesos como `pm2`.

> **⚠️ Error Común: `sudo: npm: command not found`**
> Si al ejecutar el siguiente comando recibes este error, es porque `sudo` no sabe dónde está el `npm` instalado por `nvm`. La solución es usar la ruta completa que `nvm` proporciona.

```bash
# Instala pm2 globalmente (forma correcta para nvm)
# Esto le pasa la ruta actual de Node a sudo.
sudo env "PATH=$PATH" npm install -g pm2
```

Ahora, con `pm2` instalado, inicia la aplicación:

```bash
# Dentro de la carpeta del proyecto (UdpPanelWeb), inicia la aplicación con pm2
pm2 start npm --name "zivpn-panel" -- start

# Configura pm2 para que se inicie automáticamente al arrancar el servidor
# PM2 te dará un comando para copiar y pegar, ¡hazlo!
pm2 startup

# Guarda la configuración actual de pm2
pm2 save
```

**¡Instalación completa! 🎉** Ahora deberías poder acceder a tu panel visitando `http://[IP_DE_TU_VPS]:9002`.

- **Usuario:** `admin`
- **Contraseña:** `password`

---

## 🚀 Opción 2: Instalación Remota (Panel en Firebase, ZiVPN en VPS)

Este modo te permite alojar la interfaz del panel en un servicio como Firebase App Hosting y controlar tu servidor `zivpn` de forma remota a través de SSH.

### Requisitos del Servidor VPN (VPS)

1.  **`zivpn` instalado**: Asegúrate de que `zivpn` esté instalado y funcionando como un servicio `systemd`.
2.  **Acceso SSH**: Debes tener acceso SSH al VPS con un usuario que tenga permisos `sudo`.
3.  **Configuración `sudoers`**: Al igual que en la instalación local, el usuario SSH que utilices necesita permisos para reiniciar `zivpn` sin contraseña.
    ```bash
    sudo visudo
    ```
    Y añade la línea (reemplazando `el_usuario_ssh` si no es `root`):
    ```
    el_usuario_ssh ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart zivpn
    ```

### Despliegue del Panel en Firebase

1.  **Clona el proyecto en tu máquina local**:
    ```bash
    git clone https://github.com/sysdevcheck/UdpPanelWeb.git
    cd UdpPanelWeb
    npm install
    ```
2.  **Instala Firebase CLI**:
    ```bash
    npm install -g firebase-tools
    ```
3.  **Inicia sesión en Firebase**:
    ```bash
    firebase login
    ```
4.  **Inicializa Firebase en el proyecto**:
    ```bash
    firebase init hosting
    ```
    *   Selecciona un proyecto existente o crea uno nuevo.
    *   Cuando te pregunte por el directorio público, **no uses `public`**. Como esta es una app Next.js, la configuración de despliegue es diferente. Firebase App Hosting lo detectará automáticamente.
5.  **Despliega en Firebase App Hosting**:
    ```bash
    firebase deploy --only hosting
    ```
    Firebase te dará la URL de tu panel desplegado (ej. `https://tu-proyecto.web.app`).

### Configuración de la Conexión SSH

1.  **Accede al panel**: Ve a la URL de tu panel desplegado en Firebase.
2.  **Inicia sesión**: Usa las credenciales por defecto:
    *   **Usuario:** `admin`
    *   **Contraseña:** `password`
3.  **Ve a la pestaña "Managers"**: Como eres el primer usuario, eres el "dueño".
4.  **Rellena el formulario "ZiVPN Server SSH Configuration"**:
    *   **Server IP / Hostname**: La IP de tu VPS donde corre `zivpn`.
    *   **SSH Port**: El puerto SSH de tu VPS (normalmente 22).
    *   **SSH Username**: El usuario con el que te conectas por SSH (ej. `root`).
    *   **SSH Password**: La contraseña de ese usuario.
5.  **Guarda la configuración**.

¡Listo! El panel alojado en Firebase ahora gestionará tu servidor `zivpn` de forma remota.

---

## 🔒 Opcional y Recomendado: Usar un Subdominio con HTTPS (para Instalación Integrada)

Para un acceso más profesional y seguro (ej. `https://panel.tudominio.com`), puedes usar **Nginx** como reverse proxy.

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
        # Nginx redirige el tráfico a la aplicación Node.js que corre en el puerto 9002.
        proxy_pass http://127.0.0.1:9002;
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

> **Explicación de los puertos**: Nginx escucha en el puerto 80 (HTTP). Luego, reenvía internamente esas visitas a tu aplicación, que está escuchando en `localhost` en el puerto `9002`. El usuario final nunca necesita saber el puerto 9002.

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
Sigue las instrucciones en pantalla. Es muy recomendable elegir la opción de redirigir todo el tráfico HTTP a HTTPS.

---

## 🚑 Resolución de Problemas

### Error: 502 Bad Gateway

Este error significa que Nginx no puede comunicarse con tu aplicación (`zivpn-panel`). La causa más probable es que la aplicación se ha detenido o ha fallado.

1.  **Revisa los logs de la aplicación en tiempo real.** Este es el comando más importante.
    ```bash
    pm2 logs zivpn-panel
    ```
    Busca cualquier mensaje de `Error`.

2.  **Verifica que la aplicación está escuchando en el puerto correcto.**
    ```bash
    sudo netstat -tulpn | grep 9002
    ```
    - Si este comando **muestra una línea de resultado** que dice `LISTEN`, tu aplicación está corriendo bien. El problema casi seguro está en la configuración de Nginx. Revisa `proxy_pass http://127.0.0.1:9002;` en tu archivo de configuración de Nginx.
    - Si este comando **no muestra nada**, tu aplicación se ha detenido. La respuesta está en los logs del paso anterior.

3.  **Revisa los logs de Nginx.**
    ```bash
    sudo tail -f /var/log/nginx/error.log
    ```
    Busca errores como `connect() failed (111: Connection refused)`.

### Error: `EACCES: permission denied` en los logs de PM2

Esto significa que la aplicación no tiene permisos para leer o escribir en el directorio `/etc/zivpn/`.

1.  **Verifica con qué usuario está corriendo la aplicación.**
    ```bash
    pm2 list
    ```
    Fíjate en la columna `user`.
2.  **Asigna la propiedad del directorio a ese usuario.**
    ```bash
    # Reemplaza 'root' con el que viste en 'pm2 list' si es diferente
    sudo chown -R root:root /etc/zivpn
    ```
    Luego, reinicia la aplicación: `pm2 restart zivpn-panel`.
```