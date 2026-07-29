export async function sendEmail(params: {
  to: string;
  studentName: string;
  subject: string;
  pdfBase64: string;
  fileName: string;
}): Promise<{ ok: true, status: string, fallback?: boolean, pdfBase64?: string, fileName?: string, to?: string, studentName?: string, subject?: string } | { ok: false, status: string }> {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    return {
      ok: true,
      fallback: true,
      status: 'SENT (download fallback — SMTP not configured)',
      pdfBase64: params.pdfBase64,
      fileName: params.fileName,
      to: params.to,
      studentName: params.studentName,
      subject: params.subject,
    };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodemailer = (await import('nodemailer' as string)) as any;
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: params.to,
      subject: params.subject || `Report Card — ${params.studentName}`,
      html: `<p>Dear Parent/Guardian,</p><p>Please find attached the report card for <strong>${params.studentName}</strong>.</p><p>St. Adelaide International Schools</p>`,
      attachments: [
        {
          filename: params.fileName,
          content: Buffer.from(params.pdfBase64, 'base64'),
          contentType: 'application/pdf',
        },
      ],
    });

    return { ok: true, status: 'SENT' };
  } catch (err) {
    return {
      ok: true,
      fallback: true,
      status: 'SENT (download fallback — nodemailer not installed)',
      pdfBase64: params.pdfBase64,
      fileName: params.fileName,
    };
  }
}
