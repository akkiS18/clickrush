import express from "express";
import { Telegraf } from "telegraf";
import cors from "cors";
import dotenv from "dotenv";
import { supabase } from "./supabaseClient.js";
import authRouter from "./routes/auth.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use(authRouter);

const bot = new Telegraf(process.env.BOT_TOKEN);

// ✅ Start command
bot.start(async (ctx) => {
  const user = ctx.from;

  await supabase
    .from("scores")
    .upsert([{ user_id: String(user.id), username: user.username || "", score: 0 }]);

  await ctx.reply("👋 Click Rush o‘yiniga xush kelibsiz!", {
    reply_markup: {
      keyboard: [
        [
          {
            text: "🎮 Click Rush o‘yinni ochish",
            web_app: { url: process.env.WEBAPP_URL } 
          }
        ]
      ],
      resize_keyboard: true,
    },
  });
});

// ✅ Save score
app.post("/save-score", async (req, res) => {
  const { userId, username, score } = req.body;

  const { data: existing, error } = await supabase
    .from("scores")
    .select("score")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error(error);
    return res.sendStatus(500);
  }

  if (!existing || score > existing.score) {
    await supabase
      .from("scores")
      .upsert([{ user_id: userId, username, score }]);
  }

  res.sendStatus(200);
});

// ✅ Leaderboard
app.get("/leaderboard", async (req, res) => {
  const { data, error } = await supabase
    .from("scores")
    .select("username, score")
    .order("score", { ascending: false })
    .limit(10);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// === WEBHOOK SETUP ===
const PORT = process.env.PORT || 3000;
const WEBHOOK_PATH = `/telegraf/${bot.secretPathComponent()}`;
const WEBHOOK_URL = `${process.env.RENDER_EXTERNAL_URL}${WEBHOOK_PATH}`;

app.use(bot.webhookCallback(WEBHOOK_PATH));

bot.launch()
// ✅ Run Express
app.listen(PORT, async () => {
  console.log(`🚀 Server ${PORT} portda ishga tushdi`);

  // Telegram’ga webhook URLni o‘rnatamiz
  await bot.telegram.setWebhook(WEBHOOK_URL);
  console.log(`✅ Webhook ulandi: ${WEBHOOK_URL}`);
});
