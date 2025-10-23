/**
 * Service d'envoi de SMS
 * En production : intégrer un vrai provider (Twilio, Africa's Talking, etc.)
 */

export async function sendSMS(phone, message) {
  // Simulation - en production, appeler l'API du provider
  console.log(`📱 [SMS] Envoi vers ${phone}`);
  console.log(`📱 [SMS] Message: ${message}`);
  
  // Simuler un délai réseau
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return {
    success: true,
    messageId: `sms_${Date.now()}`,
    provider: "simulated",
  };
}

export async function sendOTPSMS(phone, otp) {
  const message = `Votre code MOLAM ID est: ${otp}. Valide pendant 15 minutes. Ne le partagez jamais.`;
  return sendSMS(phone, message);
}