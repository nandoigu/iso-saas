export type AuditorStatus = "active" | "suspended" | "retired";
export type AuditTeamStatus = "forming" | "active" | "completed" | "disbanded";
export type AuditTeamMemberRole =
  | "lead_auditor"
  | "support_auditor"
  | "technical_expert";
export type AuditTeamMemberStatus =
  | "invited"
  | "confirmed"
  | "active"
  | "withdrawn"
  | "completed";

export const AUDITOR_STATUSES: AuditorStatus[] = ["active", "suspended", "retired"];
export const AUDIT_TEAM_STATUSES: AuditTeamStatus[] = [
  "forming",
  "active",
  "completed",
  "disbanded",
];
export const MEMBER_ROLES: AuditTeamMemberRole[] = [
  "lead_auditor",
  "support_auditor",
  "technical_expert",
];
export const MEMBER_STATUSES: AuditTeamMemberStatus[] = [
  "invited",
  "confirmed",
  "active",
  "withdrawn",
  "completed",
];
export const UPDATABLE_MEMBER_STATUSES = [
  "confirmed",
  "active",
  "withdrawn",
  "completed",
] as const;

export type CreateAuditorInput = {
  companyId: string;
  name: string;
  email: string;
  phone?: string;
  certificationBody?: string;
  certificationNumber?: string;
  certificationLevel?: string;
  qualifications?: string[];
  isExternal?: boolean;
  notes?: string;
  userId?: string;
  createdById: string;
};

export type UpdateAuditorInput = Partial<{
  name: string;
  phone: string | null;
  certificationBody: string | null;
  certificationNumber: string | null;
  certificationLevel: string | null;
  qualifications: string[];
  isExternal: boolean;
  notes: string | null;
  status: AuditorStatus;
}>;

export type CreateAuditTeamInput = {
  companyId: string;
  projectId: string;
  auditId: string;
  name?: string;
  createdById: string;
};

export type UpdateAuditTeamInput = Partial<{
  name: string | null;
  status: AuditTeamStatus;
}>;

export type AddAuditTeamMemberInput = {
  auditTeamId: string;
  auditorId: string;
  role: AuditTeamMemberRole;
  notes?: string;
  createdById: string;
};

export type UpdateAuditTeamMemberInput = {
  status?: (typeof UPDATABLE_MEMBER_STATUSES)[number];
  withdrawnReason?: string;
  notes?: string;
};
