import express from "express";
import jwt from "jsonwebtoken";
import { verifyTelegramAuth } from "../utils/verifyTelegramAuth.js";

const router = express.Router();

// Simple in-memory replay guard.
// Productionda Redis yoki Supabase table bilan almashtiring.
const usedInitData = new Map(); // key -> expireTime (ms)
const REPLAY_TTL_MS = 60 * 60 * 1000; // 1 soat

function cleanUsedInitData() {
  const now = Date.now();
  for (const [k, expire] of usedInitData.entries()) {
    if (expire <= now) usedInitData.delete(k);
  }
}
// chaqirish uchun interval (optional)
setInterval(cleanUsedInitData, 5 * 60 * 1000);

router.post("/api/auth", (req, res) => {
  const { initData } = req.body;
  if (!initData) return res.status(400).json({ ok: false, message: "Missing initData" });

  // 1) signature tekshiruvi
  const ok = verifyTelegramAuth(initData, process.env.BOT_TOKEN);
  if (!ok) return res.status(403).json({ ok: false, message: "Invalid signature" });

  // 2) parse qilish
  const params = Object.fromEntries(new URLSearchParams(initData));
  // params.user odatda JSON string bo'ladi; uni parse qilamiz
  if (params.user) {
    try {
      params.user = JSON.parse(params.user);
    } catch (e) {
      // agar parse bo'lmasa, davom etamiz
    }
  }

  // 3) timestamp tekshiruvi (auth_date)
  const authDate = Number(params.auth_date) || 0;
  const nowSec = Math.floor(Date.now() / 1000);
  const ALLOWED_SKEW = 300; // 5 daqiqa
  if (Math.abs(nowSec - authDate) > ALLOWED_SKEW) {
    return res.status(403).json({ ok: false, message: "Auth date too old" });
  }

  // 4) replay guard: hash yoki butun initData'ni kalit sifatida ishlatamiz
  const key = params.hash || initData;
  if (usedInitData.has(key)) {
    return res.status(403).json({ ok: false, message: "Replay detected" });
  }
  usedInitData.set(key, Date.now() + REPLAY_TTL_MS);

  // 5) JWT yaratish (session). Payloadga kerakli ma'lumotlarni soling
  const payload = {
    id: params.user?.id || params.user_id || params.id,
    username: params.user?.username || params.username || null,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

  // 6) qaytarish
  return res.json({ ok: true, token, user: params.user || payload });
});

export default router;
