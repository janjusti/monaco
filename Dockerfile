FROM node:18
ARG NEXT_PUBLIC_WS_URL
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --modules-folder /opt/node_modules
COPY . .
ENV NODE_PATH=/opt/node_modules
RUN npm install -g --force nodemon
CMD ["yarn", "dev"]