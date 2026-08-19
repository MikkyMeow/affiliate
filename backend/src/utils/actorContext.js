export function getActorContext(user) {
  if (!user) {
    throw new Error('Actor context requires authenticated user data');
  }

  const userId = user.userId ?? user.id ?? null;
  const role = user.role ?? null;

  if (!userId || !role) {
    throw new Error('Actor context requires user id and role');
  }

  return {
    userId,
    role,
    affiliateId: user.affiliateId ?? null,
    advertiserId: user.advertiserId ?? null,
  };
}
