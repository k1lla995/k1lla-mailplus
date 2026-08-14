import app from '../hono/hono';
import result from '../model/result';
import userContext from '../security/user-context';
import translationService from '../translation/translation-service';

app.get('/translation/config', async c => {
	return c.json(result.ok(await translationService.getConfig(c, userContext.getUserId(c))));
});

app.put('/translation/config', async c => {
	return c.json(result.ok(await translationService.saveConfig(c, userContext.getUserId(c), await c.req.json())));
});

app.post('/translation/translate', async c => {
	return c.json(result.ok(await translationService.translate(c, userContext.getUserId(c), await c.req.json())));
});
