import { Resend } from 'resend';
import emailService from './email-service';
import { emailConst } from '../const/entity-const';
import BizError from '../error/biz-error';

const resendService = {
	verifyWebhook(c, payload) {
		const webhookSecret = c.env.RESEND_WEBHOOK_SECRET;
		if (!webhookSecret) {
			throw new BizError('Invalid Resend webhook signature', 401);
		}

		try {
			return new Resend('re_webhook_verification').webhooks.verify({
				payload,
				headers: {
					id: c.req.header('svix-id'),
					timestamp: c.req.header('svix-timestamp'),
					signature: c.req.header('svix-signature')
				},
				webhookSecret
			});
		} catch {
			throw new BizError('Invalid Resend webhook signature', 401);
		}
	},

	async webhooks(c, body) {

		const params = {
			resendEmailId: body.data.email_id,
			status: emailConst.status.SENT
		}

		if (body.type === 'email.delivered') {
			params.status = emailConst.status.DELIVERED
			params.message = null
		}

		if (body.type === 'email.complained') {
			params.status = emailConst.status.COMPLAINED
			params.message = null
		}

		if (body.type === 'email.bounced') {
			let bounce = body.data.bounce
			bounce = JSON.stringify(bounce);
			params.status = emailConst.status.BOUNCED
			params.message = bounce
		}

		if (body.type === 'email.delivery_delayed') {
			params.status = emailConst.status.DELAYED
			params.message = null
		}

		if (body.type === 'email.failed') {
			params.status = emailConst.status.FAILED
			params.message = body.data.failed.reason
		}

		const emailRow = await emailService.updateEmailStatus(c, params)

		if (!emailRow) {
			throw new BizError('更新邮件状态记录失败');
		}

	}
}

export default resendService
