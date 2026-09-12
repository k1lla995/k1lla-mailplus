import { describe, expect, it, vi } from 'vitest';
import { parseHTML } from 'linkedom';
import emailUtils from '../src/utils/email-utils';
import translationService, {
	buildTranslationResult,
	createTranslationSource,
	parseTranslation,
	responseFormats,
	splitTranslationChunks
} from '../src/translation/translation-service';

function configContext(row) {
	return {
		env: {
			db: {
				prepare: () => ({
					bind: () => ({ first: async () => row })
				})
			}
		}
	};
}

describe('translation provider model discovery', () => {
	it('loads and normalizes models from an OpenAI-compatible upstream', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 'z-model' }, { id: 'a-model' }, { id: 'a-model' }] }), { status: 200 }));
		await expect(translationService.listModels(configContext(null), 1, {
			provider: 'custom', baseUrl: 'https://example.com/v1', apiKey: 'test-key'
		})).resolves.toEqual({ models: ['a-model', 'z-model'] });
		expect(fetchMock).toHaveBeenCalledWith('https://example.com/v1/models', expect.objectContaining({ method: 'GET', headers: expect.objectContaining({ authorization: 'Bearer test-key' }) }));
		fetchMock.mockRestore();
	});

	it('uses Anthropic model-list authentication and endpoint', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 'claude-current' }] }), { status: 200 }));
		await expect(translationService.listModels(configContext(null), 1, {
			provider: 'anthropic', baseUrl: 'https://api.anthropic.com', apiKey: 'test-key'
		})).resolves.toEqual({ models: ['claude-current'] });
		expect(fetchMock).toHaveBeenCalledWith('https://api.anthropic.com/v1/models', expect.objectContaining({ headers: expect.objectContaining({ 'x-api-key': 'test-key' }) }));
		fetchMock.mockRestore();
	});

	it.each(['deepseek', 'mimo', 'anthropic'])('does not hardcode a %s model', async provider => {
		const baseRow = {
			provider,
			base_url: '',
			default_target_language: 'Chinese',
			api_key_cipher: 'saved-key'
		};

		await expect(translationService.getConfig(configContext({ ...baseRow, model: '' }), 1))
			.resolves.toMatchObject({ provider, model: '' });
	});
});

describe('translation response parsing', () => {
	const source = { subject: 'Welcome', text: 'Please verify your account.' };

	it('accepts a complete structured translation', () => {
		expect(parseTranslation('{"subject":"欢迎","body":"请验证您的帐户。"}', source)).toEqual({
			subject: '欢迎',
			text: '请验证您的帐户。'
		});
	});

	it('accepts parsed objects and common gateway field aliases', () => {
		expect(parseTranslation({ translated_subject: '欢迎', translated_body: '请验证您的帐户。' }, source)).toEqual({
			subject: '欢迎',
			text: '请验证您的帐户。'
		});
		expect(parseTranslation('请验证您的帐户。', source)).toEqual({
			subject: source.subject,
			text: '请验证您的帐户。'
		});
		expect(parseTranslation('第一行\n第二行', source)?.text).toBe('第一行\n第二行');
		expect(parseTranslation('翻译结果如下：\nBody: 请验证您的帐户。', source)?.text).toBe('翻译结果如下：\nBody: 请验证您的帐户。');
	});

	it('preserves literal escape sequences in translated content', () => {
		const body = String.raw`const value = "quoted";\nconst tab = \t;\nconst path = C:\new\test;`;
		const result = parseTranslation(JSON.stringify({ subject: 'Welcome', body }), source);
		expect(result?.text).toBe(body);
		expect(parseTranslation(String.raw`Code: \n\t\"`, source)?.text).toBe(String.raw`Code: \n\t\"`);
	});

	it('rejects the common English refusal fallback', () => {
		expect(parseTranslation("Sorry, I can't respond to that. Let's try another topic.", source)).toBeNull();
		expect(parseTranslation('{"subject":"Welcome","body":"很抱歉，我似乎无法对此做出响应。让我们尝试其他主题"}', source)).toBeNull();
	});

	it('decodes a JSON-encoded JSON object but rejects malformed JSON fragments', () => {
		expect(parseTranslation(JSON.stringify('{"subject":"欢迎","body":"请验证您的帐户。"}'), source)).toEqual({
			subject: '欢迎',
			text: '请验证您的帐户。'
		});
		expect(parseTranslation('{"subject":"欢迎","body":"请验证您的帐户。"}{"subject":"欢迎"}', source)).toBeNull();
	});

	it('does not pass a provider refusal through as email content', () => {
		expect(parseTranslation('抱歉，我似乎无法就此话题进行聊天。让我们尝试其他主题。', source)).toBeNull();
		expect(parseTranslation('很抱歉，我似乎无法对此做出响应。让我们尝试其他主题', source)).toBeNull();
		expect(parseTranslation('{"subject":"欢迎","body":"抱歉，我似乎无法就此话题进行聊天。"}', source)).toBeNull();
	});

	it('removes an exact duplicated response without altering normal repeated lines', () => {
		const result = parseTranslation('{"subject":"欢迎","body":"这是一段足够长的翻译内容，用于验证模型重复完整响应时的清理逻辑。\\n这是一段足够长的翻译内容，用于验证模型重复完整响应时的清理逻辑。"}', source);
		expect(result?.text).toBe('这是一段足够长的翻译内容，用于验证模型重复完整响应时的清理逻辑。');
		const repeated = parseTranslation('{"subject":"欢迎","body":"第一段\\n第一段\\n第二段\\n第二段"}', source);
		expect(repeated?.text).toBe('第一段\n第一段\n第二段\n第二段');
	});

	it('splits long source text without dropping content', () => {
		const input = '第一行\n第二行\n第三行';
		const chunks = splitTranslationChunks(input, 5);
		expect(chunks.join('\n')).toBe(input);
		expect(chunks.every(chunk => chunk.length <= 5)).toBe(true);
	});

	it('applies a structured-output fallback chain to every provider', () => {
		for (const provider of ['openai', 'deepseek', 'mimo', 'qwen', 'anthropic', 'custom']) {
			const formats = responseFormats({ provider });
			expect(formats.at(-1)).toBeNull();
			expect(formats.slice(0, -1)).toContainEqual(expect.stringMatching(/^json_(?:schema|object)$/));
		}
		expect(responseFormats({ provider: 'openai' })).toEqual(['json_schema', 'json_object', null]);
		expect(responseFormats({ provider: 'anthropic' })).toEqual(['json_schema', null]);
	});
});

describe('HTML email translation', () => {
	it('rebuilds translated text into the original HTML without changing links or layout', () => {
		const href = 'https://example.com/verify?token=abc&lang=en';
		const html = `<table role="presentation" style="width:600px"><tbody><tr><td><a href="${href.replace('&', '&amp;')}" style="display:inline-block;background:#1264a3;color:#fff">Verify <strong>now</strong></a></td><td><img src="https://example.com/logo.png" width="120" alt="Logo"></td></tr></tbody></table><div style="display:none">Hidden preheader</div>`;
		const source = createTranslationSource('Welcome', html);

		expect(source.segments.map(segment => segment.text)).toEqual(['Verify', 'now']);
		const translated = parseTranslation(JSON.stringify({
			subject: '欢迎',
			segments: source.segments.map(segment => ({
				id: segment.id,
				text: segment.text === 'Verify' ? '验证' : '现在'
			}))
		}), source);
		const result = buildTranslationResult(source, translated);
		const { document } = parseHTML(`<!DOCTYPE html><html><body>${result.html}</body></html>`);
		const link = document.querySelector('a');

		expect(result.subject).toBe('欢迎');
		expect(link.getAttribute('href')).toBe(href);
		expect(link.getAttribute('style')).toBe('display:inline-block;background:#1264a3;color:#fff');
		expect(link.textContent).toBe('验证 现在');
		expect(document.querySelector('table').getAttribute('role')).toBe('presentation');
		expect(document.querySelector('img').getAttribute('src')).toBe('https://example.com/logo.png');
		expect(document.querySelector('div').textContent).toBe('Hidden preheader');
		expect(result.text).toContain(`<${href}>`);
	});

	it('rejects incomplete segment responses instead of dropping HTML text', () => {
		const source = createTranslationSource('Welcome', '<p>Hello <a href="https://example.com">account</a></p>');
		const incomplete = JSON.stringify({ subject: '欢迎', segments: [{ id: 0, text: '你好' }] });
		expect(parseTranslation(incomplete, source)).toBeNull();
	});

	it('keeps link destinations in the plain-text HTML fallback', () => {
		expect(emailUtils.htmlToText('<p>Open <a href="https://example.com/reset">your account</a>.</p>'))
			.toContain('your account <https://example.com/reset>');
	});
});
