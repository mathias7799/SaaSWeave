export type TestMiddlewareResult = {
  context: Record<string, unknown>;
};

type MiddlewareLike = {
  options: {
    middleware?: MiddlewareLike[];
    server?: (args: {
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

export async function runServerMiddleware(
  middleware: unknown,
  options: {
    handler?: (ctx: { context: Record<string, unknown> }) => Promise<TestMiddlewareResult>;
  } = {}
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
      return options.handler ? options.handler({ context }) : { context };
    }

    return current.options.server({
      context,
      next: async (nextCtx) => callNext({ context: nextCtx?.context })
    });
  };

  return callNext();
}
