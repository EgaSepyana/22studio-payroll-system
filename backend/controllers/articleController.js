import { z } from 'zod';
import * as articleService from '../services/articleService.js';
import { ok, created } from '../utils/response.js';

const createSchema = z.object({
  customer_id: z.union([z.string(), z.number()]),
  article_name: z.string().min(1),
  price: z.coerce.number().positive(),
  status: z.enum(['active', 'inactive']).optional(),
});

const updateSchema = z.object({
  customer_id: z.union([z.string(), z.number()]).optional(),
  article_name: z.string().min(1).optional(),
  price: z.coerce.number().positive().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export async function list(req, res, next) {
  try {
    ok(res, await articleService.listArticles());
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    created(res, await articleService.createArticle(createSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    ok(res, await articleService.updateArticle(req.params.id, updateSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await articleService.deleteArticle(req.params.id);
    ok(res, { message: 'Artikel dihapus' });
  } catch (err) {
    next(err);
  }
}
