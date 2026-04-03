import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// Initialize Resend with your API key
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
    try {
        const { to, subject, message } = await request.json();

        // Security check: Don't try to send if there's no email provided!
        if (!to || !to.includes('@')) {
            return NextResponse.json({ success: false, error: 'No valid email provided' });
        }

        const data = await resend.emails.send({
            // NOTE: Until you verify a custom domain (like trustlink.com), 
            // Resend requires you to send FROM this specific onboarding address:
            from: 'TrustLink <support@trustlink.com.ng>',
            to: [to],
            subject: subject,
            html: `
                <div style="font-family: sans-serif; max-w: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                    <h2 style="color: #10b981; margin-bottom: 20px;">TrustLink Alert</h2>
                    <p style="font-size: 16px; color: #334155; line-height: 1.5;">${message}</p>
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                        <p style="font-size: 12px; color: #94a3b8;">
                            Securely processing your escrows.<br>
                            Log in to your dashboard to view full details.
                        </p>
                    </div>
                </div>
            `,
        });

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error("Resend Error:", error);
        return NextResponse.json({ success: false, error });
    }
}