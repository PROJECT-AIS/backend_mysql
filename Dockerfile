FROM node:22

WORKDIR /app

# Salin package.json dan package-lock.json terlebih dahulu
COPY package*.json ./

# Install SEMUA dependensi (termasuk devDependencies seperti 'prisma')
RUN npm ci

COPY . .

# Sekarang jalankan 'prisma generate' SETELAH semua file ada
RUN npx prisma generate

EXPOSE 3000

CMD ["node", "index.js"]
