FROM ghcr.io/mdhruvil/sandbox:0.3.1

WORKDIR /workspace

RUN git clone --depth=1 https://github.com/mdhruvil/react-starter .
RUN bun install

EXPOSE 3000
EXPOSE 5173

RUN mkdir -p /publisher
WORKDIR /publisher

RUN bun init --yes
RUN bun add node-appwrite
COPY ./src/publisher.ts .

# set working dir to support CMD of the original image
WORKDIR /container-server 