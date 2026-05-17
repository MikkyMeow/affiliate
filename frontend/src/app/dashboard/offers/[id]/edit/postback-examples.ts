import { buildTrackingUrl } from '@/lib/tracking';

export const DEFAULT_POSTBACK_MACROS = {
  clickId: 'CLICK_ID',
  externalId: 'EXTERNAL_ID',
  status: 'approved',
  signature: 'CALCULATED_SIGNATURE',
} as const;

export type PostbackGoal = {
  id: string;
  name: string;
};

export type PostbackExample = {
  goalId: string;
  goalName: string;
  requestTitle: string;
  code: string;
};

function buildCurlExample({
  endpointUrl,
  token,
  goal,
}: {
  endpointUrl: string;
  token: string;
  goal: PostbackGoal;
}): string {
  return `curl -X POST "${endpointUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "token": "${token}",
    "goal_id": "${goal.id}",
    "click_id": "${DEFAULT_POSTBACK_MACROS.clickId}",
    "external_id": "${DEFAULT_POSTBACK_MACROS.externalId}",
    "status": "${DEFAULT_POSTBACK_MACROS.status}",
    "signature": "${DEFAULT_POSTBACK_MACROS.signature}"
  }'`;
}

export function buildPostbackExamples({
  token,
  goals,
}: {
  token: string;
  goals: PostbackGoal[];
}): PostbackExample[] {
  const endpointUrl = buildTrackingUrl('/track/postback');

  return goals.map((goal) => ({
    goalId: goal.id,
    goalName: goal.name,
    requestTitle: `POST ${endpointUrl}`,
    code: buildCurlExample({
      endpointUrl,
      token,
      goal,
    }),
  }));
}
