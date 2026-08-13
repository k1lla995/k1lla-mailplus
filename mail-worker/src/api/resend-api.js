import resendService from '../service/resend-service';
import app from '../hono/hono';
app.post('/webhooks', async (c) => {
	try {
		const body = await c.req.text();
		const event = resendService.verifyWebhook(c, body);
		await resendService.webhooks(c, event);
		return c.text('success', 200);
	} catch (e) {
		return c.text(e.code === 401 ? 'Unauthorized' : e.message, e.code || 500);
	}
});
