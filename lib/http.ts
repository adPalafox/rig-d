import { headers } from "next/headers";
import { NextRequest } from "next/server";

export async function getOrigin(request?: NextRequest) {
  if (request) {
    return request.nextUrl.origin;
  }
  const incoming = await headers();
  const host = incoming.get("host");
  const proto = incoming.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}
