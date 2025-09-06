FROM docker.io/cloudflare/sandbox:0.3.1

WORKDIR /workspace

RUN git clone --depth=1 https://github.com/mdhruvil/react-starter .
RUN bun install

EXPOSE 3000
EXPOSE 5173

# set working dir to support CMD of the original image
WORKDIR /container-server 