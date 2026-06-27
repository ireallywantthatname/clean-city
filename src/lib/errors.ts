import { NextResponse } from "next/server";

interface ProblemDetail {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
}

export function problemResponse(problem: ProblemDetail) {
  return NextResponse.json(
    {
      type: problem.type || "about:blank",
      title: problem.title,
      status: problem.status,
      detail: problem.detail,
      instance: problem.instance,
    },
    {
      status: problem.status,
      headers: { "Content-Type": "application/problem+json" },
    },
  );
}

export function badRequest(detail: string) {
  return problemResponse({ title: "Bad Request", status: 400, detail });
}

export function unauthorized(detail = "Authentication required") {
  return problemResponse({ title: "Unauthorized", status: 401, detail });
}

export function forbidden(detail = "Insufficient permissions") {
  return problemResponse({ title: "Forbidden", status: 403, detail });
}

export function notFound(detail = "Resource not found") {
  return problemResponse({ title: "Not Found", status: 404, detail });
}

export function serverError(detail = "Internal server error") {
  return problemResponse({ title: "Internal Server Error", status: 500, detail });
}
