# 🛡️ Panel de Gestión para ZiVPN - Multi-Manager

Esta es una aplicación web Next.js que proporciona una interfaz amigable y multi-usuario para gestionar de forma segura a los usuarios de múltiples servicios [ZiVPN](https://github.com/zivvpn/zivpn-core).

El panel está diseñado con un sistema de roles:
- **Dueño (Owner)**: Tiene control total. Puede configurar múltiples servidores VPS, crear cuentas de manager y asignar cada manager a un servidor específico. También puede gestionar los usuarios de cualquier servidor.
- **Manager**: Tiene control limitado. Solo puede gestionar los usuarios VPN del servidor VPS que el dueño le ha asignado. No puede ver las credenciales de los servidores ni a otros managers.

> **IMPORTANTE:** Esta aplicación está diseñada para ser desplegada en su **propio Servidor Privado Virtual (VPS)**. No es compatible con plataformas de hosting "serverless" como Vercel, Netlify o Firebase App Hosting debido a que requiere acceso directo a la red para conexiones SSH.

---

## 🚀 Instalación en un VPS

Sigue estos pasos para desplegar el panel en tu propio servidor (se recomienda Ubuntu 22.04 o superior).

### Opción 1: Instalación Automática con Script (Recomendado)

Conéctate a tu VPS por SSH y ejecuta los siguientes comandos para descargar y ejecutar el script de instalación automática.

1.  **Descargar el script:**
    ```bash
    curl -o install.sh https://raw.githubusercontent.com/sysdevcheck/UdpPanelWeb/main/install.sh
    ```
2.  **Hacerlo ejecutable:**
    ```bash
    chmod +x install.sh
    ```
3.  **Ejecutarlo:**
    ```bash
    ./install.sh
    ```
El script te guiará a través de la instalación, te pedirá las credenciales para el usuario `Dueño` y configurará todo para que la aplicación se ejecute automáticamente.

### Opción 2: Instalación Manual

Si prefieres instalar paso a paso:

#### 1. Requisitos Previos

Asegúrate de tener lo siguiente instalado en tu VPS:
- **Node.js**: Versión 20.x recomendada.
- **npm**: Generalmente se instala junto con Node.js.
- **git**: Para clonar el repositorio.

Puedes instalar Node.js y npm fácilmente con `nvm` (Node Version Manager):
```bash
sudo apt-get update
sudo apt-get install -y curl
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
```

#### 2. Clonar el Repositorio

Clona el proyecto en tu VPS:
```bash
git clone https://github.com/sysdevcheck/UdpPanelWeb.git
cd UdpPanelWeb
```

#### 3. Instalar Dependencias

Instala todas las dependencias del proyecto:
```bash
npm install
```

#### 4. Configurar Variables de Entorno

Crea un archivo `.env.local` para guardar tu configuración privada.
```bash
nano .env.local
```
Añade las siguientes líneas al archivo, personalizando los valores:
```
# Credenciales del usuario Dueño (Owner)
OWNER_USERNAME=admin
OWNER_PASSWORD=tu_contraseña_segura

# URL base donde se ejecutará el panel.
# Si lo ejecutas en el mismo VPS y en el puerto 3000, usa esta:
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```
> **Guardar y salir en `nano`**: `Ctrl+X`, luego `Y`, y finalmente `Enter`.

#### 5. Compilar la Aplicación

Compila el proyecto para producción. Esto optimizará los archivos para un mejor rendimiento.
```bash
npm run build
```

#### 6. Iniciar la Aplicación con PM2

`pm2` es un gestor de procesos que mantendrá tu aplicación en línea y la reiniciará si es necesario.

1.  **Instala PM2 globalmente**:
    ```bash
    npm install pm2 -g
    ```
2.  **Inicia tu aplicación con PM2**:
    Desde la carpeta de tu proyecto (`UdpPanelWeb`), ejecuta:
    ```bash
    pm2 start npm --name "zivpn-panel" -- start
    ```
3.  **Guarda la configuración para que se reinicie con el servidor**:
    ```bash
    pm2 save
    pm2 startup
    ```
    (El último comando te dará una línea para copiar y pegar, ejecútala para completar la configuración).

**Comandos útiles de PM2**:
- `pm2 list`: Muestra el estado de tus aplicaciones.
- `pm2 restart zivpn-panel`: Reinicia el panel.
- `pm2 logs zivpn-panel`: Muestra los registros (logs) en tiempo real.
- `pm2 stop zivpn-panel`: Detiene la aplicación.

---
## 🔐 Permisos en los Servidores ZiVPN Remotos

Para que el panel pueda gestionar tus servidores, el usuario SSH que configures en el panel necesita permisos para reiniciar el servicio `zivpn` sin contraseña.

Conéctate a **CADA UNO** de tus servidores ZiVPN y ejecuta:
```bash
sudo visudo
```
Agrega la siguiente línea al **final del archivo** (reemplaza `root` si usas otro usuario SSH):
```
# Permite reiniciar el servicio zivpn sin pedir contraseña
root ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart zivpn
```
> **¿Cómo guardar y salir?**
> *   `nano`: `Ctrl+X`, luego `Y`, luego `Enter`.
> *   `vim`: presiona `Esc`, escribe `:wq` y presiona `Enter`.

¡Y listo! Tu panel "Multi-Manager" está configurado para gestionar todos tus servidores desde tu propio VPS.
