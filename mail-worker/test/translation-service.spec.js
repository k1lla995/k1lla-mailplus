import { describe, expect, it } from 'vitest';
import { parseTranslation, responseFormats } from '../src/translation/translation-service';

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
		expect(parseTranslation('第一行\\n第二行', source)?.text).toBe('第一行\n第二行');
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
		expect(parseTranslation('{"subject":"欢迎","body":"抱歉，我似乎无法就此话题进行聊天。"}', source)).toBeNull();
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
