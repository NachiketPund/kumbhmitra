import http from "node:http";
import url from "node:url";
import type {
  Request,
  Response,
  NextFunction,
  RequestHandler,
  ErrorRequestHandler,
} from "../types/index.js";

type Handler = RequestHandler | ErrorRequestHandler;

interface RouteLayer {
  path?: string;
  method?: string;
  handler: Handler;
  isRouter?: boolean;
  routerInstance?: any;
}

export class MiniRouter {
  public isMiniRouter = true;
  private stack: RouteLayer[] = [];

  public use(pathOrHandler: string | Handler | MiniRouter, ...handlers: (Handler | MiniRouter)[]): this {
    if (typeof pathOrHandler === "string") {
      for (const h of handlers) {
        if (h instanceof MiniRouter || (h as any).isMiniRouter) {
          const router = h as MiniRouter;
          this.stack.push({
            path: pathOrHandler,
            handler: (req: Request, res: Response, next: NextFunction) => router.handle(req, res, next),
            isRouter: true,
            routerInstance: router,
          });
        } else {
          this.stack.push({ path: pathOrHandler, handler: h as Handler });
        }
      }
    } else {
      const allHandlers = [pathOrHandler, ...handlers];
      for (const h of allHandlers) {
        if (h instanceof MiniRouter || (h as any).isMiniRouter) {
          const router = h as MiniRouter;
          this.stack.push({
            path: "/",
            handler: (req: Request, res: Response, next: NextFunction) => router.handle(req, res, next),
            isRouter: true,
            routerInstance: router,
          });
        } else {
          this.stack.push({ handler: h as Handler });
        }
      }
    }
    return this;
  }

  public get(path: string, ...handlers: RequestHandler[]): this {
    return this.addRoute("GET", path, handlers);
  }

  public post(path: string, ...handlers: RequestHandler[]): this {
    return this.addRoute("POST", path, handlers);
  }

  public put(path: string, ...handlers: RequestHandler[]): this {
    return this.addRoute("PUT", path, handlers);
  }

  public patch(path: string, ...handlers: RequestHandler[]): this {
    return this.addRoute("PATCH", path, handlers);
  }

  public delete(path: string, ...handlers: RequestHandler[]): this {
    return this.addRoute("DELETE", path, handlers);
  }

  public options(path: string, ...handlers: RequestHandler[]): this {
    return this.addRoute("OPTIONS", path, handlers);
  }

  private addRoute(
    method: string,
    routePath: string,
    handlers: RequestHandler[]
  ): this {
    for (const handler of handlers) {
      this.stack.push({
        path: routePath,
        method: method.toUpperCase(),
        handler,
      });
    }
    return this;
  }

  public handle(
    req: Request,
    res: Response,
    done: (err?: any) => void
  ): void {
    let index = 0;
    const stack = this.stack;
    const currentPath = req.path || "/";

    const next = (err?: any): void => {
      if (index >= stack.length) {
        return done(err);
      }

      const layer = stack[index++];

      // Error handler execution
      if (err) {
        if (layer.handler.length === 4) {
          try {
            void (layer.handler as ErrorRequestHandler)(err, req, res, next);
            return;
          } catch (e) {
            return next(e);
          }
        }
        return next(err);
      }

      // Normal middleware / route execution (skip error handlers)
      if (layer.handler.length === 4) {
        return next();
      }

      // Route prefix check
      if (layer.path) {
        if (layer.isRouter) {
          const prefix = layer.path.endsWith("/")
            ? layer.path.slice(0, -1)
            : layer.path;
          if (
            currentPath === prefix ||
            currentPath.startsWith(prefix + "/")
          ) {
            const savedPath = req.path;
            req.path = currentPath.slice(prefix.length) || "/";
            try {
              (layer.handler as RequestHandler)(req, res, (routeErr?: any) => {
                req.path = savedPath;
                next(routeErr);
              });
            } catch (e) {
              req.path = savedPath;
              next(e);
            }
            return;
          }
          return next();
        }

        // Exact or parameterized match
        const isMatch = this.matchRoute(layer.path, currentPath, req);
        if (!isMatch) {
          return next();
        }
      }

      if (layer.method && layer.method !== req.method) {
        return next();
      }

      try {
        void (layer.handler as RequestHandler)(req, res, next);
      } catch (e) {
        next(e);
      }
    };

    next();
  }

  private matchRoute(pattern: string, path: string, req: Request): boolean {
    if (pattern === path) return true;
    if (pattern === "*" || pattern === "/*") return true;

    // Pattern with parameter tokens like /users/:id
    const patternParts = pattern.split("/").filter(Boolean);
    const pathParts = path.split("/").filter(Boolean);

    if (patternParts.length !== pathParts.length) return false;

    const params: Record<string, string> = { ...req.params };
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(":")) {
        const paramName = patternParts[i].slice(1);
        params[paramName] = decodeURIComponent(pathParts[i]);
      } else if (patternParts[i] !== pathParts[i]) {
        return false;
      }
    }
    req.params = params;
    return true;
  }
}

export class MiniApp extends MiniRouter {
  public server: http.Server | null = null;

  constructor() {
    super();
  }

  public listen(port: number, callback?: () => void): http.Server {
    const server = http.createServer((rawReq: http.IncomingMessage, rawRes: http.ServerResponse) => {
      this.enhanceRequestResponse(rawReq, rawRes, (req, res) => {
        this.parseBody(req, () => {
          this.handle(req, res, (err) => {
            if (err) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  success: false,
                  error: { code: "UNHANDLED_ERROR", message: String(err) },
                })
              );
            } else if (!res.writableEnded) {
              res.statusCode = 404;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  success: false,
                  error: {
                    code: "NOT_FOUND",
                    message: `Route not found: ${req.method} ${req.originalUrl}`,
                  },
                })
              );
            }
          });
        });
      });
    });

    this.server = server;
    server.listen(port, callback);
    return server;
  }

  private enhanceRequestResponse(
    rawReq: http.IncomingMessage,
    rawRes: http.ServerResponse,
    next: (req: Request, res: Response) => void
  ): void {
    const req = rawReq as Request;
    const res = rawRes as Response;

    const parsedUrl = url.parse(req.url || "/", true);
    req.path = parsedUrl.pathname || "/";
    req.originalUrl = req.url || "/";
    req.query = (parsedUrl.query as any) || {};
    req.params = {};
    req.ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      rawReq.socket.remoteAddress ||
      "127.0.0.1";

    res.status = function (code: number) {
      res.statusCode = code;
      return res;
    };

    res.set = res.header = function (field: string, value: string | string[]) {
      res.setHeader(field, value);
      return res;
    };

    res.json = function (data: any) {
      if (!res.getHeader("Content-Type")) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
      }
      res.end(JSON.stringify(data));
      return res;
    };

    res.send = function (data: any) {
      if (typeof data === "object" && data !== null) {
        return res.json(data);
      }
      if (!res.getHeader("Content-Type")) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
      }
      res.end(data);
      return res;
    };

    res.sendStatus = function (code: number) {
      res.statusCode = code;
      res.end();
      return res;
    };

    next(req, res);
  }

  private parseBody(req: Request, done: () => void): void {
    const contentType = req.headers["content-type"] || "";
    if (
      req.method === "GET" ||
      req.method === "HEAD" ||
      req.method === "OPTIONS" ||
      !contentType.includes("application/json")
    ) {
      req.body = {};
      return done();
    }

    let raw = "";
    req.on("data", (chunk: any) => {
      raw += chunk;
      if (raw.length > 2 * 1024 * 1024) {
        // 2MB payload protection
        req.destroy();
      }
    });

    req.on("end", () => {
      try {
        req.body = raw.trim() ? JSON.parse(raw) : {};
      } catch {
        req.body = {};
      }
      done();
    });
  }
}

export function express(): MiniApp {
  return new MiniApp();
}

export function Router(): MiniRouter {
  return new MiniRouter();
}

express.Router = Router;
express.json = () => (_req: Request, _res: Response, next: NextFunction) => next();
express.urlencoded = () => (_req: Request, _res: Response, next: NextFunction) => next();

export default express;
