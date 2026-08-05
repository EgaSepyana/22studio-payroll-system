import * as shortLinkService from '../services/shortLinkService.js';

// A human clicks this link directly in a browser, so an unknown/expired code
// gets a plain readable page instead of a JSON error response.
export async function redirect(req, res, next) {
  try {
    const originalUrl = await shortLinkService.resolveShortLink(req.params.code);
    if (!originalUrl) {
      res.status(404).send('Link tidak ditemukan atau sudah tidak berlaku.');
      return;
    }
    res.redirect(302, originalUrl);
  } catch (err) {
    next(err);
  }
}
