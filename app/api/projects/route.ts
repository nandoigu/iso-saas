import { prisma } from "../../lib/prisma";

// GET -> obtener requisitos de un proyecto
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return Response.json({ error: "Falta projectId" }, { status: 400 });
    }

    const data = await prisma.requirement.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ data });
  } catch (error) {
    console.error("ERROR GET /api/requirements:", error);
    return Response.json(
      { error: "Error al obtener requisitos" },
      { status: 500 }
    );
  }
}

// POST -> crear requisito
export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.projectId || !body.name) {
      return Response.json(
        { error: "Faltan datos obligatorios: projectId o name" },
        { status: 400 }
      );
    }

    const normalizedStatus =
      body.status === "total" ||
      body.status === "parcial" ||
      body.status === "no_conforme"
        ? body.status
        : "no_conforme";

    const requirement = await prisma.requirement.create({
      data: {
        projectId: body.projectId,
        norma: body.norma?.trim() || null,
        item: body.item?.trim() || null,
        name: body.name.trim(),
        evidencia: body.evidencia?.trim() || null,
        status: normalizedStatus,
        deadline: body.deadline ? new Date(body.deadline) : null,
        completed: normalizedStatus === "total",
      },
    });

    return Response.json({ success: true, data: requirement });
  } catch (error) {
    console.error("ERROR POST /api/requirements:", error);
    return Response.json(
      { error: "Error creando requisito" },
      { status: 500 }
    );
  }
}

// PUT -> editar requisito completo o cambiar estado
export async function PUT(req: Request) {
  try {
    const body = await req.json();

    if (!body.id) {
      return Response.json({ error: "Falta id" }, { status: 400 });
    }

    const normalizedStatus =
      body.status === "total" ||
      body.status === "parcial" ||
      body.status === "no_conforme"
        ? body.status
        : "no_conforme";

    const updated = await prisma.requirement.update({
      where: { id: body.id },
      data: {
        norma: typeof body.norma === "string" ? body.norma.trim() || null : null,
        item: typeof body.item === "string" ? body.item.trim() || null : null,
        name: typeof body.name === "string" ? body.name.trim() : undefined,
        evidencia:
          typeof body.evidencia === "string"
            ? body.evidencia.trim() || null
            : null,
        status: normalizedStatus,
        deadline: body.deadline ? new Date(body.deadline) : null,
        completed: normalizedStatus === "total",
      },
    });

    return Response.json({ success: true, data: updated });
  } catch (error) {
    console.error("ERROR PUT /api/requirements:", error);
    return Response.json(
      { error: "Error actualizando requisito" },
      { status: 500 }
    );
  }
}