import { prisma } from "@/app/lib/prisma";
import type {
  AddAuditTeamMemberInput,
  AuditorStatus,
  CreateAuditorInput,
  CreateAuditTeamInput,
  UpdateAuditorInput,
  UpdateAuditTeamInput,
  UpdateAuditTeamMemberInput,
} from "@/services/audit-team.types";

const AUDITOR_SUMMARY_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  certificationBody: true,
  certificationLevel: true,
  qualifications: true,
  isExternal: true,
  status: true,
  userId: true,
  createdAt: true,
} as const;

const MEMBER_DETAIL_SELECT = {
  id: true,
  auditorId: true,
  role: true,
  status: true,
  assignedAt: true,
  confirmedAt: true,
  withdrawnAt: true,
  withdrawnReason: true,
  notes: true,
  auditor: {
    select: {
      id: true,
      name: true,
      email: true,
      certificationLevel: true,
      isExternal: true,
    },
  },
} as const;

// ─── Auditor ─────────────────────────────────────────────────────────────────

export async function listAuditors(
  companyId: string,
  filters: { status?: string; isExternal?: boolean } = {}
) {
  return prisma.auditor.findMany({
    where: {
      companyId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.isExternal !== undefined ? { isExternal: filters.isExternal } : {}),
    },
    select: AUDITOR_SUMMARY_SELECT,
    orderBy: { name: "asc" },
  });
}

export async function getAuditor(auditorId: string, companyId: string) {
  return prisma.auditor.findFirst({
    where: { id: auditorId, companyId },
    include: {
      assignments: {
        select: {
          id: true,
          auditTeamId: true,
          role: true,
          status: true,
          assignedAt: true,
          confirmedAt: true,
          withdrawnAt: true,
        },
      },
    },
  });
}

export async function createAuditor(input: CreateAuditorInput) {
  if (input.userId) {
    const existingProfile = await prisma.auditor.findFirst({
      where: { userId: input.userId },
      select: { id: true },
    });
    if (existingProfile) {
      return { error: "Este usuario ya tiene un perfil de auditor." as const };
    }
  }

  try {
    const auditor = await prisma.auditor.create({
      data: {
        companyId: input.companyId,
        userId: input.userId ?? null,
        name: input.name,
        email: input.email.trim().toLowerCase(),
        phone: input.phone ?? null,
        certificationBody: input.certificationBody ?? null,
        certificationNumber: input.certificationNumber ?? null,
        certificationLevel: input.certificationLevel ?? null,
        qualifications: input.qualifications ?? [],
        isExternal: input.isExternal ?? false,
        notes: input.notes ?? null,
        createdById: input.createdById,
      },
      select: AUDITOR_SUMMARY_SELECT,
    });
    return { auditor };
  } catch (e: unknown) {
    if (isPrismaUniqueError(e)) {
      return { error: "Ya existe un auditor con ese email en esta empresa." as const };
    }
    throw e;
  }
}

export async function updateAuditor(
  auditorId: string,
  companyId: string,
  input: UpdateAuditorInput
) {
  const auditor = await prisma.auditor.findFirst({
    where: { id: auditorId, companyId },
    select: { id: true, status: true },
  });
  if (!auditor) return { notFound: true as const };

  const inactivatingStatus: AuditorStatus[] = ["suspended", "retired"];
  if (input.status && inactivatingStatus.includes(input.status)) {
    const activeAssignments = await prisma.auditTeamMember.count({
      where: {
        auditorId,
        status: { in: ["invited", "confirmed", "active"] },
      },
    });
    if (activeAssignments > 0) {
      return {
        error: "No se puede suspender o retirar un auditor con asignaciones activas." as const,
      };
    }
  }

  const updated = await prisma.auditor.update({
    where: { id: auditorId },
    data: input,
    include: {
      assignments: {
        select: {
          id: true,
          auditTeamId: true,
          role: true,
          status: true,
          assignedAt: true,
          confirmedAt: true,
          withdrawnAt: true,
        },
      },
    },
  });
  return { auditor: updated };
}

// ─── AuditTeam ───────────────────────────────────────────────────────────────

export async function listAuditTeams(
  companyId: string,
  filters: { projectId?: string; status?: string } = {}
) {
  const teams = await prisma.auditTeam.findMany({
    where: {
      companyId,
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    include: {
      members: {
        where: { role: "lead_auditor", status: { in: ["invited", "confirmed", "active"] } },
        select: { auditor: { select: { id: true, name: true } } },
        take: 1,
      },
      _count: { select: { members: true } },
    },
    orderBy: { formedAt: "desc" },
  });

  return teams.map((t) => ({
    id: t.id,
    projectId: t.projectId,
    auditId: t.auditId,
    name: t.name,
    status: t.status,
    formedAt: t.formedAt,
    memberCount: t._count.members,
    leadAuditor: t.members[0]?.auditor ?? null,
  }));
}

export async function getAuditTeam(teamId: string, companyId: string) {
  return prisma.auditTeam.findFirst({
    where: { id: teamId, companyId },
    include: {
      members: {
        select: MEMBER_DETAIL_SELECT,
        orderBy: { assignedAt: "asc" },
      },
    },
  });
}

export async function createAuditTeam(input: CreateAuditTeamInput) {
  const project = await prisma.project.findFirst({
    where: { id: input.projectId, companyId: input.companyId },
    select: { id: true },
  });
  if (!project) return { notFound: true as const };

  const team = await prisma.auditTeam.create({
    data: {
      companyId: input.companyId,
      projectId: input.projectId,
      auditId: input.auditId,
      name: input.name ?? null,
      createdById: input.createdById,
    },
    include: {
      members: { select: MEMBER_DETAIL_SELECT },
    },
  });
  return { team };
}

export async function updateAuditTeam(
  teamId: string,
  companyId: string,
  input: UpdateAuditTeamInput
) {
  const team = await prisma.auditTeam.findFirst({
    where: { id: teamId, companyId },
    select: { id: true },
  });
  if (!team) return { notFound: true as const };

  if (input.status === "disbanded") {
    const signedReport = await prisma.auditReport.findFirst({
      where: { auditTeamId: teamId, status: { in: ["signed", "finalizado"] } },
      select: { id: true },
    });
    if (signedReport) {
      return {
        error: "No se puede disolver un equipo vinculado a un informe firmado." as const,
      };
    }
  }

  const updated = await prisma.auditTeam.update({
    where: { id: teamId },
    data: input,
    include: { members: { select: MEMBER_DETAIL_SELECT } },
  });
  return { team: updated };
}

// ─── AuditTeamMember ─────────────────────────────────────────────────────────

export async function addAuditTeamMember(input: AddAuditTeamMemberInput) {
  const team = await prisma.auditTeam.findFirst({
    where: { id: input.auditTeamId },
    select: { id: true, companyId: true },
  });
  if (!team) return { notFound: "team" as const };

  const auditor = await prisma.auditor.findFirst({
    where: { id: input.auditorId, companyId: team.companyId, status: "active" },
    select: { id: true },
  });
  if (!auditor) return { notFound: "auditor" as const };

  if (input.role === "lead_auditor") {
    const existingLead = await prisma.auditTeamMember.findFirst({
      where: {
        auditTeamId: input.auditTeamId,
        role: "lead_auditor",
        status: { in: ["invited", "confirmed", "active"] },
      },
      select: { id: true },
    });
    if (existingLead) {
      return { error: "Ya existe un auditor líder activo en este equipo." as const };
    }
  }

  try {
    const member = await prisma.auditTeamMember.create({
      data: {
        auditTeamId: input.auditTeamId,
        auditorId: input.auditorId,
        role: input.role,
        notes: input.notes ?? null,
        createdById: input.createdById,
      },
      select: MEMBER_DETAIL_SELECT,
    });
    return { member };
  } catch (e: unknown) {
    if (isPrismaUniqueError(e)) {
      return { error: "Este auditor ya está asignado a este equipo." as const };
    }
    throw e;
  }
}

export async function updateAuditTeamMember(
  memberId: string,
  teamId: string,
  companyId: string,
  input: UpdateAuditTeamMemberInput
) {
  const member = await prisma.auditTeamMember.findFirst({
    where: { id: memberId, auditTeamId: teamId },
    include: { auditTeam: { select: { companyId: true } } },
  });
  if (!member || member.auditTeam.companyId !== companyId) {
    return { notFound: true as const };
  }

  // Invariant #5 — equipo de report firmado es inmutable
  const signedReport = await prisma.auditReport.findFirst({
    where: { auditTeamId: teamId, status: { in: ["signed", "finalizado"] } },
    select: { id: true },
  });
  if (signedReport) {
    return {
      error: "El equipo está vinculado a un informe firmado y no puede modificarse." as const,
    };
  }

  // Invariant #3 — retirar lead sin sucesor confirmado
  if (input.status === "withdrawn" && member.role === "lead_auditor") {
    const successor = await prisma.auditTeamMember.findFirst({
      where: {
        auditTeamId: teamId,
        id: { not: memberId },
        role: "lead_auditor",
        status: { in: ["confirmed", "active"] },
      },
      select: { id: true },
    });
    if (!successor) {
      return {
        error: "No se puede retirar al auditor líder sin nombrar un sucesor confirmado." as const,
      };
    }
  }

  const now = new Date();
  const updated = await prisma.auditTeamMember.update({
    where: { id: memberId },
    data: {
      ...(input.status ? { status: input.status } : {}),
      ...(input.status === "confirmed" ? { confirmedAt: now } : {}),
      ...(input.status === "withdrawn" ? { withdrawnAt: now } : {}),
      ...(input.withdrawnReason !== undefined ? { withdrawnReason: input.withdrawnReason } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
    select: MEMBER_DETAIL_SELECT,
  });
  return { member: updated };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isPrismaUniqueError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code: string }).code === "P2002"
  );
}
