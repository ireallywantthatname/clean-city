import { type NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  return NextResponse.next({ request });
}

export const config = {
  matcher: ["/ops/:path*", "/crew/:path*"],
};
