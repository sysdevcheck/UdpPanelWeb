# User Management Panel for ZiVPN

This is a Next.js web application that provides a user-friendly interface to manage users for a ZiVPN service. Instead of manually editing the configuration file on your server, you can use this panel to add, edit, delete, and renew users.

## Features

- **User Management**: Easily add, edit, and delete users from the configuration.
- **Automatic Expiration**: Users are created with a 30-day lifetime. Expired users are automatically removed from the configuration file.
- **User Renewal**: Renew a user's access for another 30 days with a single click.
- **Status Indicators**: Users are visually tagged as "Active", "Expiring" (within 7 days), or "Expired".
- **Filtering**: Filter the user list by their status to quickly find who you're looking for.
- **Pagination**: The user list is paginated to ensure the interface remains fast and easy to navigate, even with many users.

## How It Works

The application reads and writes to a local JSON configuration file located at `/etc/zivpn/config.json` on the server where it's running. It does **not** use SSH. The panel must be deployed on the same VPS as your VPN service.

The user objects in the configuration file are structured as follows:

```json
{
  "username": "testuser",
  "createdAt": "2023-10-27T10:00:00.000Z",
  "expiresAt": "2023-11-26T10:00:00.000Z"
}
```

## Setup and Deployment on Your VPS

Follow these steps to get the user management panel running on your server.

### 1. Prerequisites

Make sure you have Node.js and npm installed on your VPS.

```bash
# Example for Debian/Ubuntu
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Clone the Project

Clone this repository to a location on your VPS.

```bash
git clone [URL_OF_YOUR_GIT_REPOSITORY]
cd [PROJECT_DIRECTORY]
```

### 3. Install Dependencies

Install the necessary Node.js packages.

```bash
npm install
```

### 4. Set File Permissions

The application needs permission to write to the `/etc/zivpn/` directory.

First, create the directory if it doesn't exist. Then, assign ownership to the user you will use to run the application (replace `your_user` with your actual username).

```bash
sudo mkdir -p /etc/zivpn
sudo chown -R your_user:your_user /etc/zivpn
```

### 5. Build the Application

Create an optimized production build of the Next.js app.

```bash
npm run build
```

### 6. Run the Application

Start the application server.

```bash
npm start
```

By default, the application will run on port 9002. You can access it in your browser at `http://<YOUR_VPS_IP>:9002`.

### 7. (Recommended) Keep it Running with PM2

To ensure the panel stays online even after you close your terminal, use a process manager like `pm2`.

```bash
# Install pm2 globally
sudo npm install -g pm2

# Start the application with pm2
pm2 start npm --name "zivpn-panel" -- start

# (Optional) Check the status of your app
pm2 list

# (Optional) View logs
pm2 logs zivpn-panel
```
