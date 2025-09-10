type SandboxStatus = {
  type: "sb:status";
  data: {
    status: "starting" | "started" | "exited" | "error";
  };
};

type DevServerPreviewAvailable = {
  type: "ds:preview-available";
  data: {
    url: string;
  };
};

type DevServerLog = {
  type: "ds:log";
  data: {
    stream: "stdout" | "stderr";
    message: string;
    ts: number;
  };
};

export type WSEvent = SandboxStatus | DevServerPreviewAvailable | DevServerLog;
