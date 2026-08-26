const https = require('https');
const nodemailer = require('nodemailer');

// ================= CONFIGURATIONS =================
// TELEGRAM CONFIG
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8853364712:AAEif92LUwmj2N4hdqo1SBKqE3XM0NMNTxI";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "1485164955";

// EMAIL CONFIG
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_TO = process.env.EMAIL_TO || EMAIL_USER;

const FIREBASE_PROJECT_ID = "phi-pnb";
const APP_URL = "https://techtonicgadgetsl-cell.github.io/PHI-PNB/";

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

// ---------------- TELEGRAM SENDER ----------------
function sendTelegramMessage(text, showAppButton = false) {
  return new Promise((resolve, reject) => {
    const payloadObj = {
      chat_id: TELEGRAM_CHAT_ID,
      text: text,
      parse_mode: 'HTML'
    };

    if (showAppButton) {
      payloadObj.reply_markup = {
        inline_keyboard: [[{ text: "📱 Open Pocket Log App", url: APP_URL }]]
      };
    }

    const payload = JSON.stringify(payloadObj);

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => resolve(responseBody));
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ---------------- EMAIL SENDER ----------------
async function sendEmailMessage(subject, htmlText) {
  if (!EMAIL_USER || !EMAIL_PASS) {
    console.log("Email skip: Credentials not configured.");
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: EMAIL_USER, pass: EMAIL_PASS }
  });

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #fdfdfd;">
      <h3 style="color: #059669; margin-top: 0;">${subject}</h3>
      <div style="color: #333; line-height: 1.6; font-size: 14px;">
        ${htmlText.replace(/\n/g, '<br>')}
      </div>
      <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee; font-size: 11px; color: #888; text-align: center;">
        Automated Notification from Health 253 Assistant System
      </div>
    </div>
  `;

  const mailOptions = {
    from: `"PHI Alert System" <${EMAIL_USER}>`,
    to: EMAIL_TO,
    subject: subject,
    html: emailHtml
  };

  const info = await transporter.sendMail(mailOptions);
  console.log("Email sent: " + info.response);
}

// ---------------- DUAL PLATFORM SENDER ----------------
async function sendAlert(subject, tgMessage, showAppButton = false) {
  console.log("-> Sending to Telegram...");
  await sendTelegramMessage(tgMessage, showAppButton).catch(e => console.error("Telegram Error:", e));
  
  console.log("-> Sending to Email...");
  await sendEmailMessage(subject, tgMessage).catch(e => console.error("Email Error:", e));
}

// ---------------- DUTY SCHEDULE LOGIC ----------------
async function getDutyForDate(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = dateObj.getDate();
  const monthKey = `${year}-${month}`;
  
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayName = daysOfWeek[dateObj.getDay()];
  const formattedDate = `${year}-${month}-${String(day).padStart(2, '0')}`;

  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/phi_advance_schedules/${monthKey}`;

  let fn = "No specific duty";
  let an = "No specific duty";
  let officerName = "PHI Officer";
  let phiArea = "Range";

  try {
    const res = await fetchFirestore(url);
    if (res.fields) {
      officerName = res.fields.phiName?.stringValue || officerName;
      phiArea = res.fields.phiArea?.stringValue || phiArea;
      const daysMap = res.fields.days?.mapValue?.fields || {};
      const dayData = daysMap[day]?.mapValue?.fields || {};
      fn = dayData.fn?.stringValue || fn;
      an = dayData.an?.stringValue || an;
    }
  } catch (e) {
    console.warn(`Firestore read warning:`, e.message);
  }

  return { formattedDate, dayName, fn, an, officerName, phiArea };
}

// 1. Morning Dual Schedule Reminder
async function sendMorningDualDutyReminder(today) {
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const todayInfo = await getDutyForDate(today);
  const tomorrowInfo = await getDutyForDate(tomorrow);

  const tgMessage = `📋 <b>PHI DUTY REMINDER (Health 510)</b>
👤 <b>Officer:</b> ${todayInfo.officerName} | ${todayInfo.phiArea}
━━━━━━━━━━━━━━━━━━━━

🔴 <b>TODAY'S SCHEDULE</b>
📅 <b>Date:</b> ${todayInfo.formattedDate} (${todayInfo.dayName})
🌅 <b>FN:</b> ${todayInfo.fn}
🌇 <b>AN:</b> ${todayInfo.an}

━━━━━━━━━━━━━━━━━━━━

🟢 <b>TOMORROW'S SCHEDULE</b>
📅 <b>Date:</b> ${tomorrowInfo.formattedDate} (${tomorrowInfo.dayName})
🌅 <b>FN:</b> ${tomorrowInfo.fn}
🌇 <b>AN:</b> ${tomorrowInfo.an}

━━━━━━━━━━━━━━━━━━━━
👉 <a href="${APP_URL}"><b>Pocket Note Book (Health 253) එකේ සටහන් කිරීමට App එක විවෘත කරන්න</b></a>`;

  const subject = `🔴 Today's Duty: ${todayInfo.fn.substring(0,25)}...`;
  await sendAlert(subject, tgMessage, true);
}

// 2. Evening Tomorrow-Only Brief
async function sendEveningTomorrowSchedule(today) {
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowInfo = await getDutyForDate(tomorrow);

  const tgMessage = `🌇 <b>EVENING BRIEF: TOMORROW'S SCHEDULE (Health 510)</b>
👤 <b>Officer:</b> ${tomorrowInfo.officerName} | ${tomorrowInfo.phiArea}
━━━━━━━━━━━━━━━━━━━━

🟢 <b>TOMORROW'S DUTY PLAN</b>
📅 <b>Date:</b> ${tomorrowInfo.formattedDate} (${tomorrowInfo.dayName})

🌅 <b>FN:</b> ${tomorrowInfo.fn}
🌇 <b>AN:</b> ${tomorrowInfo.an}

━━━━━━━━━━━━━━━━━━━━
<i>හෙට දින රාජකාරි සඳහා අවශ්‍ය ලිපිලේඛන හා සැලසුම් සූදානම් කරගන්න.</i>`;

  const subject = `🟢 Tomorrow's Duty: ${tomorrowInfo.fn.substring(0,25)}...`;
  await sendAlert(subject, tgMessage, true);
}

// 3. Official Reminders Bundle
async function sendMorningOfficialReminders(today, day, monthIndex, dayOfWeek) {
  if ([25, 1, 2, 3, 4, 5].includes(day)) {
    const tgMsg = `🔴 <b>CRITICAL REMINDER: OT / CLAIMS SUBMISSION</b>
━━━━━━━━━━━━━━━━━━━━
📌 <b>කරුණාකර පහත ලේඛන කඩිනමින් සකස් කර MOH කාර්යාලය වෙත ඉදිරිපත් කරන්න:</b>
1. Monthly OT/Claim/Off Pay Form
2. Petrol Claim Form
3. Advance Request Letters`;
    await sendAlert("⚠️ URGENT: OT & Claims Submission Due", tgMsg);
  }

  if ([1, 2, 3, 4, 5].includes(day)) {
    const tgMsg = `📊 <b>MONTHLY REPORT SUBMISSION REMINDER (Day ${day}/05)</b>
━━━━━━━━━━━━━━━━━━━━
පහත මාසික වාර්තා <b>eRHMIS System</b> එකට Update කර <b>Hard Copy</b> සකස් කර භාරදීමට කටයුතු කරන්න:
📋 01. H 631 Part 02 (Monthly Report)
🏫 02. H 1014 (School Monthly Return)`;
    await sendAlert("📊 Reminder: Monthly Report Submissions", tgMsg);
  }

  if (day === 1) {
    const tgMsg = `🏫 <b>H 1247: SCHOOL MEDICAL INSPECTION (SMI) CHECK</b>
━━━━━━━━━━━━━━━━━━━━
❓ Are you Updated / Completed the eRHMIS System for SMI?`;
    await sendAlert("🏫 SMI Update Check", tgMsg);
  }

  if ([22, 23, 24].includes(day)) {
    const nextMonthObj = new Date(today);
    nextMonthObj.setMonth(today.getMonth() + 1);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const nextMonthName = monthNames[nextMonthObj.getMonth()];

    const tgMsg = `⚠️ <b>H 510 MONTHLY ADVANCE PROGRAMME SUBMISSION</b>
━━━━━━━━━━━━━━━━━━━━
📅 <b>ඉලක්කගත මාසය:</b> ${nextMonthName} ${nextMonthObj.getFullYear()}
ලබන මස H 510 Advance Programme එක 25 වන දිනට පෙර Approval සඳහා යොමු කළ යුතුය.`;
    await sendAlert(`⚠️ Reminder: ${nextMonthName} Advance Programme (H 510) Due`, tgMsg, true);
  }

  const isQ1 = [0, 1, 2].includes(monthIndex);
  const isMonday = dayOfWeek === 1;
  if (isQ1) {
    let shouldTrigger = false;
    if ((monthIndex === 0 || monthIndex === 1) && isMonday) shouldTrigger = true;
    else if (monthIndex === 2) shouldTrigger = true;

    if (shouldTrigger) {
      const tgMsg = `📈 <b>Q1 ANNUAL & SURVEY REPORT REMINDER</b>
━━━━━━━━━━━━━━━━━━━━
1. 📊 H 631 Part 01 - Annual Report (eRHMIS + Hard Copy)
2. 🏫 H 1015 - Sanitary Survey (eRHMIS + Hard Copy)`;
      await sendAlert("📈 Q1 Annual & Sanitary Survey Reports Reminder", tgMsg);
    }
  }
}

// ================= MAIN RUNNER =================
async function main() {
  const manualSlot = process.env.TRIGGER_SLOT;
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Colombo" }));
  const hour = now.getHours();
  const day = now.getDate();
  const monthIndex = now.getMonth();
  const dayOfWeek = now.getDay();

  console.log(`[SL Time: ${now.toLocaleTimeString()}] Target Slot: ${manualSlot || 'AUTO'}`);

  try {
    if (manualSlot === "MORNING_0700") {
      await sendMorningDualDutyReminder(now);
      await sendMorningOfficialReminders(now, day, monthIndex, dayOfWeek);
    } else if (manualSlot === "EVENING_1800") {
      await sendEveningTomorrowSchedule(now);
    } else if (manualSlot === "ALL_TEST") {
      await sendMorningDualDutyReminder(now);
      await sendMorningOfficialReminders(now, day, monthIndex, dayOfWeek);
      await sendEveningTomorrowSchedule(now);
    } else {
      if (hour >= 16 && hour <= 21) {
        await sendEveningTomorrowSchedule(now);
      } else {
        await sendMorningDualDutyReminder(now);
        await sendMorningOfficialReminders(now, day, monthIndex, dayOfWeek);
      }
    }
    console.log("Completed successfully!");
  } catch (err) {
    console.error("Execution error:", err);
  }
}

main();
