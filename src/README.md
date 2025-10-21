# 🛡️ Panel de Gestión para ZiVPN - Multi-Manager

Esta es una aplicación web Next.js que proporciona una interfaz amigable y multi-usuario para gestionar de forma segura a los usuarios de un servicio [ZiVPN](https://github.com/zivvpn/zivpn-core).

La aplicación tiene dos modos de operación:

1.  **Modo Integrado (por defecto)**: El panel se ejecuta en el mismo VPS que `zivpn`. Gestiona los archivos de configuración localmente.
2.  **Modo Remoto**: El panel se puede desplegar en cualquier plataforma (como Vercel o Firebase) y gestiona un servidor `zivpn` remoto a través de una conexión SSH.

---

## ✨ Características Principales

- **🔑 Sistema de Login**: Los administradores (managers) deben iniciar sesión para acceder al panel.
- **👤 Gestión de Usuarios por Propietario**: Cada manager solo puede ver y gestionar los usuarios que él mismo ha creado.
- **☁️ Soporte para Gestión Remota (SSH)**: El dueño del panel puede configurar credenciales SSH para gestionar un servidor `zivpn` que se encuentre en otra máquina.
- **🗓️ Expiración Automática**: Los usuarios se eliminan automáticamente 30 días después de su creación.
- **🔄 Renovación Fácil**: Renueva el acceso de un usuario por otros 30 días con un solo clic.
- **🚦 Indicadores de Estado**: Los usuarios se etiquetan visualmente como **Activo**, **Por Vencer** (dentro de 7 días) o **Vencido**.
- **⚡ Reinicio Automático del Servicio**: Después de cada acción, la aplicación reinicia el servicio `zivpn` para aplicar los cambios (local o remotamente).
- **🔎 Filtrado y Paginación**: Filtra y navega fácilmente por la lista de usuarios.
- **👑 Gestión de Managers (Superadmin)**: El primer usuario (dueño) puede crear y eliminar otras cuentas de manager.
- **📱 Interfaz Responsiva**: Totalmente funcional en dispositivos móviles y de escritorio.

---

## 🚀 Instalación y Despliegue

### Opción 1: Modo Integrado (Todo en un VPS)

Usa este método para instalar el panel y `zivpn` en el mismo servidor.

#### 1. Prerrequisitos

> **Nota Importante:** Debes asegurarte de que `zivpn` ya esté instalado y funcionando como un servicio `systemd` en tu servidor.

Primero, actualiza tu sistema e instala las herramientas necesarias (`git`, `Node.js v20+`).

```bash
# Actualiza los paquetes del sistema
sudo apt update && sudo apt upgrade -y
# Instala git
sudo apt install git -y
# Instala nvm para gestionar Node.js
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
# Recarga la terminal o ejecuta 'source ~/.bashrc'
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
# Instala y usa Node.js v20
nvm install 20
nvm use 20
```

#### 2. Clona el Proyecto

```bash
git clone https://github.com/sysdevcheck/UdpPanelWeb.git
cd UdpPanelWeb
```

#### 3. Instala Dependencias y Configura Permisos

```bash
npm install

# La aplicación necesita escribir en /etc/zivpn/
# El usuario que ejecuta pm2 (normalmente 'root') debe ser el propietario.
sudo mkdir -p /etc/zivpn
sudo chown -R root:root /etc/zivpn

# Permite que la app reinicie el servicio zivpn sin contraseña
sudo visudo
# Agrega esta línea al final del archivo:
# root ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart zivpn
```

#### 4. Construye y Ejecuta con PM2

```bash
# Construye la aplicación
npm run build

# Instala pm2 globalmente
sudo env "PATH=$PATH" npm install -g pm2

# Inicia la aplicación
pm2 start npm --name "zivpn-panel" -- start

# Configura pm2 para que se inicie al arrancar el servidor y guarda la configuración
pm2 startup
pm2 save
```

**¡Instalación completa!** Accede a tu panel en `http://[IP_DE_TU_VPS]:9002`.
- **Usuario:** `admin`
- **Contraseña:** `password`

### Opción 2: Modo Remoto (Panel en la Nube, ej. Firebase/Vercel)

Usa este método si quieres alojar el panel en un servicio de hosting y gestionar tu servidor `zivpn` remotamente.

1.  **Despliega el Proyecto**:
    *   Haz un "Fork" de este repositorio en tu propia cuenta de GitHub.
    *   Conecta tu repositorio a un servicio como **Vercel** o **Firebase App Hosting**.
    *   La plataforma debería detectar que es un proyecto Next.js y desplegarlo automáticamente. No se requiere configuración adicional de compilación.

2.  **Accede al Panel Desplegado**:
    *   Visita la URL que te proporcionó tu servicio de hosting (ej. `https://mi-panel.vercel.app`).
    *   Inicia sesión con el usuario por defecto: `admin` y contraseña `password`.

3.  **Configura la Conexión SSH**:
    *   Una vez dentro, ve a la pestaña **"Managers"**.
    *   Verás una sección llamada **"Remote Server SSH Config"**.
    *   Introduce la **IP (o hostname)**, **puerto** (usualmente 22), **nombre de usuario** (ej. `root`) y la **contraseña** de tu servidor `zivpn`.
    *   Guarda la configuración.

4.  **Permisos en el Servidor Remoto**:
    *   Asegúrate de que el usuario SSH que configuraste tiene permisos para reiniciar `zivpn` sin contraseña. Conéctate a tu servidor `zivpn` y ejecuta `sudo visudo`.
    *   Agrega la siguiente línea al final (reemplaza `root` si usas otro usuario):
        ```
        root ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart zivpn
        ```

Ahora el panel desplegado en la nube gestionará tu servidor `zivpn` de forma remota.

---

## 💻 Desarrollo Local

Para hacer cambios en el código, ejecuta la aplicación en tu computadora.

1.  **Clona e instala**:
    ```bash
    git clone https://github.com/sysdevcheck/UdpPanelWeb.git
    cd UdpPanelWeb
    npm install
    ```
2.  **Ejecuta el servidor de desarrollo**:
    ```bash
    npm run dev
    ```
    La app estará en `http://localhost:9002`. En este modo, simula la creación de archivos localmente en `src/lib/local-dev/` a menos que configures las credenciales SSH para apuntar a un servidor de desarrollo.

---

## 🔒 Opcional: Usar un Subdominio con HTTPS (para VPS)

Si instalaste en un VPS, es muy recomendable usar Nginx como reverse proxy para tener un dominio `https://panel.tudominio.com`.

1.  **Apunta tu subdominio (Registro DNS 'A') a la IP de tu VPS.**
2.  **Instala Nginx**: `sudo apt install nginx -y`
3.  **Crea un archivo de configuración para Nginx**:
    ```bash
    sudo nano /etc/nginx/sites-available/zivpn-panel.conf
    ```
    Pega esto (cambia `panel.tudominio.com`):
    ```nginx
    server {
        listen 80;
        server_name panel.tudominio.com;

        location / {
            proxy_pass http://127.0.0.1:9002;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }
    ```
4.  **Activa la configuración y reinicia Nginx**:
    ```bash
    sudo ln -s /etc/nginx/sites-available/zivpn-panel.conf /etc/nginx/sites-enabled/
    sudo systemctl restart nginx
    ```
5.  **Instala un certificado SSL con Certbot**:
    ```bash
    sudo apt install certbot python3-certbot-nginx -y
    sudo certbot --nginx -d panel.tudominio.com
    ```
---

## 🚑 Resolución de Problemas

### Error: 502 Bad Gateway (en VPS con Nginx)

Significa que Nginx no puede comunicarse con la aplicación.
1.  **Revisa los logs de la aplicación**: `pm2 logs zivpn-panel`
2.  **Verifica que la app está corriendo**: `pm2 list`

### Error: `EACCES: permission denied` (en logs de PM2)

La aplicación no tiene permisos para escribir en `/etc/zivpn/`.
1.  Verifica el usuario con `pm2 list`.
2.  Asigna la propiedad: `sudo chown -R root:root /etc/zivpn` (reemplaza `root` si es necesario).

### Error de Conexión SSH (en Modo Remoto)

Si las acciones no parecen tener efecto:
1.  **Verifica las credenciales SSH** en la sección de configuración del panel.
2.  **Revisa los permisos de `sudoers`** en el servidor remoto para el reinicio del servicio.
3.  **Consulta los logs del servidor del panel** (en Vercel/Firebase) para ver si hay errores de conexión SSH detallados.
