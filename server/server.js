import express from "express";
import { Telegraf } from "telegraf";
import cors from "cors";
import dotenv from "dotenv";
import { supabase } from "./supabaseClient.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const bot = new Telegraf(process.env.BOT_TOKEN);

//start command
bot.start(async (msg) => {
  const user = msg.from;

  await supabase
    .from("scores")
    .upsert([
      { user_id: String(user.id), username: user.username || "", score: 0 },
    ]);

  msg.reply("👋 Click Rush o‘yiniga xush kelibsiz!", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🎮 O‘yin",
            web_app: { url: process.env.WEBAPP_URL },
          },
        ],
      ],
    },
  });
});

//save score
app.post("/save-score", async (req, res) => {
  const { userId, username, score } = req.body;

  const { data: existing } = await supabase
    .from("scores")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!existing) {
    await supabase.from("scores").insert([{ user_id: userId, username, score }]);
  } else if (score > existing.score) {
    await supabase.from("scores").update({ score }).eq("user_id", userId);
  }

  res.sendStatus(200);
});

//top10 ratings
app.get("/leaderboard", async (req, res) => {
  const { data } = await supabase
    .from("scores")
    .select("username, score")
    .order("score", { ascending: false })
    .limit(10);
  res.json(data);
});

bot.launch();
app.listen(process.env.PORT, () =>
  console.log(`🚀 Server ${process.env.PORT} portda ishga tushdi`)
);