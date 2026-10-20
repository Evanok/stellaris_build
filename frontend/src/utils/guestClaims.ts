// Claim tokens of builds this browser submitted without an account.
//
// Kept in localStorage so that, when the visitor later signs in on the same
// browser, App.tsx can attach those builds to the account automatically
// (POST /api/builds/claim). The token is also shown to the visitor as a link,
// for claiming from another device.

const STORAGE_KEY = 'guest_build_claims';

export interface GuestClaim {
  token: string;
  name: string;
}

export function getGuestClaims(): GuestClaim[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(c => c && typeof c.token === 'string') : [];
  } catch {
    return [];
  }
}

function saveGuestClaims(claims: GuestClaim[]): void {
  try {
    if (claims.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(claims));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable: the claim link shown after submission still works
  }
}

export function addGuestClaim(claim: GuestClaim): void {
  saveGuestClaims([...getGuestClaims().filter(c => c.token !== claim.token), claim]);
}

export function removeGuestClaim(token: string): void {
  saveGuestClaims(getGuestClaims().filter(c => c.token !== token));
}

export function claimUrl(token: string): string {
  return `${window.location.origin}/claim/${encodeURIComponent(token)}`;
}

export interface ClaimResult {
  status: 'pending' | 'approved' | 'rejected';
  build_id?: number;
  build_name: string;
}

// Throws with the server's message on failure
export async function claimBuild(token: string): Promise<ClaimResult> {
  const response = await fetch('/api/builds/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Failed to claim the build') as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return data;
}
