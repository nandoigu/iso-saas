import ProjectMatrixClient from "../ProjectMatrixClient";

export default async function MatrixPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <ProjectMatrixClient projectId={id} />;
}
