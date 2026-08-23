const https = require('https');

// ================= TELEGRAM CONFIGURATIONS =================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8853364712:AAEif92LUwmj2N4hdqo1SBKqE3XM0NMNTxI";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "1485164955";
const FIREBASE_PROJECT_ID = "phi-pnb";

function fetchFirestore(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function sendTelegramMessage(text) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: text,
      parse_mode: 'HTML'
    });

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        console.log("Telegram API Response:", responseBody);
        resolve(responseBody);
      });
    });

    req.on('error', (err) => {
      console.error("Telegram Request Error:", err);
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

async function runDailyReminder() {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Colombo" }));
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = now.getDate();
  const monthKey = `${year}-${month}`;
  
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = daysOfWeek[now.getDay()];

  console.log(`Checking duties for ${monthKey}, Day: ${day} (${dayName})...`);

  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/phi_advance_schedules/${monthKey}`;

  try {
    const res = await fetchFirestore(url);
    
    let fnDuty = "රාජකාරියක් සටහන් කර නැත (No schedule)";
    let anDuty = "රාජකාරියක් සටහන් කර නැත (No schedule)";
    let officerName = "PHI Officer";
    let phiArea = "Range Area";

    if (res.fields) {
      officerName = res.fields.phiName?.stringValue || officerName;
      phiArea = res.fields.phiArea?.stringValue || phiArea;
      const daysMap = res.fields.days?.mapValue?.fields || {};
      const todayData = daysMap[day]?.mapValue?.fields || {};
      fnDuty = todayData.fn?.stringValue || fnDuty;
      anDuty = todayData.an?.stringValue || anDuty;
    }

    const message = `📋 <b>PHI DAILY DUTY REMINDER (Health 510)</b>
━━━━━━━━━━━━━━━━━━
📅 <b>දිනය:</b> ${year}-${month}-${String(day).padStart(2, '0')} (${dayName})
👤 <b>නිලධාරී:</b> ${officerName} | ${phiArea}

🌅 <b>Forenoon (8:00 AM - 12:00 PM):</b>
• ${fnDuty}

🌇 <b>Afternoon (1:00 PM - 4:00 PM):</b>
• ${anDuty}
━━━━━━━━━━━━━━━━━━
<i>Pocket Note Book (Health 253) එකේ සටහන් කිරීමට App එක විවෘත කරන්න.</i>`;

    console.log("Sending Telegram notification...");
    await sendTelegramMessage(message);
    console.log("Completed!");

  } catch (error) {
    console.error("Error in reminder process:", error);
  }
}

runDailyReminder();
