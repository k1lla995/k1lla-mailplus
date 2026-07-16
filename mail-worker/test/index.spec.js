import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src';

describe('Hello World worker', () => {
	it('serves the frontend application (unit style)', async () => {
		const request = new Request('http://example.com');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('text/html');
	});

	it('serves the frontend application (integration style)', async () => {
		const response = await SELF.fetch('http://example.com');
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('text/html');
	});
});
