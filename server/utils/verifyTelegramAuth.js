import crypto from "crypto";

/**
 * initData - Telegram tomonidan yuborilgan to'liq initData string (URLSearchParams shaklida)
 * botToken - sizning BOT tokeningiz (process.env.BOT_TOKEN)
 * return: true/false
 */
export function verifyTelegramAuth(initData, botToken) {
  if (!initData || !botToken) return false;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return false;

  // hash ni params dan olib tashlaymiz
  params.delete("hash");

  // ma'lumotlarni alfavit tartibida birlashtiramiz
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  // Telegram algoritmi: secret_key = HMAC_SHA256("WebAppData", botToken)
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  return computedHash === hash;
}
