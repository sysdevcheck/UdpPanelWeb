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

## Cómo Funciona

La aplicación interactúa con dos archivos de configuración principales en el servidor donde se despliega:

1.  `/etc/zivpn/managers.json`: Almacena las credenciales (usuario y contraseña) de los managers que pueden iniciar sesión en este panel. **Debes crear y gestionar este archivo manualmente.**
2.  `/etc/zivpn/config.json`: Almacena la configuración de los usuarios finales de la VPN. La aplicación gestiona este archivo automáticamente.

### Estructura de `managers.json`

Este archivo es un array de objetos. Debes crearlo manualmente en tu VPS.

```json
[
  {
    "username": "manager1",
    "password": "una_contraseña_segura"
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

### 1. Prerrequisitos

Asegúrate de tener Node.js (v20+) y npm instalados en tu VPS.

### 2. Clona el Proyecto

Clona este repositorio en tu VPS.

```bash
git clone [URL_DE_TU_REPOSITORIO_GIT]
cd [DIRECTORIO_DEL_PROYECTO]
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
sudo chown -R tu_usuario:tu_usuario /etc/zivpn
```

**MUY IMPORTANTE: Crea el archivo de managers.**

```bash
# Crea y abre el archivo para editarlo
sudo nano /etc/zivpn/managers.json
```

Pega la estructura JSON mencionada arriba con tus managers y contraseñas. Guarda y cierra el archivo.

### 5. Permisos de Sudo para Reiniciar el Servicio

Para que la aplicación pueda reiniciar `zivpn`, el usuario que ejecuta la aplicación necesita permisos para ejecutar `systemctl` sin contraseña.

Abre el archivo de sudoers: `sudo visudo`
Agrega la siguiente línea al final, reemplazando `tu_usuario`:
```
tu_usuario ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart zivpn
```

### 6. Construye y Ejecuta la Aplicación

```bash
# Construye la aplicación para producción
npm run build

# Inicia el servidor
npm start
```

Por defecto, la aplicación se ejecutará en el puerto 9002.

### 7. (Recomendado) Mantenla en Funcionamiento con PM2

Para que el panel permanezca en línea, usa un gestor de procesos como `pm2`.

```bash
# Instala pm2 globalmente
sudo npm install -g pm2

# Inicia la aplicación con pm2
pm2 start npm --name "zivpn-panel" -- start

# Guarda la configuración para que se reinicie con el servidor
pm2 save
```
