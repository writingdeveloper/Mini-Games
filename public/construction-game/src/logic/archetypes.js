export const ARCHETYPES = {
  dozer:   { id: 'dozer',   label: '졸보',   icon: '💤', slackMeanSeconds: 10, slackVariance: 4, rageSensitivity: 0.8, workRate: 0.9, spreads: false, color: 0x6fae6f },
  phone:   { id: 'phone',   label: '폰충',   icon: '📱', slackMeanSeconds: 7,  slackVariance: 3, rageSensitivity: 1.0, workRate: 1.0, spreads: false, color: 0x6f9fae },
  chatter: { id: 'chatter', label: '잡담러', icon: '💬', slackMeanSeconds: 9,  slackVariance: 4, rageSensitivity: 1.0, workRate: 1.0, spreads: true,  color: 0xae9f6f },
  hothead: { id: 'hothead', label: '다혈질', icon: '😤', slackMeanSeconds: 12, slackVariance: 5, rageSensitivity: 2.0, workRate: 1.1, spreads: false, color: 0xae6f6f },
};

export const ARCHETYPE_LIST = Object.values(ARCHETYPES);

export function getArchetype(id) {
  const a = ARCHETYPES[id];
  if (!a) throw new Error(`unknown archetype: ${id}`);
  return a;
}
