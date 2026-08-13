import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

const BASE_URL = 'http://example.com/api';
const JWT_SECRET = 'b7f29a1d-18e2-4d3b-941f-f6b2c97c02fd';
const WEBHOOK_SECRET = 'whsec_AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA=';

function bytesToBase64(bytes) {
	let binary = '';
	for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
	return btoa(binary);
}

async function signedHeaders(payload) {
	const id = 'msg_test_resend_webhook';
	const timestamp = Math.floor(Date.now() / 1000).toString();
	const secret = Uint8Array.from(atob(WEBHOOK_SECRET.slice('whsec_'.length)), char => char.charCodeAt(0));
	const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const input = new TextEncoder().encode(`${id}.${timestamp}.${payload}`);
	const signature = await crypto.subtle.sign('HMAC', key, input);

	return {
		'svix-id': id,
		'svix-timestamp': timestamp,
		'svix-signature': `v1,${bytesToBase64(signature)}`
	};
}

describe('Resend webhook verification', () => {
	it('rejects forged events and accepts valid Svix signatures', async () => {
		await SELF.fetch(`${BASE_URL}/init/${JWT_SECRET}`);
		const resendEmailId = 'resend-email-webhook-test';
		await env.db.prepare(
			'INSERT INTO email (account_id, user_id, type, status, resend_email_id) VALUES (?, ?, ?, ?, ?)'
		).bind(0, 0, 1, 1, resendEmailId).run();

		const payload = JSON.stringify({ type: 'email.delivered', data: { email_id: resendEmailId } });
		const forged = await SELF.fetch(`${BASE_URL}/webhooks`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: payload
		});
		expect(forged.status).toBe(401);

		let email = await env.db.prepare('SELECT status FROM email WHERE resend_email_id = ?').bind(resendEmailId).first();
		expect(email.status).toBe(1);

		const verified = await SELF.fetch(`${BASE_URL}/webhooks`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...await signedHeaders(payload) },
			body: payload
		});
		expect(verified.status).toBe(200);

		email = await env.db.prepare('SELECT status FROM email WHERE resend_email_id = ?').bind(resendEmailId).first();
		expect(email.status).toBe(2);
	});
});
