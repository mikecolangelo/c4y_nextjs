import { NextResponse } from "next/server";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  return NextResponse.json(
    { error: `Inventory request ${params.id} detail not yet implemented via proxy.` },
    { status: 501 }
  );
}

export async function PUT(_request: Request, { params }: { params: { id: string } }) {
  return NextResponse.json(
    { error: `Inventory request ${params.id} update not yet implemented via proxy.` },
    { status: 501 }
  );
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  return NextResponse.json(
    { error: `Inventory request ${params.id} delete not yet implemented via proxy.` },
    { status: 501 }
  );
}
