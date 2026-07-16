import domainUtils from '../utils/domain-uitls';
import { sanitizeEmailHtml } from '../utils/html-sanitize-utils';

export default function emailHtmlTemplate(html, domain) {
	html = sanitizeEmailHtml(html);
	html = html.replace(/{{domain}}/g, domainUtils.toOssDomain(domain) + '/');

	return `<!DOCTYPE html>
<html lang='en'>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <meta http-equiv='Content-Security-Policy' content="default-src 'none'; img-src https: http: data:; media-src https: http: data:; font-src https: data:; style-src 'unsafe-inline'; script-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
    <style>
        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            background: #FFF;
        }

        .content-box {
            padding: 15px 10px;
            width: 100%;
            min-height: 100vh;
            overflow: auto;
            font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            color: #13181D;
            font-size: 14px;
            line-height: 1.5;
            overflow-wrap: anywhere;
        }

        .content-html {
            width: 100%;
        }

        .content-html img {
            max-width: 100%;
            height: auto !important;
        }
    </style>
</head>
<body>
    <main class='content-box'>
        <div class='content-html'>${html}</div>
    </main>
</body>
</html>`;
}
