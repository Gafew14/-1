import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route to notify of new homework or exams
  app.post("/api/notify", async (req, res) => {
    const { title, type, subject, description, teacher, due_date, recipients } = req.body;

    const formattedDate = due_date
      ? new Date(due_date).toLocaleDateString("th-TH", {
          day: "numeric",
          month: "long",
          year: "numeric",
          weekday: "long",
          timeZone: "Asia/Bangkok",
        })
      : "ไม่มีกำหนดส่ง";

    const isExam = type === "exam";
    const typeLabel = isExam ? "📅 นัดหมายการจัดสอบ" : "📝 การบ้านใหม่";
    const accentColor = isExam ? "#7965d4" : "#2b7de9";
    const appUrl = process.env.APP_URL || "https://ai.studio/build";

    const emailsToSend: string[] = Array.isArray(recipients) && recipients.length > 0
      ? [...new Set(recipients.map(r => String(r).trim()).filter(Boolean))]
      : ["natchakorn2552@gmail.com"];

    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    const getHtmlForRecipient = (recipient: string) => `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f8fb; padding: 40px 20px; color: #19324f; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(43,91,140,0.08); border: 1px solid #e1eef8;">
          
          <!-- Banner Header -->
          <div style="background: linear-gradient(135deg, ${accentColor}, #1d4ed8); padding: 35px; text-align: center; color: white;">
            <div style="font-size: 14px; text-transform: uppercase; letter-spacing: 2px; font-weight: bold; opacity: 0.95; margin-bottom: 8px;">
              ${typeLabel}ที่แชร์จากเพื่อนๆ
            </div>
            <h1 style="font-size: 24px; margin: 0; font-weight: 700; letter-spacing: -0.5px;">
              ${title || "มีหัวข้อการเรียนเพิ่มใหม่"}
            </h1>
          </div>

          <!-- Content Details -->
          <div style="padding: 40px 35px;">
            <p style="margin-top: 0; font-size: 16px; color: #6f86a0; text-align: center;">
              ระบบสรุปการบ้านตรวจพบบันทึกการแจ้งเตือนและการจัดแจงใหม่ มีรายละเอียดดังนี้:
            </p>

            <div style="background-color: #fcfdfe; border: 1px dashed #cfe4fb; border-radius: 16px; padding: 25px; margin: 25px 0;">
              
              <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
                <tr>
                  <td style="padding: 10px 0; font-weight: bold; color: #6f86a0; width: 33%;">📚 วิชาเรียน:</td>
                  <td style="padding: 10px 0; color: #19324f; font-weight: 600;">${subject || "ไม่ระบุวิชา"}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; font-weight: bold; color: #6f86a0;">👨‍🏫 ผู้สอน/ผู้สอบ:</td>
                  <td style="padding: 10px 0; color: #19324f;">${teacher || "ไม่ระบุคุณครู"}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; font-weight: bold; color: #6f86a0;">⏰ กำหนดส่ง:</td>
                  <td style="padding: 10px 0; color: ${accentColor}; font-weight: bold;">${formattedDate}</td>
                </tr>
              </table>

              ${
                description
                  ? `
                <div style="margin-top: 20px; padding-top: 15px; border-t: 1px solid #edf2f7;">
                  <strong style="color: #6f86a0; font-size: 14px; display: block; margin-bottom: 8px;">📋 รายละเอียดงานเพิ่มเติม:</strong>
                  <div style="background-color: #fafbfc; border-radius: 8px; padding: 12px 15px; font-size: 14px; color: #475569; white-space: pre-wrap; word-wrap: break-word;">${description}</div>
                </div>
              `
                  : ""
              }
            </div>

            <!-- Call to action button -->
            <div style="text-align: center; margin-top: 35px;">
              <a href="${appUrl}" target="_blank" style="background-color: #2b7de9; color: #ffffff; text-decoration: none; padding: 14px 30px; font-size: 15px; font-weight: bold; border-radius: 14px; display: inline-block; box-shadow: 0 4px 14px rgba(43,125,233,0.3); transition: all 0.2s;">
                👉 เข้ามาทำเครื่องหมายเสร็จสิ้นแล้วที่นี่
              </a>
            </div>
            
          </div>

          <!-- Footer Area -->
          <div style="background-color: #fafbfc; border-top: 1px solid #eef3f8; padding: 25px; text-align: center; font-size: 12px; color: #94a3b8;">
            ระบบแจ้งสรุปการบ้านออนไลน์แบบเรียลไทม์ผ่าน Firebase Cloud Sync<br>
            อีเมลฉบับนี้ส่งไปยัง <strong>${recipient}</strong> โดยอัตโนมัติเนื่องจากท่านและเพื่อนๆ ติดตามรับแจ้งเตือนไว้
          </div>
          
        </div>
      </div>
    `;

    // Verify if SMTP setup is ready
    if (smtpHost && smtpUser && smtpPass && smtpUser !== "MY_EMAIL@gmail.com") {
      const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 465;

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      try {
        const sendPromises = emailsToSend.map(async (recipient) => {
          const mailOptions = {
            from: process.env.SMTP_FROM || `"สรุปการบ้าน" <${smtpUser}>`,
            to: recipient,
            subject: `✨ [ระบบสรุปการบ้าน] มีงานใหม่: ${title} (${subject || "ไม่ระบุวิชา"})`,
            html: getHtmlForRecipient(recipient),
          };
          await transporter.sendMail(mailOptions);
          console.log(`[Email Sent] Email successfully delivered to: ${recipient}`);
        });

        await Promise.all(sendPromises);

        return res.json({
          status: "success",
          delivered: true,
          recipients: emailsToSend,
          message: `ส่งอีเมลแจ้งเตือนงานใหม่ไปยังผู้ใช้งานทั้งหมด ${emailsToSend.length} อีเมลเรียบร้อยแล้ว`,
        });
      } catch (error: any) {
        console.error("[Email Error] Failed to send email via SMTP:", error);
        return res.json({
          status: "partial_success",
          delivered: false,
          recipients: emailsToSend,
          message: `เปิดฟังก์ชันแจ้งเมลสำเร็จ แต่ไม่สามารถส่งผ่าน SMTP ได้: ${error?.message || "ความผิดพลาด SMTP"}`,
        });
      }
    } else {
      // SMTP client fallback logging simulator (High quality feedback for development environments)
      console.log("\n========================================================");
      console.log(`📨 SIMULATING EMAIL NOTIFICATIONS FOR ${emailsToSend.length} USERS (SMTP NOT DECLARED)`);
      emailsToSend.forEach((recipient, idx) => {
        console.log(`[Recipient #${idx + 1}] To: ${recipient}`);
      });
      console.log(`Subject: ✨ [ระบบสรุปการบ้าน] มีงานใหม่: ${title} (${subject || "ไม่ระบุวิชา"})`);
      console.log(`Type: ${typeLabel}`);
      console.log(`Formatted Due Date: ${formattedDate}`);
      console.log(`Subject Group: ${subject || "None"}`);
      console.log(`Teacher Responsible: ${teacher || "None"}`);
      console.log(`Summary Content Payload: \n"${description || "No detail Description"}"`);
      console.log("========================================================\n");

      return res.json({
        status: "success",
        delivered: false,
        simulated: true,
        recipients: emailsToSend,
        message: `จำลองการส่งแจ้งเตือนไปยัง ${emailsToSend.join(", ")} บน Console แล้ว (กรุณาตั้งค่า SMTP ใน Secrets เพื่อรับจดหมายจริง)`,
      });
    }
  });

  // API Route to notify of upcoming tasks / exams nearing due dates
  app.post("/api/notify-upcoming", async (req, res) => {
    const { upcomingDuties, recipients } = req.body;

    const emailsToSend: string[] = Array.isArray(recipients) && recipients.length > 0
      ? [...new Set(recipients.map(r => String(r).trim()).filter(Boolean))]
      : ["natchakorn2552@gmail.com"];

    const isPlural = Array.isArray(upcomingDuties) && upcomingDuties.length > 1;
    const appUrl = process.env.APP_URL || "https://ai.studio/build";

    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    // Build the list of upcoming duties HTML rows
    let dutiesHtml = "";
    if (Array.isArray(upcomingDuties) && upcomingDuties.length > 0) {
      upcomingDuties.forEach((duty) => {
        const formattedDate = duty.due_date
          ? new Date(duty.due_date).toLocaleDateString("th-TH", {
              day: "numeric",
              month: "long",
              year: "numeric",
              weekday: "long",
              timeZone: "Asia/Bangkok",
            })
          : "ไม่มีกำหนดส่ง";

        const isExam = duty.type === "exam";
        const accent = isExam ? "#7965d4" : "#2b7de9";
        const prefix = isExam ? "📅 นัดหมายการจัดสอบ" : "📝 การบ้าน/ภารกิจ";
        const daysLeftText = duty.daysLeft === 0 ? "มีกำหนดภายในวันนี้! ⚠️" : `เหลือเวลาอีก ${duty.daysLeft} วัน ⏰`;

        dutiesHtml += `
          <div style="background-color: #fafbfc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 15px;">
            <div style="border-bottom: 1px solid #edf2f7; padding-bottom: 8px; margin-bottom: 10px;">
              <span style="font-size: 12px; font-weight: bold; color: ${accent}; background-color: ${accent}10; padding: 4px 10px; border-radius: 99px;">${prefix}</span>
              <span style="font-size: 12px; font-weight: bold; color: #e11d48; margin-left: 10px;">${daysLeftText}</span>
            </div>
            <h3 style="margin: 0 0 6px 0; font-size: 16px; color: #1e293b; font-weight: 700;">${duty.title || "ไม่ระบุหัวข้อ"}</h3>
            <p style="margin: 0; font-size: 14px; color: #64748b;">
              <strong style="color: #475569;">วิชา:</strong> ${duty.subject || "ไม่ระบุวิชา"} | 
              <strong style="color: #475569;">ครูผู้สอน:</strong> ${duty.teacher || "ไม่ระบุครู"}
            </p>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: #2b7de9; font-weight: bold;">
              ⏰ กำหนดส่ง: ${formattedDate}
            </p>
          </div>
        `;
      });
    } else {
      dutiesHtml = `<p style="text-align: center; color: #64748b; font-size: 14px;">ไม่มีงานที่ใกล้กำหนดส่งขณะนี้</p>`;
    }

    const getHtmlForRecipient = (recipient: string) => `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #fcfcfd; padding: 40px 20px; color: #1e293b; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 35px rgba(225,29,72,0.06); border: 2px solid #fee2e2;">
          
          <!-- Red Accent Header -->
          <div style="background: linear-gradient(135deg, #e11d48, #be123c); padding: 35px; text-align: center; color: white;">
            <div style="font-size: 34px; margin-bottom: 8px;">🔔</div>
            <div style="font-size: 14px; text-transform: uppercase; letter-spacing: 2px; font-weight: bold; opacity: 0.95; margin-bottom: 6px;">
              แจ้งเตือนกำหนดเวลาเร่งด่วน!
            </div>
            <h1 style="font-size: 22px; margin: 0; font-weight: 700; letter-spacing: -0.5px;">
              มีงานสรุปการบ้านหรือนัดหมายการสอบที่ใกล้ส่งแล้ว
            </h1>
          </div>
          
          <!-- Content Panel -->
          <div style="padding: 35px;">
            <p style="margin-top: 0; font-size: 15px; color: #475569; text-align: center;">
              ตรวจสอบพบว่ามีงานหรือการนัดหมายสอบที่มีกำหนดจัดส่งในอีก 0-3 วันนี้ กรุณาเตรียมตัวส่งงานให้เรียบร้อย:
            </p>

            <div style="margin: 25px 0;">
              ${dutiesHtml}
            </div>

            <!-- CTA -->
            <div style="text-align: center; margin-top: 30px;">
              <a href="${appUrl}" target="_blank" style="background-color: #e11d48; color: #ffffff; text-decoration: none; padding: 14px 30px; font-size: 15px; font-weight: bold; border-radius: 14px; display: inline-block; box-shadow: 0 4px 14px rgba(225,29,72,0.25);">
                📖 ตรวจสอบตารางทั้งหมดและแก้ไขสถานะเสร็จสิ้น
              </a>
            </div>
          </div>

          <!-- Footer Area -->
          <div style="background-color: #fafbfc; border-top: 1px solid #f1f5f9; padding: 25px; text-align: center; font-size: 12px; color: #94a3b8;">
            ระบบแจ้งสรุปการบ้านออนไลน์แบบเรียลไทม์ผ่าน Firebase Cloud Sync<br>
            อีเมลฉบับนี้ส่งไปยัง <strong>${recipient}</strong> โดยอัตโนมัติเนื่องจากท่านและเพื่อนๆ ติดตามรับแจ้งเตือนไว้
          </div>

        </div>
      </div>
    `;

    if (smtpHost && smtpUser && smtpPass && smtpUser !== "MY_EMAIL@gmail.com") {
      const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 465;
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      try {
        const sendPromises = emailsToSend.map(async (recipient) => {
          const mailOptions = {
            from: process.env.SMTP_FROM || `"เร่งด่วน! สรุปการบ้าน" <${smtpUser}>`,
            to: recipient,
            subject: `⚠️ [ด่วน] มีงาน/สอบใกล้ครบกำหนดส่ง: ${upcomingDuties?.length || 0} รายการที่ต้องเร่งดำเนินการ`,
            html: getHtmlForRecipient(recipient),
          };
          await transporter.sendMail(mailOptions);
          console.log(`[Email Sent] Upcoming Reminder successfully delivered to: ${recipient}`);
        });

        await Promise.all(sendPromises);

        return res.json({
          status: "success",
          delivered: true,
          recipients: emailsToSend,
          message: `จัดส่งอีเมลแจ้งเตือนภารกิจเร่งด่วนไปยังผู้ใช้ทั้งหมด ${emailsToSend.length} คนเรียบร้อยแล้ว`,
        });
      } catch (error: any) {
        console.error("[Email Error] Failed to send upcoming reminder via SMTP:", error);
        return res.json({
          status: "partial_success",
          delivered: false,
          recipients: emailsToSend,
          message: `ระบบไม่สามารถจัดส่งใบเตือนผ่าน SMTP ได้: ${error?.message}`,
        });
      }
    } else {
      // Simulation
      console.log("\n========================================================");
      console.log(`📨 SIMULATING UPCOMING ALERTS FOR ${emailsToSend.length} USERS (SMTP NOT DECLARED)`);
      emailsToSend.forEach((recipient, idx) => {
        console.log(`[Recipient #${idx + 1}] To: ${recipient}`);
      });
      console.log(`Subject: ⚠️ [ด่วน] มีงาน/สอบใกล้ครบกำหนดส่ง: ${upcomingDuties?.length || 0} รายการ`);
      if (Array.isArray(upcomingDuties)) {
        upcomingDuties.forEach((d, id) => {
          console.log(` - Duty #${id + 1}: [${d.type}] ${d.title} (วิชา: ${d.subject}, ส่งอีกใน ${d.daysLeft} วัน)`);
        });
      }
      console.log("========================================================\n");

      return res.json({
        status: "success",
        delivered: false,
        simulated: true,
        recipients: emailsToSend,
        message: `จำลองการส่งใบเตือนภารกิจเร่งด่วนไปยัง ${emailsToSend.join(", ")} บน Console แล้ว (กรุณาตั้งค่า SMTP ใน Secrets เพื่อส่งเมลตามนัดจริง)`,
      });
    }
  });

  // Vite development vs production layout configurations
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Fullstack Server running smoothly on http://localhost:${PORT}`);
  });
}

startServer();
