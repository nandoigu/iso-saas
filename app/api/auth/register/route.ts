import { NextResponse } from "next/server";
import {
  createSessionToken,
  hashPassword,
  isValidEmail,
  normalizeEmail,
  setSessionCookie,
} from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = normalizeEmail(body.email || "");
    const password = String(body.password || "");
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Email no valido" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "La contrasena debe tener al menos 8 caracteres" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con ese email" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const company = await prisma.company.create({
      data: {
        name: name ? `${name} Company` : `${email} Company`,
      },
    });

    const user = await prisma.user.create({
      data: {
        email,
        name: name || null,
        password: passwordHash,
        companyId: company.id,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
      },
    });

    const response = NextResponse.json({ data: { user } }, { status: 201 });
    setSessionCookie(response, createSessionToken(user));
    return response;
  } catch (error) {
    console.error("ERROR REGISTER:", error);
    return NextResponse.json(
      { error: "Error registrando usuario" },
      { status: 500 }
    );
  }
}
