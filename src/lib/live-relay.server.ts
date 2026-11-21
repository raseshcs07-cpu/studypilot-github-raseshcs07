import process from "node:process";

import {
  connectLive,
  streamResponse,
  type LiveCommand,
  type LiveEvent,
  type LiveModel,
  type ResponsesInputItem,
  type ResponsesRequest,
  type ResponsesResponse,
} from "@lovable.dev/ai-gateway";

export type LiveConfig = {
  key: string;
  liveModel: LiveModel;
  backendModel: ResponsesRequest["model"];
  openingInstructions?: string;
};

// Fill the literal model slugs from co-loaded knowledge before typechecking.
const liveSettings = { liveModel: "", backendModel: "" } as const;

export type LiveSocket = {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onMessage(handler: (data: unknown) => void): void;
  onClose(handler: () => void): void;
  onError(handler: () => void): void;
};

export type LiveExecutionContext = { waitUntil(task: Promise<unknown>): void };

type WorkerSocket = WebSocket & { accept(): void };
declare const WebSocketPair: { new (): { 0: WorkerSocket; 1: WorkerSocket } };
type Transcript = {
  role: "user" | "assistant";
  text: string;
  start_ms: number;
  end_ms: number;
  listeningSound: boolean;
};
type ProviderEvent = LiveEvent<LiveConfig["liveModel"]>;
type DelegationEvent = Extract<ProviderEvent, { type: "session.delegation.created" }>;
type VoiceSession = Awaited<ReturnType<typeof connectLive>>;

export function getLiveConfig(): LiveConfig {
  const config: LiveConfig = {
    ...liveSettings,
    key: process.env["LOVABLE_API_KEY"] ?? "",
  };
  if ([config.key, config.liveModel, config.backendModel].some((value) => !value)) {
    throw new Error("Missing Live relay configuration");
  }
  return config;
}

export function validateLiveUpgrade(request: Request, options: { allowMissingOrigin?: boolean } = {}): Response | null {
  const origin = request.headers.get("origin");
  if (origin === null ? !options.allowMissingOrigin : origin !== new URL(request.url).origin) {
    return new Response("Voice connection origin rejected", { status: 403 });
  }
  if (request.method !== "GET" || request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return new Response("WebSocket required", { status: 426 });
  }
  return null;
}

function workerSocket(socket: WorkerSocket): LiveSocket {
  return {
    get readyState() {
      return socket.readyState;
    },
    send: (data) => socket.send(data),
    close: (code, reason) => socket.close(code, reason),
    onMessage: (handler) => socket.addEventListener("message", (event) => handler(event.data)),
    onClose: (handler) => socket.addEventListener("close", handler),
    onError: (handler) => socket.addEventListener("error", handler),
  };
}

export function handleLiveRequest(request: Request): Response {
  const waitUntil = (request as Request & Partial<LiveExecutionContext>).waitUntil;
  if (!waitUntil) return new Response("Live runtime unavailable", { status: 503 });
  const config = getLiveConfig();
  const rejected = validateLiveUpgrade(request);
  if (rejected) return rejected;
  const pair = new WebSocketPair();
  pair[1].accept();
  bindLiveConnection(workerSocket(pair[1]), config, { waitUntil });
  const response: ResponseInit & { webSocket: WebSocket } = { status: 101, webSocket: pair[0] };
  return new Response(null, response);
}

const conversationInstructions = `You are Mira, a calm learning companion.
Speak naturally in brief replies. Ask a focused question when details are unclear.
Backchannel policy: Use moderate listening sounds without taking over.
Interruption policy: Stop your answer and listen when the user interrupts.
Delegation policy:
Backend tools: Reason through questions and plan study sessions across days.
Delegate to the backend when: The user wants a study schedule or careful reasoning,
or a correction changes a question already being worked on.
Do not delegate to the backend when: Greeting, clarifying a question, or repeating
a still-current answer. Wait for the backend result before presenting its answer.`;

type StudyScheduleInput = { total_minutes: number; days: number };

function planStudySchedule(args: StudyScheduleInput) {
  const daily = Math.floor(args.total_minutes / args.days);
  return {
    total_minutes: args.total_minutes,
    days: args.days,
    sessions: Array.from({ length: args.days }, (_, index) => ({
      day: index + 1,
      minutes: daily + (index < args.total_minutes % args.days ? 1 : 0),
    })),
  };
}

function studyScheduleArguments(value: unknown): StudyScheduleInput {
  if (
    !value ||
    typeof value !== "object" ||
    !("total_minutes" in value) ||
    !("days" in value) ||
    typeof value.total_minutes !== "number" ||
    !Number.isSafeInteger(value.total_minutes) ||
    value.total_minutes < 1 ||
    value.total_minutes > 10_080 ||
    typeof value.days !== "number" ||
    !Number.isSafeInteger(value.days) ||
    value.days < 1 ||
    value.days > 30 ||
    Object.keys(value).some((key) => key !== "total_minutes" && key !== "days")
  ) {
    throw new Error("Invalid study schedule arguments");
  }
  return { total_minutes: value.total_minutes, days: value.days };
}

function isListeningSound(text: string) {
  const normalized = text.toLowerCase().replace(/[\s\p{Pd}]/gu, "");
  return /^(?:m+hm+|uhhuh)[.,!]*$/.test(normalized);
}

async function answerQuestion(
  messages: ResponsesInputItem[],
  config: LiveConfig,
  correlation: { runID: string; sessionID: string; delegationID: string },
  signal: AbortSignal,
  consumeInput: () => void,
  onPlan: (plan: ReturnType<typeof planStudySchedule>) => void,
) {
  for (let step = 0; step < 50; step++) {
    signal.throwIfAborted();
    consumeInput();
    const stream = await streamResponse(
      {
        model: config.backendModel,
        input: messages,
        instructions:
          "Help a spoken learning companion answer the latest user question. " +
          "Transcripts may be incomplete or corrected. Use the latest correction. " +
          "Continue from completed tool results; do not repeat completed actions. " +
          "Return verified facts and useful next steps in at most 150 words. " +
          "To display a study schedule, call plan_study_schedule with its total minutes and days. " +
          "Ask for missing details. The tool only calculates a draft; it does not save calendar events.",
        ...(!["openai/chat-latest"].includes(config.backendModel)
          ? {
              reasoning: { effort: "medium", summary: "auto" },
              include: ["reasoning.encrypted_content"],
            }
          : {}),
        tools: [
          {
            type: "function",
            name: "plan_study_schedule",
            description: "Distribute study time across days and return a draft schedule.",
            parameters: {
              type: "object",
              properties: {
                total_minutes: { type: "integer", minimum: 1, maximum: 10_080 },
                days: { type: "integer", minimum: 1, maximum: 30 },
              },
              required: ["total_minutes", "days"],
              additionalProperties: false,
            },
            strict: true,
          },
        ],
      },
      {
        apiKey: config.key,
        signal,
        maxRetries: 0,
        runId: correlation.runID,
        metadata: { live_session_id: correlation.sessionID, delegation_id: correlation.delegationID },
      },
    );
    let completed: ResponsesResponse | undefined;
    let incomplete = false;
    // Drain through HTTP EOF so successful work is not recorded as cancelled by the Gateway.
    for await (const event of stream) {
      if (event.type === "response.completed") completed = event.response;
      if (event.type === "response.incomplete") incomplete = true;
    }
    signal.throwIfAborted();
    if (incomplete || !completed || completed.status !== "completed")
      throw new Error("The backend response did not complete");
    for (const item of completed.output) {
      if (item.type !== "message" && item.type !== "reasoning" && item.type !== "function_call")
        throw new Error("Unsupported backend output; adapt native history for the selected tools");
      messages.push(item);
    }
    const calls = completed.output.filter((item) => item.type === "function_call");
    if (!calls.length) {
      const answer = completed.output
        .flatMap((item) =>
          item.type === "message"
            ? item.content.flatMap((part) => (part.type === "output_text" ? [part.text] : []))
            : [],
        )
        .join("\n");
      if (!answer.trim()) throw new Error("The backend response had no answer");
      return answer;
    }
    for (const call of calls) {
      signal.throwIfAborted();
      if (call.name !== "plan_study_schedule") throw new Error("Unsupported backend tool");
      const plan = planStudySchedule(studyScheduleArguments(JSON.parse(call.arguments)));
      onPlan(plan);
      messages.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(plan) });
    }
  }
  throw new Error("The backend task exceeded its step limit");
}

function* commentaryChunks(content: string) {
  const encoder = new TextEncoder();
  let chunk = "";
  let bytes = 0;
  for (const [word] of content.matchAll(/\S+\s*|\s+/gu)) {
    // Chunks stay well inside the provider's per-append size limit.
    if (chunk && bytes + encoder.encode(word).length > 480) {
      yield chunk;
      chunk = "";
      bytes = 0;
    }
    for (const character of word) {
      const size = encoder.encode(character).length;
      if (bytes + size > 480) {
        yield chunk;
        chunk = "";
        bytes = 0;
      }
      chunk += character;
      bytes += size;
    }
  }
  if (chunk) yield chunk;
}

export function bindLiveConnection(
  browser: LiveSocket,
  configuration: LiveConfig,
  execution: LiveExecutionContext,
): void {
  const config = { ...configuration };
  const runID = crypto.randomUUID();
  const setupAbort = new AbortController();
  let gateway: VoiceSession | undefined;
  let sessionID: string | undefined;
  let starting = false;
  let closing = false;
  let finished = false;
  let revision = 0;
  let task: AbortController | undefined;
  const pendingDelegations: Array<{
    event: DelegationEvent;
    plan?: ReturnType<typeof planStudySchedule>;
  }> = [];
  let completedDelegation: (typeof pendingDelegations)[number] | undefined;
  const backendMessages: ResponsesInputItem[] = [];
  let transcriptCursor = 0;
  let restartTimer: ReturnType<typeof setTimeout> | undefined;
  let browserReady = false;
  let greetingRequested = false;
  let greetingCommand: { id: string; type: "instructions" | "commentary" } | undefined;
  let greetingTimer: ReturnType<typeof setTimeout> | undefined;
  const startTimer = setTimeout(() => {
    emit({ type: "app.error", error: { message: "Voice startup message timed out" } });
    stop();
  }, 5000);
  const transcripts: Transcript[] = [];
  const delegations = new Set<string>();

  function emit(event: object) {
    if (browser.readyState !== 1) return;
    try {
      browser.send(JSON.stringify(event));
    } catch {
      stop();
    }
  }

  function close(socket?: LiveSocket) {
    if (!socket || socket.readyState === 3) return;
    try {
      socket.close(1000, "Call ended");
    } catch {
      return;
    }
  }

  function clearGreeting() {
    clearTimeout(greetingTimer);
    greetingCommand = undefined;
  }

  function requestGreeting() {
    const content = (
      config.openingInstructions ??
      "Start the conversation now in your configured language and role. Give a brief greeting suited to this app's purpose, ask one relevant opening question, then listen."
    ).trim();
    if (!content || !browserReady || !sessionID || greetingRequested || closing) return;
    greetingRequested = true;
    if (new TextEncoder().encode(content).length > 480) {
      emit({ type: "app.greeting.error", error: { message: "The opening instructions are too long" } });
      return;
    }
    greetingCommand = { id: crypto.randomUUID(), type: "instructions" };
    greetingTimer = setTimeout(() => {
      clearGreeting();
      emit({ type: "app.greeting.error", error: { message: "The opening could not be confirmed" } });
    }, 10_000);
    sendGateway({
      type: "session.instructions.append",
      event_id: greetingCommand.id,
      delegation_id: null,
      content,
    });
  }

  function discardPendingWork() {
    pendingDelegations.length = 0;
    completedDelegation = undefined;
    clearTimeout(restartTimer);
    task?.abort();
  }

  function finish() {
    if (finished) return;
    finished = closing = true;
    clearTimeout(startTimer);
    clearTimeout(restartTimer);
    clearGreeting();
    discardPendingWork();
    setupAbort.abort();
    if (gateway) execution.waitUntil(gateway.close());
    close(browser);
  }

  function stop() {
    if (closing) return;
    closing = true;
    discardPendingWork();
    clearTimeout(startTimer);
    clearGreeting();
    if (gateway) execution.waitUntil(gateway.close());
    else finish();
  }

  function sendGateway(event: LiveCommand<LiveConfig["liveModel"]>) {
    if (!gateway || closing) return;
    execution.waitUntil(
      gateway.send(event).catch(() => {
        emit({ type: "app.error", error: { message: "Voice command could not be sent" } });
        stop();
      }),
    );
  }

  function scheduleDelegation() {
    clearTimeout(restartTimer);
    if (closing || task || pendingDelegations.length === 0) return;
    restartTimer = setTimeout(() => void runDelegation(), 300);
  }

  function deliverResult(delegationID: string, answer: string, plan?: ReturnType<typeof planStudySchedule>) {
    if (closing) return;
    if (!gateway) return stop();
    try {
      for (const content of commentaryChunks(answer)) {
        sendGateway({
          type: "session.commentary.append",
          event_id: crypto.randomUUID(),
          delegation_id: delegationID,
          content,
        });
      }
      if (plan) emit({ type: "app.study_schedule.plan", delegation_id: delegationID, plan });
      completedDelegation = pendingDelegations.shift();
    } catch {
      stop();
    }
  }

  async function runDelegation() {
    const pending = pendingDelegations[0];
    const event = pending?.event;
    const id = event?.delegation?.id;
    if (!pending || !event || !id || !sessionID || closing || task) return;
    if (!transcripts.some(({ role, text }) => role === "user" && text.trim())) return;
    const controller = new AbortController();
    task = controller;
    let taskRevision = revision;
    try {
      const answer = await answerQuestion(
        backendMessages,
        config,
        { runID, sessionID, delegationID: id },
        controller.signal,
        () => {
          const updates = transcripts.slice(transcriptCursor);
          if (updates.some(({ role, listeningSound }) => role === "user" && !listeningSound)) delete pending.plan;
          backendMessages.push(...updates.map(({ role, text }) => ({ role, content: text })));
          transcriptCursor = transcripts.length;
          taskRevision = revision;
        },
        (plan) => {
          pending.plan = plan;
        },
      );
      if (closing || controller.signal.aborted) return;
      if (taskRevision !== revision) return;
      deliverResult(id, answer.trim(), pending.plan);
    } catch {
      if (closing || controller.signal.aborted) return;
      backendMessages.push({
        role: "assistant",
        content:
          "The backend attempt failed. Completed tool results remain valid; verify uncertain external actions before any retry.",
      });
      if (taskRevision !== revision) return;
      deliverResult(id, "The backend could not finish the answer. Ask whether the user wants to try again.");
    } finally {
      if (task === controller) task = undefined;
      scheduleDelegation();
    }
  }

  function queueDelegation(event: DelegationEvent) {
    pendingDelegations.push({ event });
    emit({ type: "app.delegation.pending", delegation_id: event.delegation?.id });
    scheduleDelegation();
  }

  function receiveGateway(event: ProviderEvent) {
    try {
      if (browser.readyState === 1) browser.send(JSON.stringify(event));
      if (event.type === "session.closed") return finish();
      if (event.type === "gateway.session.closing" || event.type === "gateway.error") {
        return stop();
      }
      if (closing) return;
      if (event.type === "gateway.session.created") {
        sessionID = event.session?.id;
        requestGreeting();
      }
      if (
        greetingCommand &&
        event.type === `session.${greetingCommand.type}.appended` &&
        "client_event_id" in event &&
        event.client_event_id === greetingCommand.id
      ) {
        if (greetingCommand.type === "instructions") {
          greetingCommand = { id: crypto.randomUUID(), type: "commentary" };
          sendGateway({
            type: "session.commentary.append",
            event_id: greetingCommand.id,
            delegation_id: null,
            content: "Begin the conversation now, following the instructions provided.",
          });
        } else {
          clearGreeting();
          emit({ type: "app.greeting.accepted" });
        }
      } else if (greetingCommand && event.type === "error" && event.error?.client_event_id === greetingCommand.id) {
        clearGreeting();
        emit({ type: "app.greeting.error", error: { message: event.error.message ?? "The opening was rejected" } });
      }
      if (event.type === "session.input_transcript.delta" || event.type === "session.output_transcript.delta") {
        const role = event.type === "session.input_transcript.delta" ? "user" : "assistant";
        if (!event.delta?.trim()) return;
        const listeningSound = role === "user" && Boolean(task) && isListeningSound(event.delta);
        transcripts.push({
          role,
          text: event.delta,
          start_ms: event.start_ms ?? 0,
          end_ms: event.end_ms ?? 0,
          listeningSound,
        });
        if (listeningSound) return;
        if (role === "user") {
          revision++;
          const offset = completedDelegation?.event.offset_ms;
          // Live has no transcript watermark; completed handoffs can receive late context.
          if (
            pendingDelegations.length === 0 &&
            completedDelegation &&
            typeof offset === "number" &&
            Number.isFinite(offset) &&
            offset >= 0 &&
            typeof event.start_ms === "number" &&
            Number.isFinite(event.start_ms) &&
            event.start_ms >= 0 &&
            event.start_ms <= offset
          ) {
            pendingDelegations.push(completedDelegation);
            completedDelegation = undefined;
          }
          if (pendingDelegations.length) {
            emit({ type: "app.delegation.pending", delegation_id: pendingDelegations[0]?.event.delegation?.id });
          }
        }
        scheduleDelegation();
      } else if (event.type === "session.delegation.created") {
        const id = event.delegation?.id;
        if (id && event.delegation?.target === "client" && !delegations.has(id)) {
          delegations.add(id);
          queueDelegation(event);
        }
      }
    } catch {
      emit({ type: "app.error", error: { message: "Invalid voice event or lost connection" } });
      stop();
    }
  }

  async function startSession(sdp: string) {
    if (closing || browser.readyState !== 1) return;
    clearTimeout(startTimer);
    const accepted = await connectLive(
      {
        type: "session.start",
        session: {
          model: config.liveModel,
          instructions: conversationInstructions,
          audio: { output: { voice: "marin" } },
          delegation: { type: "client" },
        },
        transport: { type: "webrtc", sdp },
      },
      { apiKey: config.key, signal: setupAbort.signal, runId: runID },
    );
    if (closing || browser.readyState !== 1) {
      execution.waitUntil(accepted.close());
      return;
    }
    gateway = accepted;
    execution.waitUntil(
      (async () => {
        try {
          for await (const event of accepted) receiveGateway(event);
        } catch {
          if (!closing) emit({ type: "app.error", error: { message: "Voice gateway connection failed" } });
        } finally {
          finish();
        }
      })(),
    );
  }

  browser.onMessage((data) => {
    try {
      if (typeof data !== "string" || data.length > 64 * 1024) throw new Error("Invalid client message");
      const event = JSON.parse(data);
      if (event.type === "session.close") return stop();
      if (closing) return;
      if (!gateway) {
        if (starting || event.type !== "app.start" || typeof event.sdp !== "string" || !event.sdp.trim()) {
          throw new Error("Voice startup message required");
        }
        starting = true;
        execution.waitUntil(
          startSession(event.sdp).catch((error) => {
            if (!closing)
              emit({
                type: "app.error",
                error: { message: error instanceof Error ? error.message : "Voice startup failed" },
              });
            stop();
          }),
        );
        return;
      }
      if (event.type === "app.ready") {
        browserReady = true;
        requestGreeting();
        return;
      }
      if (event.type !== "gateway.heartbeat") {
        throw new Error("Unsupported client event");
      }
      sendGateway({ type: "gateway.heartbeat" });
    } catch {
      emit({ type: "app.error", error: { message: "Voice connection could not be started or continued" } });
      stop();
    }
  });
  browser.onClose(stop);
  browser.onError(stop);
}
