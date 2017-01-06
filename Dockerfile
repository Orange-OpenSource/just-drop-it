FROM node:6

# Create app directory
RUN mkdir -p /opt/app-root/src
WORKDIR /opt/app-root/src


# Install app dependencies
COPY package.json /opt/app-root/src
RUN npm install

# Bundle app source
COPY . /opt/app-root/src

EXPOSE 8080
CMD [ "npm", "start" ]

