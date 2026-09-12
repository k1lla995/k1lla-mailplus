import http from '@/axios/index.js';

export function translationConfig() {
  return http.get('/translation/config', { noMsg: true });
}

export function translationSaveConfig(config) {
	return http.put('/translation/config', config, { noMsg: true });
}

export function translationModels(config) {
	return http.post('/translation/models', config, { noMsg: true, timeout: 30 * 1000 });
}

export function translationTranslate(payload) {
  return http.post('/translation/translate', payload, { noMsg: true, timeout: 60 * 1000 });
}
