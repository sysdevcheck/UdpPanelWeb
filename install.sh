#!/bin/bash

# ==============================================================================
# Script de Instalación para el Panel Multi-Manager de ZiVPN
# ==============================================================================
#
# Este script automatiza la instalación completa del panel en un servidor
# Ubuntu 22.04 o superior.
#
# Uso:
# 1. Descargar: curl -o install.sh https://raw.githubusercontent.com/sysdevcheck/UdpPanelWeb/main/install.sh
# 2. Dar permisos: chmod +x install.sh
# 3. Ejecutar: ./install.sh
#
# ==============================================================================

# Colores para la salida
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# URL del Repositorio de GitHub
REPO_URL="https://github.com/sysdevcheck/UdpPanelWeb.git"
PROJECT_DIR="UdpPanelWeb"

# Función para imprimir mensajes informativos
info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Función para imprimir mensajes de éxito
success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
}

# Función para imprimir advertencias
warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Detener el script si ocurre un error
set -e

info "Iniciando la instalación del Panel ZiVPN Multi-Manager..."

# 1. ACTUALIZAR EL SISTEMA E INSTALAR PRERREQUISITOS
info "Paso 1: Actualizando el sistema e instalando 'git', 'curl' y 'build-essential'..."
sudo apt-get update
sudo apt-get install -y git curl build-essential
success "Paso 1 completado: Sistema actualizado y prerrequisitos instalados."

# 2. INSTALAR NODE.JS USANDO NVM (NODE VERSION MANAGER)
info "Paso 2: Instalando Node.js v20 usando NVM..."
if [ -d "$HOME/.nvm" ]; then
    info "NVM ya está instalado."
else
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi

# Cargar NVM en la sesión actual
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Instalar y usar Node.js 20
nvm install 20
nvm use 20
nvm alias default 20
success "Paso 2 completado: Node.js v$(node -v) y npm v$(npm -v) instalados."

# 3. CLONAR EL REPOSITORIO
info "Paso 3: Clonando el proyecto desde GitHub..."
if [ -d "$PROJECT_DIR" ]; then
    warn "El directorio '$PROJECT_DIR' ya existe. Saltando clonación."
else
    git clone "$REPO_URL"
fi
cd "$PROJECT_DIR"
success "Paso 3 completado: Proyecto clonado en el directorio '$PROJECT_DIR'."

# 4. INSTALAR DEPENDENCIAS DEL PROYECTO
info "Paso 4: Instalando dependencias del proyecto con npm..."
npm install
success "Paso 4 completado: Dependencias del proyecto instaladas."

# 5. CONFIGURAR VARIABLES DE ENTORNO (.env.local)
info "Paso 5: Configurando las variables de entorno..."
if [ -f ".env.local" ]; then
    warn "El archivo '.env.local' ya existe. No se realizarán cambios."
else
    echo "Por favor, introduce las credenciales para el usuario Dueño (Owner):"
    read -p "Nombre de usuario para el Dueño [admin]: " owner_username
    OWNER_USERNAME=${owner_username:-admin}

    read -s -p "Contraseña para el Dueño: " owner_password
    echo
    while [ -z "$owner_password" ]; do
        read -s -p "La contraseña no puede estar vacía. Por favor, introduce una contraseña: " owner_password
        echo
    done

    # Crear el archivo .env.local
    cat > .env.local << EOF
# Credenciales del usuario Dueño (Owner)
OWNER_USERNAME=${OWNER_USERNAME}
OWNER_PASSWORD=${owner_password}

# URL base donde se ejecutará el panel.
# Usamos localhost:9002 por defecto, ya que se ejecuta en el mismo VPS.
NEXT_PUBLIC_BASE_URL=http://localhost:9002
EOF
    success "Archivo '.env.local' creado con éxito."
fi
success "Paso 5 completado: Variables de entorno configuradas."

# 6. CREAR ARCHIVO DE INTERCAMBIO (SWAP) PARA EVITAR ERRORES DE MEMORIA
info "Paso 6: Creando archivo de intercambio (swap) para asegurar memoria suficiente..."
if [ -f /swapfile ]; then
    warn "El archivo de intercambio '/swapfile' ya existe. Saltando creación."
else
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    # Hacer el swap permanente
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    success "Archivo de intercambio de 2GB creado y activado."
fi
success "Paso 6 completado: Memoria de intercambio configurada."

# 7. COMPILAR LA APLICACIÓN
info "Paso 7: Compilando la aplicación para producción (esto puede tardar varios minutos)..."
npm run build
success "Paso 7 completado: Aplicación compilada."

# 8. INSTALAR PM2 Y CONFIGURAR LA APLICACIÓN
info "Paso 8: Instalando PM2 y configurando el servicio..."
sudo npm install pm2 -g
success "PM2 instalado globalmente."

info "Iniciando la aplicación con PM2..."
# Eliminar cualquier instancia anterior con el mismo nombre para evitar conflictos
pm2 delete zivpn-panel || true

# Inicia la aplicación con PM2. El puerto 9002 está definido en package.json
pm2 start npm --name "zivpn-panel" -- start
success "La aplicación ha sido iniciada con PM2 bajo el nombre 'zivpn-panel'."

info "Configurando PM2 para que se inicie al arrancar el sistema..."
pm2 startup | sudo bash -
pm2 save
success "Paso 8 completado: PM2 configurado para arrancar con el sistema."

# 9. MENSAJE FINAL
echo
success "¡Instalación completada!"
echo
info "Tu panel ZiVPN Multi-Manager ya está corriendo."
info "Puedes acceder a él en: http://<IP_DE_TU_VPS>:9002"
echo
info "Comandos útiles de PM2:"
echo -e "  - ${YELLOW}pm2 logs zivpn-panel${NC} : Para ver los registros en tiempo real."
echo -e "  - ${YELLOW}pm2 restart zivpn-panel${NC} : Para reiniciar la aplicación."
echo -e "  - ${YELLOW}pm2 list${NC} : Para ver el estado de la aplicación."
echo
info "Recuerda configurar los permisos 'sudoers' en tus servidores ZiVPN remotos como se indica en el README."
echo

    