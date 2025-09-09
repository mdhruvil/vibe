import type { CustomUIMessage, TodoInfo } from "@vibe/server";
import {
  CircleCheck,
  CircleDashedIcon,
  CircleDotIcon,
  CirclePlusIcon,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { Response } from "./response";
import { getStatusIcon } from "./tool";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";

type Props = {
  part: CustomUIMessage["parts"][number];
};

const bashLabels = {
  "input-streaming": "Executing",
  "input-available": "Executing",
  "output-available": "Executed",
  "output-error": "Error running",
} as const;

const readLabels = {
  "input-streaming": "Reading",
  "input-available": "Reading",
  "output-available": "Read",
  "output-error": "Error reading",
} as const;

const editLabels = {
  "input-streaming": "Editing",
  "input-available": "Editing",
  "output-available": "Edited",
  "output-error": "Error editing",
} as const;

const webFetchLabels = {
  "input-streaming": "Fetching",
  "input-available": "Fetching",
  "output-available": "Fetched",
  "output-error": "Error fetching",
} as const;

function formatFilePath(filePath: string | undefined) {
  return filePath?.replace("/workspace/", "") ?? "Unknown File";
}

export function AppMessagePart({ part }: Props) {
  if (part.type === "text") {
    return <Response className="my-2">{part.text}</Response>;
  }

  if (part.type === "tool-todowrite") {
    return <TodoTool todos={part.output?.todos ?? []} />;
  }

  if (!part.type.startsWith("tool-") || part.type === "tool-todoread") {
    return null;
  }

  let text = "";
  let status:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error" = "input-streaming";

  if (part.type === "tool-bash") {
    const state = bashLabels[part.state];
    text = [state, "`", part.input?.command ?? "Unknown Command", "`"].join(
      " "
    );
    status = part.state;
  } else if (part.type === "tool-read") {
    const state = readLabels[part.state];
    text = [
      state,
      "`",
      formatFilePath(part.input?.filePath) ?? "Unknown File",
      "`",
    ].join(" ");
    status = part.state;
  } else if (part.type === "tool-edit") {
    const state = editLabels[part.state];
    text = [
      state,
      "`",
      formatFilePath(part.input?.filePath) ?? "Unknown File",
      "`",
    ].join(" ");
    status = part.state;
  } else if (part.type === "tool-webfetch") {
    const state = webFetchLabels[part.state];
    text = [state, "`", part.input?.url ?? "Unknown URL", "`"].join(" ");
    status = part.state;
  }

  return (
    <div className="my-1 flex items-center gap-2">
      {getStatusIcon(status)}
      <span className="line-clamp-1 text-left font-medium text-sm">
        <Streamdown>{text}</Streamdown>
      </span>
    </div>
  );
}

type TodoToolProps = {
  todos: TodoInfo[];
};

function TodoIcon({ status }: { status: TodoInfo["status"] }) {
  const commonClasses = "size-4 shrink-0 mt-1";
  if (status === "completed") {
    return <CircleCheck className={`${commonClasses} text-green-600`} />;
  }
  if (status === "in_progress") {
    return <CircleDotIcon className={`${commonClasses} text-ring`} />;
  }
  if (status === "pending") {
    return <CircleDashedIcon className={`${commonClasses}`} />;
  }
  if (status === "cancelled") {
    return <CirclePlusIcon className={`${commonClasses} rotate-45`} />;
  }
}

function TodoTool({ todos }: TodoToolProps) {
  return (
    <Accordion
      className="my-2 w-full rounded-md bg-card text-card-foreground"
      collapsible
      type="single"
    >
      <AccordionItem
        className="rounded-md border px-4 py-1 outline-none last:border-b has-focus-visible:border-ring has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50"
        value="tasks"
      >
        <AccordionTrigger className="[&>svg]:-rotate-90 items-center py-0.5 text-[15px] leading-6 hover:no-underline focus-visible:ring-0 [&>svg]:translate-y-0 [&[data-state=open]>svg]:rotate-0">
          Updated Tasks
        </AccordionTrigger>
        <AccordionContent className="space-y-3 py-4 text-muted-foreground">
          {todos.map((todo) => (
            <div className="flex gap-2" key={todo.id}>
              <TodoIcon status={todo.status} />
              <div>{todo.content}</div>
            </div>
          ))}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
