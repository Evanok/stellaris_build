// Approve or reject a build submitted without an account (admin only).
// Resolves with the published build id on approval; throws with the server's message.
export async function reviewPendingBuild(id: number | string, action: 'approve' | 'reject'): Promise<number | undefined> {
  const response = await fetch(`/api/admin/pending-builds/${id}/${action}`, { method: 'POST' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Failed to ${action} the build`);
  return data.build_id;
}
