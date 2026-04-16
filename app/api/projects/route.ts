import { prisma } from "../../lib/prisma";

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      include: {
        requirements: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return Response.json({
      success: true,
      data: projects,
    });
  } catch (error) {
    console.error("ERROR GET:", error);

    return Response.json(
      { success: false, error: "Error cargando proyectos" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.name || !body.code) {
      return Response.json(
        { success: false, error: "Faltan name o code" },
        { status: 400 }
      );
    }

    const project = await prisma.project.create({
      data: {
        name: body.name,
        code: body.code,
      },
    });

    return Response.json({
      success: true,
      data: project,
    });
  } catch (error) {
    console.error("ERROR POST:", error);

    return Response.json(
      { success: false, error: "Error creando proyecto" },
      { status: 500 }
    );
  }
}