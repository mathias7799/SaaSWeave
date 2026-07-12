import { initLogger, type RequestLogger } from "evlog";
import { clearMemoryLogs, createMemoryDrain, readMemoryLogs } from "evlog/memory";

export const MEMORY_STORE = "logger-unit-tests";

export function setupMemoryLogger(store = MEMORY_STORE) {
  initLogger({
    drain: createMemoryDrain({ store }),
    enabled: true,
    env: { environment: "test" },
    silent: true
  });
  clearMemoryLogs(store);
  return store;
}

export async function flushMemoryLogs(store = MEMORY_STORE) {
  await new Promise((resolve) => setTimeout(resolve, 25));
  return readMemoryLogs({ store });
}

export type TestRequestContext = {
  requestId: string;
  request: {
    hostname: string;
    ip?: string;
    method: string;
    path: string;
    query?: Record<string, string>;
  };
  logger: RequestLogger;
  [key: string]: unknown;
};

export type TestMiddlewareResult = {
  context: TestRequestContext;
};

type MiddlewareLike = {
  options: {
    middleware?: MiddlewareLike[];
    server?: (args: {
      request: Request;
      context: Record<string, unknown>;
      next: (ctx?: { context?: Record<string, unknown> }) => Promise<TestMiddlewareResult>;
    }) => Promise<TestMiddlewareResult>;
  };
};

function flattenMiddlewares(middlewares: MiddlewareLike[]) {
  const seen = new Set<MiddlewareLike>();
  const flattened: MiddlewareLike[] = [];

  const recurse = (list: MiddlewareLike[]) => {
    for (const middleware of list) {
      if (middleware.options.middleware) {
        recurse(middleware.options.middleware);
      }

      if (!seen.has(middleware)) {
        seen.add(middleware);
        flattened.push(middleware);
      }
    }
  };

  recurse(middlewares);
  return flattened;
}

export async function runRequestMiddleware(
  middleware: unknown,
  options: {
    request: Request;
    handler?: (ctx: {
      context: TestRequestContext;
    }) => Promise<TestMiddlewareResult> | TestMiddlewareResult;
  }
): Promise<TestMiddlewareResult> {
  const flattened = flattenMiddlewares([middleware as MiddlewareLike]);
  let index = 0;
  let context: Record<string, unknown> = {};

  const callNext = async (
    userCtx: { context?: Record<string, unknown> } = {}
  ): Promise<TestMiddlewareResult> => {
    context = { ...context, ...userCtx.context };
    const current = flattened[index++];

    if (!current?.options.server) {
      return options.handler
        ? options.handler({ context: context as TestRequestContext })
        : { context: context as TestRequestContext };
    }

    return current.options.server({
      request: options.request,
      context,
      next: async (nextCtx) => callNext({ context: nextCtx?.context })
    });
  };

  return callNext({});
}
