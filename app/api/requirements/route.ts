import { NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId requerido" },
        { status: 400 }
      );
    }

    const requirements = await prisma.requirement.findMany({
      where: {
        projectId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ data: requirements });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error cargando requirements" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const newRequirement = await prisma.requirement.create({
      data: {
        projectId: body.projectId,
        norma: body.norma || null,
        item: body.item || null,
        name: body.name,
        evidencia: body.evidencia || null,
        status: body.status,
        completed: body.status === "total",
        deadline: body.deadline ? new Date(body.deadline) : null,
      },
    });

    return NextResponse.json({ data: newRequirement });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error creando requirement" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();

    const updated = await prisma.requirement.update({
      where: { id: body.id },
      data: {
        norma: body.norma || null,
        item: body.item || null,
        name: body.name,
        evidencia: body.evidencia || null,
        status: body.status,
        completed: body.status === "total",
        deadline: body.deadline ? new Date(body.deadline) : null,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error actualizando requirement" },
      { status: 500 }
    );
  }
}