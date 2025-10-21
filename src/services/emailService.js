/**
 * Service d'envoi d'email
 * En production : intégrer un vrai service (SendGrid, AWS SES, etc.)
 */

export async function sendEmail(to, subject, htmlContent) {
  // Simulation - en production, appeler l'API du provider
  console.log(`📧 [EMAIL] Envoi vers ${to}`);
  console.log(`📧 [EMAIL] Sujet: ${subject}`);
  console.log(`📧 [EMAIL] Contenu: ${htmlContent.substring(0, 100)}...`);
  
  // Simuler un délai réseau
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return {
    success: true,
    messageId: `email_${Date.now()}`,
    provider: "simulated",
  };
}

export async function sendOTPEmail(email, otp) {
  const subject = "Votre code de vérification MOLAM ID";
  console.log(`\n🔑 [DEV] OTP pour ${email}: ${otp}\n`);
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2>Code de vérification MOLAM ID</h2>
      <p>Votre code de vérification est :</p>
      <h1 style="color: #2563eb; font-size: 32px; letter-spacing: 4px;">${otp}</h1>
      <p>Ce code expire dans 15 minutes.</p>
      <p><strong>Ne partagez jamais ce code avec qui que ce soit.</strong></p>
      <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 12px;">
        Si vous n'avez pas demandé ce code, ignorez cet email.
      </p>
    </div>
  `;
  
  return sendEmail(email, subject, html);
}