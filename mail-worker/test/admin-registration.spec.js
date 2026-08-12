import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

const BASE_URL = 'http://example.com/api';
const JWT_SECRET = 'b7f29a1d-18e2-4d3b-941f-f6b2c97c02fd';

async function jsonRequest(path, init) {
	const response = await SELF.fetch(`${BASE_URL}${path}`, init);
	return response.json();
}

async function initializeDatabase() {
	const response = await SELF.fetch(`${BASE_URL}/init/${JWT_SECRET}`);
	return response.json();
}

async function login(password) {
	return jsonRequest('/login', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ email: 'admin@example.com', password })
	});
}

async function listUsers(token) {
	return jsonRequest('/user/list?num=1&size=10&status=-1&isDel=0&timeSort=0', {
		headers: { Authorization: token }
	});
}

describe('administrator account bootstrap', () => {
	it('restores public registration when the root administrator enables it', async () => {
		const initialized = await initializeDatabase();
		expect(initialized.message).toBe('success');
		expect(initialized.admin.temporaryPassword).toBeTruthy();
		const rootLogin = await login(initialized.admin.temporaryPassword);
		const rootToken = rootLogin.data.token;

		const websiteConfig = await jsonRequest('/setting/websiteConfig');
		expect(websiteConfig.data).toMatchObject({ register: 0, regKey: 1 });

		const response = await jsonRequest('/register', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email: 'member@example.com', password: 'member-password' })
		});
		expect(response.code).toBe(200);

		const { total } = await env.db.prepare(
			'SELECT COUNT(*) AS total FROM user WHERE email = ? COLLATE NOCASE'
		).bind('member@example.com').first();
		expect(total).toBe(1);

		const disabled = await jsonRequest('/setting/set', {
			method: 'PUT',
			headers: { Authorization: rootToken, 'content-type': 'application/json' },
			body: JSON.stringify({ register: 1 })
		});
		expect(disabled.code).toBe(200);

		const rejected = await jsonRequest('/register', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email: 'blocked@example.com', password: 'member-password' })
		});
		expect(rejected.code).not.toBe(200);
	});

	it('allows only the root administrator to change public registration settings', async () => {
		const initialized = await initializeDatabase();
		const rootLogin = await login(initialized.admin.temporaryPassword);
		const rootToken = rootLogin.data.token;

		const memberRegistration = await jsonRequest('/register', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email: 'member@example.com', password: 'member-password' })
		});
		expect(memberRegistration.code).toBe(200);

		const memberLogin = await jsonRequest('/login', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email: 'member@example.com', password: 'member-password' })
		});
		const memberToken = memberLogin.data.token;

		const unauthorized = await jsonRequest('/setting/set', {
			method: 'PUT',
			headers: { Authorization: memberToken, 'content-type': 'application/json' },
			body: JSON.stringify({ register: 1 })
		});
		expect(unauthorized.code).toBe(403);

		const rootUpdate = await jsonRequest('/setting/set', {
			method: 'PUT',
			headers: { Authorization: rootToken, 'content-type': 'application/json' },
			body: JSON.stringify({ regKey: 2 })
		});
		expect(rootUpdate.code).toBe(200);

		const settings = await env.db.prepare('SELECT register, reg_key AS regKey FROM setting').first();
		expect(settings).toMatchObject({ register: 0, regKey: 2 });
	});

	it('creates the administrator during the existing database initialization flow', async () => {
		const initialized = await initializeDatabase();
		expect(initialized.message).toBe('success');
		expect(initialized.admin.created).toBe(true);
		expect(initialized.admin.temporaryPassword).toHaveLength(24);

		const loginResult = await login(initialized.admin.temporaryPassword);
		expect(loginResult.code).toBe(200);
		expect(loginResult.data.token).toBeTruthy();

		const adminUser = await env.db.prepare(
			'SELECT type FROM user WHERE email = ? COLLATE NOCASE'
		).bind('admin@example.com').first();
		expect(adminUser.type).toBe(0);

		const repeatInitialization = await initializeDatabase();
		expect(repeatInitialization.admin.created).toBe(false);
		expect(repeatInitialization.admin.temporaryPassword).toBeNull();
	});

	it('does not trust an email-only legacy claimant and securely recovers the account', async () => {
		const firstInitialization = await initializeDatabase();
		const firstPassword = firstInitialization.admin.temporaryPassword;
		await env.db.prepare(
			'UPDATE user SET type = 1 WHERE email = ? COLLATE NOCASE'
		).bind('admin@example.com').run();

		const firstLogin = await login(firstPassword);
		const oldToken = firstLogin.data.token;
		const claimantAccess = await listUsers(oldToken);
		expect(claimantAccess.code).toBe(403);

		const recovered = await initializeDatabase();
		expect(recovered.admin.created).toBe(true);
		expect(recovered.admin.temporaryPassword).toHaveLength(24);

		const oldPasswordLogin = await login(firstPassword);
		expect(oldPasswordLogin.code).not.toBe(200);

		const oldSession = await jsonRequest('/my/loginUserInfo', {
			headers: { Authorization: oldToken }
		});
		expect(oldSession.code).toBe(401);

		const replacementLogin = await login(recovered.admin.temporaryPassword);
		expect(replacementLogin.code).toBe(200);

		const recoveredAccess = await listUsers(replacementLogin.data.token);
		expect(recoveredAccess.code).toBe(200);
	});
});
