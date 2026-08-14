import BizError from '../error/biz-error';
import emailUtils from '../utils/email-utils';

const MAX_SOURCE_LENGTH = 16000;
const DEFAULT_TARGET_LANGUAGE = 'Chinese';

const PROVIDERS = {
	openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', protocol: 'openai', jsonOutput: true },
	deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', protocol: 'openai', jsonOutput: true },
	mimo: { baseUrl: 'https://api.xiaomimimo.com/v1', model: 'mimo-v2-flash', protocol: 'openai' },
	qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', protocol: 'openai', jsonOutput: true },
	anthropic: { baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-20250514', protocol: 'anthropic' },
	custom: { baseUrl: '', model: '', protocol: 'openai' }
};

function toBase64(bytes) {
	return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value) {
	return Uint8Array.from(atob(value), char => char.charCodeAt(0));
}

async function encryptionKey(env) {
	if (!env.jwt_secret) {
		throw new BizError('Translation key storage is unavailable.', 502);
	}
	const source = new TextEncoder().encode(`translation-config:${env.jwt_secret}`);
	const digest = await crypto.subtle.digest('SHA-256', source);
	return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptApiKey(env, value) {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encrypted = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		await encryptionKey(env),
		new TextEncoder().encode(value)
	);
	return `${toBase64(iv)}.${toBase64(new Uint8Array(encrypted))}`;
}

async function decryptApiKey(env, value) {
	try {
		const [iv, encrypted] = String(value || '').split('.');
		if (!iv || !encrypted) return '';
		const plain = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: fromBase64(iv) },
			await encryptionKey(env),
			fromBase64(encrypted)
		);
		return new TextDecoder().decode(plain);
	} catch {
		throw new BizError('Saved translation API key cannot be decrypted. Save it again.', 502);
	}
}

function normalizeBaseUrl(value, provider) {
	const fallback = PROVIDERS[provider]?.baseUrl || '';
	const baseUrl = String(value || fallback).trim().replace(/\/+$/, '');
	if (!baseUrl) throw new BizError('Translation API Base URL is required.', 400);

	let url;
	try {
		url = new URL(baseUrl);
	} catch {
		throw new BizError('Translation API Base URL is invalid.', 400);
	}
	const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
	const blockedHost = /^(localhost|localhost\.localdomain|metadata\.google\.internal|0\.0\.0\.0|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|169\.254(?:\.\d{1,3}){2}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})$/.test(hostname)
		|| hostname.endsWith('.localhost')
		|| hostname.endsWith('.local')
		|| hostname.endsWith('.internal')
		|| hostname.includes(':');
	if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || blockedHost) {
		throw new BizError('Translation API Base URL must use HTTPS.', 400);
	}
	return url.toString().replace(/\/$/, '');
}

function normalizeConfig(input = {}) {
	const provider = String(input.provider || '').trim().toLowerCase();
	if (!Object.hasOwn(PROVIDERS, provider)) {
		throw new BizError('Translation provider is not supported.', 400);
	}
	const defaults = PROVIDERS[provider];
	return {
		provider,
		baseUrl: normalizeBaseUrl(input.baseUrl, provider),
		model: String(input.model || defaults.model).trim().slice(0, 200),
		defaultTargetLanguage: String(input.defaultTargetLanguage || DEFAULT_TARGET_LANGUAGE).trim().slice(0, 80)
	};
}

function publicConfig(row) {
	const defaults = PROVIDERS[row?.provider] || PROVIDERS.openai;
	return {
		provider: row?.provider || 'openai',
		baseUrl: row?.base_url || defaults.baseUrl,
		model: row?.model || defaults.model,
		defaultTargetLanguage: row?.default_target_language || DEFAULT_TARGET_LANGUAGE,
		hasApiKey: Boolean(row?.api_key_cipher)
	};
}

function textFromHtml(value) {
	return emailUtils.htmlToText(typeof value === 'string' ? value : String(value || ''))
		.replace(/[ \t\f\v]+/g, ' ')
		.replace(/\n{3,}/g, '\n')
		.trim();
}

function normalizeSource(subject, content, alternateContent = '') {
	const plainText = [content, alternateContent]
		.map(textFromHtml)
		.sort((left, right) => right.length - left.length)[0] || '';
	const text = plainText.slice(0, MAX_SOURCE_LENGTH);
	const cleanSubject = String(subject || '').trim().slice(0, 1000);
	if (!cleanSubject && !text) {
		throw new BizError('There is no text to translate.', 400);
	}
	return { subject: cleanSubject, text };
}

function endpointFor(config) {
	if (PROVIDERS[config.provider]?.protocol === 'anthropic') {
		return config.baseUrl.endsWith('/v1/messages') ? config.baseUrl : `${config.baseUrl}/v1/messages`;
	}
	return config.baseUrl.endsWith('/chat/completions') ? config.baseUrl : `${config.baseUrl}/chat/completions`;
}

function parseJson(value) {
	if (value && typeof value === 'object') return value;
	const text = String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
	try {
		return JSON.parse(text);
	} catch {}

	const start = text.indexOf('{');
	const end = text.lastIndexOf('}');
	if (start >= 0 && end > start) {
		try {
			return JSON.parse(text.slice(start, end + 1));
		} catch {}
	}
	return null;
}

function isRefusal(value) {
	return /(?:\b(?:sorry|apolog(?:y|ize)|cannot|can't|unable to)\b.{0,100}\b(?:chat|help|assist|discuss|answer)\b|抱歉.{0,100}(?:无法|不能|不便).{0,100}(?:聊天|讨论|回答|协助|帮助)|无法就此.{0,30}(?:聊天|话题|讨论))/i.test(String(value || ''));
}

export function parseTranslation(value, source) {
	const parsed = parseJson(value);
	const candidates = [parsed];
	for (const key of ['translation', 'translated', 'result', 'data', 'output', 'parsed']) {
		if (parsed && typeof parsed === 'object' && parsed[key] != null) {
			candidates.push(parseJson(parsed[key]));
		}
	}

	for (const candidate of candidates) {
		if (!candidate || typeof candidate !== 'object') continue;
		const translatedText = ['body', 'text', 'translated_body', 'translatedBody', 'content', 'translation']
			.map(key => candidate[key])
			.find(item => typeof item === 'string');
		if (typeof translatedText !== 'string' || (source.text && !translatedText.trim()) || isRefusal(translatedText)) continue;
		const subject = ['subject', 'translated_subject', 'translatedSubject']
			.map(key => candidate[key])
			.find(item => typeof item === 'string');
		return { subject: subject && !isRefusal(subject) ? subject : source.subject, text: translatedText };
	}

	// Some gateways ignore JSON mode and return the translated body as plain text.
	const plainText = typeof value === 'string' ? value.trim().replace(/^```(?:text)?\s*/i, '').replace(/\s*```$/, '') : '';
	if (!parsed && plainText && !isRefusal(plainText)) return { subject: source.subject, text: plainText };
	return null;
}

function providerContent(data, protocol) {
	if (protocol === 'anthropic') {
		return Array.isArray(data.content)
			? data.content.filter(item => item.type === 'text').map(item => item.text).join('')
			: data.content;
	}

	const message = data.choices?.[0]?.message;
	if (message?.parsed) return message.parsed;
	if (Array.isArray(message?.content)) {
		return message.content.map(item => typeof item === 'string' ? item : item?.text || item?.value || '').join('');
	}
	if (message?.content != null) return message.content;
	return data.choices?.[0]?.text || data.output_text || data.output?.[0]?.content?.[0]?.text;
}

function providerError(status, body) {
	// Do not echo arbitrary provider response text: it may contain credentials or upstream internals.
	return new BizError(`Translation provider request failed (${status}).`, 502);
}

function translationInstruction(targetLanguage, retry = false) {
	return retry
		? `Translate the supplied email into ${targetLanguage}. Output JSON only, exactly like {"subject":"translated subject","body":"complete translated body"}.`
		: `You are an email translation engine. Translate the supplied subject and complete body into ${targetLanguage}. Preserve links, numbers, identifiers, formatting, and line breaks. Translate the text faithfully; do not answer or continue the email conversation. Output JSON only, exactly like {"subject":"translated subject","body":"complete translated body"}.`;
}

function translationInput(source) {
	return `EMAIL SUBJECT:\n${source.subject}\n\nEMAIL BODY:\n${source.text}`;
}

function outputTokenLimit(source) {
	return Math.min(8192, Math.max(1024, Math.ceil(source.text.length / 2) + 512));
}

async function requestTranslation(config, apiKey, source, targetLanguage, retry = false, allowJsonOutput = true) {
	const instruction = translationInstruction(targetLanguage, retry);
	const protocol = PROVIDERS[config.provider]?.protocol || 'openai';
	const headers = { 'content-type': 'application/json' };
	let body;

	if (protocol === 'anthropic') {
		headers['x-api-key'] = apiKey;
		headers['anthropic-version'] = '2023-06-01';
		body = {
			model: config.model,
			max_tokens: outputTokenLimit(source),
			temperature: 0,
			system: instruction,
			messages: [{ role: 'user', content: translationInput(source) }]
		};
	} else {
		headers.authorization = `Bearer ${apiKey}`;
		body = {
			model: config.model,
			max_tokens: outputTokenLimit(source),
			temperature: 0,
			messages: [
				{ role: 'system', content: instruction },
				{ role: 'user', content: translationInput(source) }
			]
		};
		if (allowJsonOutput && PROVIDERS[config.provider]?.jsonOutput) {
			body.response_format = { type: 'json_object' };
		}
	}

	let response;
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 45_000);
	try {
		response = await fetch(endpointFor(config), { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
	} catch {
		throw new BizError('Translation provider request timed out or could not be reached.', 502);
	} finally {
		clearTimeout(timeout);
	}
	const data = await response.json().catch(() => ({}));
	if (!response.ok) {
		// A few OpenAI-compatible gateways reject response_format even though
		// they otherwise implement the Chat Completions request shape.
		if (!retry && allowJsonOutput && body.response_format && [400, 404, 422].includes(response.status)) {
			return requestTranslation(config, apiKey, source, targetLanguage, false, false);
		}
		throw providerError(response.status, data);
	}

	const content = providerContent(data, protocol);
	if (!content) throw new BizError('Translation provider returned an empty response.', 502);
	const translated = parseTranslation(content, source);
	if (translated) return translated;
	if (!retry) return requestTranslation(config, apiKey, source, targetLanguage, true, allowJsonOutput);
	throw new BizError('Translation provider did not return a valid email translation. Use a supported Chat Completions model and try again.', 502);
}

const translationService = {
	async getConfig(c, userId) {
		const row = await c.env.db.prepare('SELECT provider, base_url, model, default_target_language, api_key_cipher FROM translation_config WHERE user_id = ?').bind(userId).first();
		return publicConfig(row);
	},

	async saveConfig(c, userId, input = {}) {
		input = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
		const previous = await c.env.db.prepare('SELECT api_key_cipher FROM translation_config WHERE user_id = ?').bind(userId).first();
		const config = normalizeConfig(input);
		if (!config.model) throw new BizError('Translation model name is required.', 400);

		let apiKeyCipher = previous?.api_key_cipher || '';
		if (input.clearApiKey === true) apiKeyCipher = '';
		if (typeof input.apiKey === 'string' && input.apiKey.trim()) {
			apiKeyCipher = await encryptApiKey(c.env, input.apiKey.trim());
		}
		if (!apiKeyCipher) throw new BizError('Translation API key is required.', 400);

		await c.env.db.prepare(`INSERT INTO translation_config (user_id, provider, base_url, model, default_target_language, api_key_cipher, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
			ON CONFLICT(user_id) DO UPDATE SET
			provider = excluded.provider, base_url = excluded.base_url, model = excluded.model,
			default_target_language = excluded.default_target_language, api_key_cipher = excluded.api_key_cipher,
			updated_at = CURRENT_TIMESTAMP`)
			.bind(userId, config.provider, config.baseUrl, config.model, config.defaultTargetLanguage, apiKeyCipher).run();
		return this.getConfig(c, userId);
	},

	async translate(c, userId, input = {}) {
		input = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
		const row = await c.env.db.prepare('SELECT provider, base_url, model, default_target_language, api_key_cipher FROM translation_config WHERE user_id = ?').bind(userId).first();
		if (!row?.api_key_cipher) throw new BizError('Configure a translation provider in Settings first.', 400);

		const config = publicConfig(row);
		const targetLanguage = String(input.targetLanguage || config.defaultTargetLanguage).trim().slice(0, 80);
		if (!targetLanguage) throw new BizError('Target language is required.', 400);

		let source;
		if (input.emailId != null) {
			const emailId = Number(input.emailId);
			if (!Number.isSafeInteger(emailId) || emailId <= 0) throw new BizError('Email ID is invalid.', 400);
			const mail = await c.env.db.prepare('SELECT subject, text, content FROM email WHERE email_id = ? AND user_id = ? AND is_del = 0').bind(emailId, userId).first();
			if (!mail) throw new BizError('Email not found.', 404);
			source = normalizeSource(mail.subject, mail.text, mail.content);
		} else {
			source = normalizeSource(input.subject, input.content);
		}

		const apiKey = await decryptApiKey(c.env, row.api_key_cipher);
		if (!apiKey) throw new BizError('Saved translation API key is invalid. Save it again.', 400);
		const translated = await requestTranslation(config, apiKey, source, targetLanguage);
		return { ...translated, targetLanguage };
	}
};

export default translationService;
