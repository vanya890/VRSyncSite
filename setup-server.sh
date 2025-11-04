#!/bin/bash

# Обновление системы
echo "Обновление системы..."
apt update && apt upgrade -y

# Установка Node.js 18 (LTS)
echo "Установка Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Установка Git
echo "Установка Git..."
apt install -y git

# Клонирование репозитория
echo "Клонирование репозитория..."
git clone https://github.com/vanya890/VRSyncSite.git
cd VRSyncSite

# Установка зависимостей
echo "Установка зависимостей..."
npm install

# Создание директорий
echo "Создание директорий..."
mkdir -p assets/videos

# Настройка файрвола
echo "Настройка файрвола..."
ufw allow 3000
ufw --force enable

# Установка PM2
echo "Установка PM2..."
npm install -g pm2

# Запуск приложения через PM2
echo "Запуск приложения..."
pm2 start server.js --name "vr-site"
pm2 startup
pm2 save

echo "Настройка завершена!"
echo "Сайт доступен по адресу: http://91.229.11.241:3000"
echo "Админ-панель: http://91.229.11.241:3000/admin/login"
