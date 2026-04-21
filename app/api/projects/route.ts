import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        requirements: true,
      },
    });

    return NextResponse.json({ data: projects });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error obteniendo proyectos" },
      { status: 500 }
    );
  }
}