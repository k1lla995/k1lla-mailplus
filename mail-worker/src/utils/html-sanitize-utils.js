import { parseHTML } from 'linkedom';

const FORBIDDEN_TAGS = [
	'script', 'style', 'iframe', 'object', 'embed', 'base', 'meta', 'form',
	'input', 'button', 'textarea', 'select', 'option', 'svg', 'math'
];

const URL_ATTRIBUTES = new Set([
	'href', 'src', 'action', 'formaction', 'poster', 'background', 'xlink:href'
]);

function isSafeUrl(value, attributeName, tagName) {
	const normalized = String(value || '').replace(/[\u0000-\u0020\u007f]+/g, '').toLowerCase();

	if (!normalized || normalized.startsWith('#') || normalized.startsWith('/') || normalized.startsWith('./') || normalized.startsWith('../')) {
		return true;
	}

	if (normalized.startsWith('data:')) {
		return tagName === 'img' && attributeName === 'src' && /^data:image\/(?:png|gif|jpe?g|webp|bmp);/i.test(normalized);
	}

	return /^(?:https?|mailto|tel|cid):/i.test(normalized);
}

function containsUnsafeCss(value) {
	return /(?:expression\s*\(|javascript\s*:|behavior\s*:|-moz-binding\s*:|@import)/i.test(value);
}

export function sanitizeEmailHtml(html) {
	const { document } = parseHTML(String(html || ''));

	document.querySelectorAll(FORBIDDEN_TAGS.join(',')).forEach(element => element.remove());

	document.querySelectorAll('*').forEach(element => {
		const tagName = element.localName?.toLowerCase() || '';

		Array.from(element.attributes || []).forEach(attribute => {
			const name = attribute.name.toLowerCase();
			const value = attribute.value || '';

			if (name.startsWith('on') || name === 'srcdoc' || name === 'formaction') {
				element.removeAttribute(attribute.name);
				return;
			}

			if (URL_ATTRIBUTES.has(name) && !isSafeUrl(value, name, tagName)) {
				element.removeAttribute(attribute.name);
				return;
			}

			if (name === 'style' && containsUnsafeCss(value)) {
				element.removeAttribute(attribute.name);
			}
		});

		if (tagName === 'a') {
			element.setAttribute('rel', 'noopener noreferrer');
		}
	});

	return document.toString();
}
