import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return { apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email };
}

export async function getUncachableResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

export async function sendAdminApprovalNotification(
  adminEmail: string,
  pendingUser: { firstName: string; lastName: string; email: string; id: string }
) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    const result = await client.emails.send({
      from: fromEmail || 'JACE CRM <noreply@resend.dev>',
      to: adminEmail,
      subject: 'New User Registration Pending Approval - JACE CRM',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">New User Registration Request</h2>
          <p>A new user has requested to create an account on JACE CRM:</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Name:</strong> ${pendingUser.firstName} ${pendingUser.lastName}</p>
            <p><strong>Email:</strong> ${pendingUser.email}</p>
            <p><strong>Request ID:</strong> ${pendingUser.id}</p>
          </div>
          <p>Please log in to the admin portal to approve or reject this request.</p>
          <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
            This is an automated message from JACE CRM.
          </p>
        </div>
      `
    });
    
    console.log('Admin notification email sent:', result);
    return { success: true, result };
  } catch (error) {
    console.error('Failed to send admin notification email:', error);
    return { success: false, error };
  }
}

export async function sendPinToUser(
  userEmail: string,
  userName: string,
  pin: string
) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    const result = await client.emails.send({
      from: fromEmail || 'JACE CRM <noreply@resend.dev>',
      to: userEmail,
      subject: 'Your Registration Has Been Approved - JACE CRM',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Registration Approved!</h2>
          <p>Hello ${userName},</p>
          <p>Your JACE CRM account registration has been approved by an administrator.</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="margin-bottom: 10px;">Your unique PIN code is:</p>
            <p style="font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 8px;">${pin}</p>
          </div>
          <p>Use this PIN to complete your account registration. This PIN is unique and can only be used once.</p>
          <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
            This is an automated message from JACE CRM.
          </p>
        </div>
      `
    });
    
    console.log('PIN email sent to user:', result);
    return { success: true, result };
  } catch (error) {
    console.error('Failed to send PIN email:', error);
    return { success: false, error };
  }
}
