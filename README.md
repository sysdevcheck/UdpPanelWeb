# 🛡️ Panel de Gestión para ZiVPN - Multi-Manager

Esta es una aplicación web Next.js que proporciona una interfaz amigable y multi-usuario para gestionar de forma segura a los usuarios de múltiples servicios [ZiVPN](https://github.com/zivvpn/zivpn-core).

El panel está diseñado con un sistema de roles:
- **Dueño (Owner)**: Tiene control total. Puede configurar múltiples servidores VPS, crear cuentas de manager y asignar cada manager a un servidor específico. También puede gestionar los usuarios de cualquier servidor.
- **Manager**: Tiene control limitado. Solo puede gestionar los usuarios VPN del servidor VPS que el dueño le ha asignado. No puede ver las credenciales de los servidores ni a otros managers.

> **IMPORTANTE:** Esta aplicación está diseñada para ser desplegada en su **propio Servidor Privado Virtual (VPS)**. No es compatible con plataformas de hosting "serverless" como Vercel, Netlify o Firebase App Hosting debido a que requiere acceso directo a la red para conexiones SSH.

---

## ✨ Características Principales

- **🔑 Sistema de Login por Roles**: Dueño y Managers tienen vistas y permisos diferentes.
- **☁️ Gestión Multi-Servidor (Solo Dueño)**:
    - Añade, edita y elimina las configuraciones de múltiples servidores ZiVPN remotos.
    - Indicadores de estado **Online/Offline** para cada servidor, con verificación automática.
- **👑 Gestión de Managers (Solo Dueño)**:
    - Crea y elimina cuentas de "manager".
    - Asigna cada manager a un servidor VPS específico desde un menú desplegable.
- **👤 Gestión de Usuarios VPN por Propietario**:
    - Cada manager solo puede ver y gestionar (añadir, editar, eliminar, renovar) los usuarios que él mismo ha creado en su servidor asignado.
    - El dueño puede seleccionar cualquier servidor y gestionar todos los usuarios de ese servidor.
- **🗓️ Expiración Automática**: Los usuarios y managers se crean con una vida útil de 30 días.
- **🔄 Renovación Fácil**: Renueva el acceso de un usuario por otros 30 días con un solo clic.
- **🚦 Indicadores de Estado de Usuario**: Los usuarios se etiquetan visualmente como **Activo**, **Por Vencer** (dentro de 7 días) o **Vencido**.
- **⚡ Acciones Remotas por Servidor**:
    - **Reiniciar Servicio**: Cada manager (o el dueño) puede reiniciar el servicio `zivpn` de su servidor.
    - **Resetear Configuración**: Ejecuta un script de reinstalación en el VPS, respaldando y restaurando automáticamente los usuarios existentes.
- **📦 Sistema de Backup y Restauración (Solo Dueño)**:
    - **Exportar Backup General**: Descarga un único archivo `json` con la configuración de TODOS los servidores, managers y usuarios VPN.
    - **Importar Backup General**: Restaura toda la configuración del panel desde un archivo de backup.
- **📱 Interfaz Responsiva en Español**: Totalmente funcional en dispositivos móviles y de escritorio.

---

## 🚀 Instalación en un VPS

Sigue estos pasos para desplegar el panel en tu propio servidor (se recomienda Ubuntu 22.04 o superior).

### 1. Requisitos Previos

Asegúrate de tener lo siguiente instalado en tu VPS:
- **Node.js**: Versión 18.x o 20.x recomendada.
- **npm**: Generalmente se instala junto con Node.js.
- **git**: Para clonar el repositorio.

Puedes instalar Node.js y npm fácilmente con `nvm` (Node Version Manager) o siguiendo guías oficiales.

### 2. Clonar el Repositorio

Conéctate a tu VPS por SSH y clona el proyecto:
```bash
git clone https://github.com/sysdevcheck/UdpPanelWeb.git
cd UdpPanelWeb
```

### 3. Instalar Dependencias

Instala todas las dependencias del proyecto:
```bash
npm install
```

### 4. Configurar Variables de Entorno

Crea un archivo `.env.local` para guardar tu configuración privada. **Este archivo no se sube a `git`**.
```bash
nano .env.local
```
Añade las siguientes líneas al archivo, personalizando los valores:
```
# Credenciales del usuario Dueño (Owner)
OWNER_USERNAME=admin
OWNER_PASSWORD=tu_contraseña_segura

# URL base donde se ejecutará el panel.
# Si lo ejecutas en el mismo VPS y en el puerto 9002, usa esta:
NEXT_PUBLIC_BASE_URL=http://localhost:9002
```
> **Guardar y salir en `nano`**: `Ctrl+X`, luego `Y`, y finalmente `Enter`.

### 5. Compilar la Aplicación

Compila el proyecto para producción. Esto optimizará los archivos para un mejor rendimiento.
```bash
npm run build
```

### 6. Iniciar la Aplicación

Ahora puedes iniciar el servidor de producción:
```bash
npm start
```
Por defecto, la aplicación se ejecutará en `http://localhost:9002`. Si estás accediendo a través de la IP de tu VPS, deberías poder verla en `http://<IP_DE_TU_VPS>:9002`.

---

## 🏃‍♂️ (Recomendado) Mantener la App Corriendo con PM2

`pm2` es un gestor de procesos que mantendrá tu aplicación en línea, la reiniciará si se cae y te ayudará a gestionarla.

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

## 🚑 Resolución de Problemas

### Error de Conexión al Añadir un Servidor

-   **"Authentication failed"**: Revisa el nombre de usuario y la contraseña del VPS remoto que estás intentando añadir.
-   **"Connection timed out"**:
    -   Verifica que la IP del servidor remoto es correcta.
    -   Asegúrate de que el puerto SSH (usualmente 22) está abierto en el firewall del servidor remoto.
-   **"Host not found"**: El nombre de host o la IP no se pudo resolver. Comprueba que está bien escrito.

### Las Acciones (Añadir Usuario, Reiniciar) Fallan

-   **Revisa los permisos `sudoers`**: Es la causa más común. Asegúrate de que el usuario SSH tiene permiso para ejecutar `systemctl restart zivpn` sin contraseña en el servidor remoto (ver la sección "Permisos en los Servidores ZiVPN Remotos" más abajo).
-   **Consulta los logs**: Usa `pm2 logs zivpn-panel` para ver los errores detallados.
---
## 🔐 Permisos en los Servidores ZiVPN Remotos

Para que el panel pueda gestionar tus servidores, el usuario SSH que configures en el panel (ej. `root`) necesita permisos para reiniciar el servicio `zivpn` sin contraseña.

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
