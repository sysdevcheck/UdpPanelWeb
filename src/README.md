# 🛡️ Panel de Gestión para ZiVPN - Multi-Manager

Esta es una aplicación web Next.js que proporciona una interfaz amigable y multi-usuario para gestionar de forma segura a los usuarios de múltiples servicios [ZiVPN](https://github.com/zivvpn/zivpn-core).

El panel está diseñado con un sistema de roles:
- **Dueño (Owner)**: Tiene control total. Puede configurar múltiples servidores VPS, crear cuentas de manager y asignar cada manager a un servidor específico. También puede gestionar los usuarios de cualquier servidor.
- **Manager**: Tiene control limitado. Solo puede gestionar los usuarios VPN del servidor VPS que el dueño le ha asignado. No puede ver las credenciales de los servidores ni a otros managers.

> **IMPORTANTE:** Esta versión está configurada para una **instalación integrada**, lo que significa que el panel se ejecuta en su propio servidor y gestiona los servidores ZiVPN de forma remota a través de SSH. La funcionalidad de gestión local ha sido eliminada para dar paso a la arquitectura multi-servidor.

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

## 🚀 Instalación y Despliegue

Este panel está diseñado para ser desplegado en un servicio de hosting (como Vercel, Firebase App Hosting, o tu propio VPS) y gestionar tus servidores `zivpn` remotamente.

### 1. Despliega el Panel

1.  **Haz un "Fork"** de este repositorio en tu cuenta de GitHub.
2.  **Conecta tu repositorio a un servicio de hosting** (ej. Vercel, Netlify, Firebase). La plataforma debería detectar que es un proyecto Next.js y desplegarlo automáticamente.

### 2. Accede y Configura

1.  **Visita la URL** que te proporcionó tu servicio de hosting (ej. `https://mi-panel.vercel.app`).
2.  **Inicia sesión** con las credenciales por defecto:
    - **Usuario:** `admin`
    - **Contraseña:** `password`
    > **Recomendación**: Cambia la contraseña del dueño inmediatamente después de iniciar sesión por primera vez.
3.  **Ve a la pestaña "Servidores"**:
    - Añade tu primer servidor VPS introduciendo su IP, puerto SSH, usuario y contraseña. El panel verificará la conexión antes de guardarlo.
4.  **Ve a la pestaña "Managers" (Opcional)**:
    - Si quieres delegar, crea cuentas de manager y asígnales uno de los servidores que acabas de configurar.

### 3. Permisos en los Servidores ZiVPN Remotos

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

¡Y listo! Tu panel "Multi-Manager" está configurado para gestionar todos tus servidores.

---

## 💻 Desarrollo Local

1.  **Clona el proyecto e instala dependencias**:
    ```bash
    git clone https://github.com/sysdevcheck/UdpPanelWeb.git
    cd UdpPanelWeb
    npm install
    ```
2.  **Ejecuta el servidor de desarrollo**:
    ```bash
    npm run dev
    ```
    La aplicación estará disponible en `http://localhost:9002`.

---

## 🚑 Resolución de Problemas

### Error de Conexión al Añadir un Servidor

-   **"Authentication failed"**: Revisa el nombre de usuario y la contraseña del VPS.
-   **"Connection timed out"**:
    -   Verifica que la IP del servidor es correcta.
    -   Asegúrate de que el puerto SSH (usualmente 22) está abierto en el firewall del VPS.
-   **"Host not found"**: El nombre de host o la IP no se pudo resolver. Comprueba que está bien escrito.

### Las Acciones (Añadir Usuario, Reiniciar) Fallan

-   **Revisa los permisos `sudoers`**: Es la causa más común. Asegúrate de que el usuario SSH tiene permiso para ejecutar `systemctl restart zivpn` sin contraseña en el servidor remoto (ver paso 3 de la instalación).
-   **Consulta los logs del servidor del panel**: Si lo has desplegado en Vercel o similar, revisa los logs en tiempo real de la función que maneja la API SSH (`/api/ssh`) para ver errores detallados.
