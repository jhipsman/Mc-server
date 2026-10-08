import { config } from './config.js';

const COLORS = { critical: 0xed4245, warning: 0xfee75c, ok: 0x57f287, info: 0x5865f2 };
const lastSent = new Map(); // key -> timestamp, for cooldowns

/**
 * Posts an alert to the Discord webhook (and always logs it).
 * `key` groups alerts for the cooldown; recovery messages pass force=true.
 */
export async function sendAlert({ key, level = 'info', title, description, fields = [], force = false }) {
  const now = Date.now();
  if (!force && key && now - (lastSent.get(key) || 0) < config.alerts.cooldownMs) return false;
  if (key) lastSent.set(key, now);

  console.log(`[alert] ${level.toUpperCase()} ${title}${description ? ` - ${description}` : ''}`);
  if (!config.alerts.webhookUrl) return true;

  const mention = level === 'critical' && config.alerts.roleId ? `<@&${config.alerts.roleId}>` : undefined;
  try {
    const res = await fetch(config.alerts.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Server Monitor',
        content: mention,
        allowed_mentions: { roles: config.alerts.roleId ? [config.alerts.roleId] : [] },
        embeds: [
          {
            title,
            description,
            color: COLORS[level] ?? COLORS.info,
            fields,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.warn(`[alert] webhook returned HTTP ${res.status}`);
  } catch (err) {
    console.warn(`[alert] webhook failed: ${err.message}`);
  }
  return true;
}
