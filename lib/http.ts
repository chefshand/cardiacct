import { NextResponse } from "next/server";
import { BudgetError } from "@/lib/claude";

export function ok(data: unknown, init?: number) {
  return NextResponse.json(data, { status: init ?? 200 });
}

export function fail(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  const status = e instanceof BudgetError ? 402 : 500;
  console.error("[api]", msg);
  return NextResponse.json({ error: msg }, { status });
}
